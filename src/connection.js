import _ from 'lodash';
import Ajv from 'ajv';
import Rx from 'rx';
import validate from 'validate.js';
import SockJS from 'sockjs-client';
import EJSON from 'ejson';
import { generateId } from './util';

const DDP_VERSION = "1";
const OPTIONS_STRUCTURE = {
	"type": "object",
	"properties": {
		"autoConnect": { "type": "boolean", "default": false },
		"autoReconect": { "type": "boolean", "default": false },
		"reconnectInterval": { "type": "integer", "default": 10000 }
	},
	"additionalProperties": false
};

const URL_VALIDATION = {
	presence: true,
	url: {
		schemes: ["http", "https", "ws", "wss"],
		allowLocal: true
	}
};

const STATE_CLOSED = 0;
const STATE_OPEN = 1;

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

	messageQueue = [];
	online = false;

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
		if (options.autoConnect) {
			this.open();
		}
		this.remoteObserver = Rx.Observable.fromArray(this.messageQueue);
		this.remoteObserver.subscribe(())

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
		this.stateSubject = new Rx.ReplaySubject(1);
		this.Socket.prototype.dispatchEvent = (event) => {
				// console.log(event);
				switch (event.type) {
					case 'close':
						this.online = false;
						if (event.code === 1002) {
							this.stateSubject.onNext({
								"type": "error",
								"reason": event.reason
							});
						} else {
							this.stateSubject.onNext({ "type": "closed" });
							this.stateSubject.onCompleted();
						}
						break;
					case 'open':
						this.send({
							msg: "connect",
							version: DDP_VERSION,
							support: [DDP_VERSION]
						});
						break;
					default:
						this._processMessage(Connection._parseDDP(event.data));
				}
			}
			// console.log(this.server_url);
		this._socket = new this.Socket(this.server_url, undefined, {
			transports: Connection.TRANSPORTS
		});
	}

	_processMessage(msg) {
		switch (msg.msg) {
			case 'connected':
				this.online = true;
				this.session_id = msg.session;
				this.stateSubject.onNext({ "type": "connected" });
				break;
			case 'ping':
				this.send({ msg: "pong", id: msg.id });
				break;
			default:

		}
	}

	_

	send(message) {
		if (this._socket.readyState === STATE_OPEN) {
			this._socket.send(Connection._stringifyDDP(message));
			messageQueue
			// console.log(this._stringifyDDP(message));
		}
	}

	close() {
		if (this._socket) {
			this._socket.close();
			_.unset(this, 'socket');
		}
	}

	subscribe( /* arguments */ ) {
		return this.stateSubject.subscribe(...arguments);
	}

	call(method, ...args) {
		return Rx.Observable.create((observer) => {
			let id = generateId();
			_.set(this, `pending-calls.${id}`, observer);
			this.messageQueue.push({
				msg: "method",
				id: id,
				method: method,
				params: args
			});
			// observer.onNext({ result: "OK" });
		});
	}

	static _stringifyDDP(msg) {
		let copy = EJSON.clone(msg);
		// swizzle 'changed' messages from 'fields undefined' rep to 'fields
		// and cleared' rep
		if (_.has(msg, 'fields')) {
			let cleared = [];
			_.forEach(msg.fields, (value, key) => {
				if (value === undefined) {
					cleared.push(key);
					delete copy.fields[key];
				}
			});
			if (!_.isEmpty(cleared))
				copy.cleared = cleared;
			if (_.isEmpty(copy.fields))
				delete copy.fields;
		}
		// adjust types to basic
		_.each(['fields', 'params', 'result'], function(field) {
			if (_.has(copy, field))
				copy[field] = EJSON._adjustTypesToJSONValue(copy[field]);
		});
		if (msg.id && typeof msg.id !== 'string') {
			throw new Error("Message id is not a string");
		}
		return JSON.stringify(copy);
	}

	static _parseDDP(stringMessage) {
		let msg;
		try {
			msg = JSON.parse(stringMessage);
		} catch (e) {
			console.warn("Discarding message with invalid JSON", stringMessage);
			return null;
		}
		// DDP messages must be objects.
		if (msg === null || typeof msg !== 'object') {
			console.warn("Discarding non-object DDP message", stringMessage);
			return null;
		}

		// massage msg to get it into "abstract ddp" rather than "wire ddp" format.
		// switch between "cleared" rep of unsetting fields and "undefined"
		// rep of same
		if (_.has(msg, 'cleared')) {
			if (!_.has(msg, 'fields'))
				msg.fields = {};
			_.forEach(msg.cleared, (clearKey) => {
				msg.fields[clearKey] = undefined;
			});
			delete msg.cleared;
		}

		_.forEach(['fields', 'params', 'result'], function(field) {
			if (_.has(msg, field))
				msg[field] = EJSON._adjustTypesFromJSONValue(msg[field]);
		});

		return msg;
	}
}
