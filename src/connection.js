import _ from 'lodash';
import Ajv from 'ajv';
import Rx from 'rx';
import validate from 'validate.js';
import SockJS from 'sockjs-client';

const DDP_VERSION = "1";
const OPTIONS_STRUCTURE = {
	"type": "object",
	"properties": {
		"autoConnect": { "type": "boolean", "default": false },
		"autoReconect": { "type": "boolean", "default": false },
		"reconnectInterval": { "type": "integer", "default": 10000 },
		"Socket": { "type": "object", "default": SockJS }
	},
	"additionalProperties": false
};

const TRANSPORTS = [
	'websocket',
	'xdr-streaming',
	'xhr-streaming',
	'iframe-eventsource',
	'iframe-htmlfile',
	'xdr-polling',
	'xhr-polling',
	'iframe-xhr-polling',
	'jsonp-polling'
];

const URL_VALIDATION = {
	presence: true,
	url: {
		schemes: ["http", "https", "ws", "wss"],
		allowLocal: true
	}
};

export class Connection {

	constructor(server_url, options) {
		let ajv = new Ajv();
		let validateOptions = ajv.compile(OPTIONS_STRUCTURE);
		let valid = validateOptions(options);
		if (options && valid) {
			if (validate.single(server_url, URL_VALIDATION)) {
				throw new Error('Invalid server URL');
			} else {
				_.set(this, 'server_url', server_url);
				_.assign(this, options);
				_.set(this, 'Socket', options.Socket || SockJS);
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
			throw new Error(message.join('\n'));
		}
		this.stateSubject = new Rx.ReplaySubject(1);

		this.Socket.prototype.dispatchEvent = (event) => {
			console.log(event);
			switch (event.type) {
				case 'close':
					if (event.code === 1002) {
						this.stateSubject.onNext({
							"state": "error",
							"reason": event.reason
						});
					} else {
						this.stateSubject.onNext({ "state": "closed" });
					}
					break;
				case 'open':
					// this._socket.send({
					// 	msg: "connect",
					// 	version: DDP_VERSION,
					// 	support: [DDP_VERSION]
					// });
					// this.stateSubject.onNext({ "state": "open" });
					break;
				default:
					// console.log(event);
			}
		}

		this._socket = new this.Socket(server_url, undefined, {
			transports: TRANSPORTS
		});


		// this.stateSubject.onNext({ "name": "connected" });
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

	}

	close() {
		if (this.socket) {
			this.socket.close();
			_.unset(this, 'socket');
		}
	}

	subscribe( /* arguments */ ) {
		return this.stateSubject.subscribe(...arguments);
	}
}
