import { Subject, Observable, Scheduler, ReplaySubject } from 'rxjs/Rx';
import { Connection } from './connection';
import SockJS from 'sockjs-client';
import { LocalStorage } from './localstorage';
import { generateId, stringifyDDP } from './util';
import _ from 'lodash';

export class CachedConnection extends Connection {

	isOnline = false;
	remoteQueue = [];
	pending = {};
	offlineResults = new ReplaySubject(10);

	constructor(server_url, options, socket = SockJS) {
		super(server_url, options, socket);

		this.store = new LocalStorage('offline-method-calls');
		this.store.state.subscribe(
			(state) => {
				if (state === LocalStorage.STATE_OPEN) {
					this.store.subscribe(items => {
						_.forEach(items, (v, k) => {
							v.id = v.id || k;
							let index = _.findIndex(this.remoteQueue, m => m.id === v.id);
							if (index === -1) {
								this.remoteQueue.push(v);
							} else {
								this.remoteQueue.splice(index, 1, v);
							}
						});
					});
				}
			});


		this.schedulerOffline = Observable
			.interval(Connection.DEFAULT_DELAY)
			.observeOn(Scheduler.async)
			.subscribe(() => {
				if (this._socket.readyState === Connection.STATE_OPEN) {
					let message = this.remoteQueue.shift();
					if (message) {
						try {
							_.set(this, `pending.${message.id}`, message);
							this._socket.send(stringifyDDP(message));
						} catch (error) {
							console.error(error);
							_.unset(this, `pending.${message.id}`);
							this.remoteQueue.unshift(message);
						}
					}
				}
			});
	}

	call(method, ...params) {
		if (this._socket.readyState === Connection.STATE_OPEN) {
			return super.call(method, ...params);
		} else {
			let id = generateId();
			let message = {
				msg: 'method',
				id: id,
				method: method,
				params: params
			};
			let result = new Subject();
			this.store
				.setItem(id, message)
				.subscribe(() => {
					result.error({
						code: 503,
						message: 'Service unavailable, your call will be executed later',
						reason: 'Connection Offline',
						data: {
							id: id,
							method: method,
							params: params
						}
					});
					result.complete();
				});
			return result;
		}
	}

	_processMessage(msg) {
		let id = msg.id;
		let caller;
		switch (msg.msg) {
			case 'result':
				caller = _.get(this, `pending.${id}`);
				if (_.isUndefined(caller)) {
					super._processMessage(msg);
				} else {
					_.unset(msg, 'msg');
					_.set(msg, 'method', caller.method);
					_.set(msg, 'params', caller.params);
					this.offlineResults.next(msg);
					_.unset(this, `pending.${id}`);
				}
				break;
			default:
				super._processMessage(msg);
				break;
		}
	}


	close() {
		super.close();
		if (this.schedulerOffline) {
			this.schedulerOffline.unsubscribe();
		}
		if (this.offlineResults) {
			this.offlineResults.complete();
		}
	}


}