import _ from 'lodash';
import Ajv from 'ajv';
import Rx from 'rxjs/Rx';
import validate from 'validate.js';
import SockJS from 'sockjs-client';
import { generateId, stringifyDDP, parseDDP } from './util';

const DDP_VERSION = '1';
const OPTIONS_STRUCTURE = {
	'type': 'object',
	'properties': {
		'autoConnect': { 'type': 'boolean', 'default': false },
		'autoReconect': { 'type': 'boolean', 'default': false },
		'reconnectInterval': { 'type': 'integer', 'default': 10000 }
	},
	'additionalProperties': false
};
const URL_VALIDATION = {
	presence: true,
	url: {
		schemes: ['http', 'https', 'ws', 'wss'],
		allowLocal: true
	}
};

export class Connection {

	static TRANSPORTS = [
		'websocket',
		'xdr-streaming',
		'xhr-streaming',
		'iframe-eventsource',
		'iframe-htmlfile',
		'xdr-polling',
		'xhr-polling',
		'iframe-xhr-polling',
		'jsonp-polling'
	]

	static STATE_CLOSED = 0;
	static STATE_OPEN = 1;
	static STATE_RECONNECTING = 3;
	static DEFAULT_DELAY = 100;

	connected = false;

	constructor(server_url, options, socket = SockJS) {
		let ajv = new Ajv({ coerceTypes: true });
		let validateOptions = ajv.compile(OPTIONS_STRUCTURE);
		let valid = validateOptions(options);
		if (options && valid) {
			if (validate.single(server_url, URL_VALIDATION)) {
				throw new Error('Invalid server URL');
			} else {
				_.set(this, 'server_url', server_url);
				_.assign(this, options);
			}
		} else if (!valid) {
			let message = _.map(validate.errors, e => _.pick(e, 'dataPath', 'message', 'params'))
				.reduce((r, e) => {
					r.push(`${_.tail(e.dataPath).join('')} ${e.message}`);
					let additional = _.get(e, 'params.additionalProperty');
					if (additional) {
						r.push(`Invalid property: ${additional}`);
					}
					return r;
				}, []);
			console.error(message.join('\n'));
			throw new Error(message.join('\n'));
		}
		if (!server_url || validate.single(server_url, URL_VALIDATION)) {
			throw new Error('Invalid server URL');
		} else {
			_.set(this, 'server_url', server_url);
		}
		_.set(this, 'Socket', socket);

		this.remoteCollection = [];

		if (options.autoConnect) {
			this.open();
		}

	}

	open(server_url) {
		if (server_url) {
			if (validate.single(server_url, URL_VALIDATION)) {
				throw new Error('Invalid server URL');
			} else {
				_.set(this, 'server_url', server_url);
			}
		}
		this.close();
		this.state = new Rx.BehaviorSubject();
		this.schedulerSubscribe = Rx.Observable
			.interval(Connection.DEFAULT_DELAY)
			.observeOn(Rx.Scheduler.async)
			.subscribe(() => {
				if (this._socket.readyState === Connection.STATE_OPEN) {
					let message = this.remoteCollection.shift();
					if (message) {
						try {
							this._socket.send(stringifyDDP(message));
						} catch (error) {
							console.error(error);
							this.remoteCollection.unshift(message);
						}
					}
				}
			});
		this.Socket.prototype.dispatchEvent = (event) => {
			// console.log(event);
			switch (event.type) {
				case 'close':
					this.connected = false;
					if (this.autoReconect) {
						this.state.next(Connection.STATE_RECONNECTING);
						_.delay(() => this._socket = new this.Socket(this.server_url, undefined, {
							transports: Connection.TRANSPORTS
						}), this.reconnectInterval || 5000);

					} else {
						this.state.next(Connection.STATE_CLOSED);
						this.state.complete();
						this.schedulerSubscribe.unsubscribe();
					}
					break;
				case 'open':
					this.send({
						msg: 'connect',
						version: DDP_VERSION,
						support: [DDP_VERSION]
					});
					break;
				default:
					this._processMessage(parseDDP(event.data));
			}
		};
		this._socket = new this.Socket(this.server_url, undefined, {
			transports: Connection.TRANSPORTS
		});

	}

	_processMessage(msg) {
		// console.log(msg);
		let observer;
		switch (msg.msg) {
			case 'connected':
				this.connected = true;
				this.session_id = msg.session;
				this.state.next(Connection.STATE_OPEN);
				break;
			case 'ping':
				this.send({ msg: 'pong', id: msg.id });
				break;
			case 'result':
				observer = _.get(this, `pending-calls.${msg.id}`);
				if (observer) {
					_.unset(this, `pending-calls.${msg.id}`);
					if (msg.result) {
						observer.next(msg.result);
					} else {
						observer.onError(msg.error);
					}
					observer.complete();
					observer.unsubscribe();
				}
				break;
			case 'added':
			case 'changed':
			case 'removed':
				observer = _.get(this, `collection-${msg.collection}`);
				if (observer) {
					observer.next({
						type: msg.msg,
						data: _.assignIn({ _id: msg.id }, msg.fields)
					});
				}
				break;
			default:
				console.log(msg);
		}
	}

	send(message) {
		this.remoteCollection.push(message);
	}

	close() {
		if (this._socket) {
			_.forEach(_.filter(this, (v, k) => _.startsWith(k, 'subscribe-')), (v) => {
				this.unsubscribe(v.name);
			});
			this.autoReconect = false;
			this._socket.close();
			_.unset(this, 'socket');
		}
	}

	unsubscribe(publishName) {
		let subscribe = _.get(this, `subscribe-${publishName}`);
		if (subscribe) {
			_.unset(this, `subscribe-${publishName}`);
			this.send({
				msg: 'unsub',
				id: subscribe.id
			});
		}
	}

	subscribe(collectionName, publishName, ...params) {
		let publishId = _.get(this, `subscribe-${publishName}`);
		let collectionSubject = _.get(this, `collection-${collectionName}`);

		if (_.isUndefined(collectionSubject)) {
			collectionSubject = new Rx.ReplaySubject();
			_.set(this, `collection-${collectionName}`, collectionSubject);
		}

		if (_.isUndefined(publishId)) {
			let id = generateId();
			_.set(this, `subscribe-${publishName}`, {
				id: id,
				name: publishName,
				collectionName: collectionName
			});
			let message = {
				msg: 'sub',
				id: id,
				name: publishName,
				params: params
			};
			this.send(message);
		}
		return collectionSubject;
	}

	call(method, ...params) {
		return Rx.Observable.create((observer) => {
			let id = generateId();
			_.set(this, `pending-calls.${id}`, observer);
			let message = {
				msg: 'method',
				id: id,
				method: method,
				params: params
			};
			this.send(message);
		});
	}

}
