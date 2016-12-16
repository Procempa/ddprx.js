'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.Connection = undefined;

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _class, _temp;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _ajv = require('ajv');

var _ajv2 = _interopRequireDefault(_ajv);

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _validate = require('validate.js');

var _validate2 = _interopRequireDefault(_validate);

var _sockjsClient = require('sockjs-client');

var _sockjsClient2 = _interopRequireDefault(_sockjsClient);

var _ejson = require('ejson');

var _ejson2 = _interopRequireDefault(_ejson);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DDP_VERSION = "1";
var OPTIONS_STRUCTURE = {
	"type": "object",
	"properties": {
		"autoConnect": { "type": "boolean", "default": false },
		"autoReconect": { "type": "boolean", "default": false },
		"reconnectInterval": { "type": "integer", "default": 10000 }
	},
	"additionalProperties": false
};

var URL_VALIDATION = {
	presence: true,
	url: {
		schemes: ["http", "https", "ws", "wss"],
		allowLocal: true
	}
};

var STATE_CLOSED = 0;
var STATE_OPEN = 1;

var Connection = exports.Connection = (_temp = _class = function () {
	function Connection(server_url, options) {
		var socket = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _sockjsClient2.default;
		(0, _classCallCheck3.default)(this, Connection);
		this.messageQueue = [];
		this.online = false;

		var ajv = new _ajv2.default({ coerceTypes: true });
		var validateOptions = ajv.compile(OPTIONS_STRUCTURE);
		var valid = validateOptions(options);
		if (options && valid) {
			if (_validate2.default.single(server_url, URL_VALIDATION)) {
				throw new Error('Invalid server URL');
			} else {
				_lodash2.default.set(this, 'server_url', server_url);
				_lodash2.default.assign(this, options);
			}
		} else if (!valid) {
			var message = _lodash2.default.map(_validate2.default.errors, function (e) {
				return _lodash2.default.pick(e, 'dataPath', 'message', 'params');
			}).reduce(function (r, e) {
				r.push(_lodash2.default.tail(e.dataPath).join('') + ' ' + e.message);
				var additional = _lodash2.default.get(e, 'params.additionalProperty');
				if (additional) {
					r.push('Invalid property: ' + additional);
				}
				return r;
			}, []);
			console.error(message.join('\n'));
			throw new Error(message.join('\n'));
		}
		if (!server_url || _validate2.default.single(server_url, URL_VALIDATION)) {
			throw new Error('Invalid server URL');
		} else {
			_lodash2.default.set(this, 'server_url', server_url);
		}
		_lodash2.default.set(this, 'Socket', socket);
		if (options.autoConnect) {
			this.open();
		}
		// this.remoteObserver = Rx.Observable.fromArray(this.messageQueue);
		// this.remoteObserver.subscribe(())
	}

	(0, _createClass3.default)(Connection, [{
		key: 'open',
		value: function open(server_url) {
			var _this = this;

			if (server_url) {
				if (_validate2.default.single(server_url, URL_VALIDATION)) {
					throw new Error('Invalid server URL');
				} else {
					_lodash2.default.set(this, 'server_url', server_url);
				}
			}
			this.close();
			this.stateSubject = new _rx2.default.ReplaySubject(1);
			this.Socket.prototype.dispatchEvent = function (event) {
				// console.log(event);
				switch (event.type) {
					case 'close':
						_this.online = false;
						if (event.code === 1002) {
							_this.stateSubject.onNext({
								"type": "error",
								"reason": event.reason
							});
						} else {
							_this.stateSubject.onNext({ "type": "closed" });
							_this.stateSubject.onCompleted();
						}
						break;
					case 'open':
						_this.send({
							msg: "connect",
							version: DDP_VERSION,
							support: [DDP_VERSION]
						});
						break;
					default:
						_this._processMessage(Connection._parseDDP(event.data));
				}
			};
			// console.log(this.server_url);
			this._socket = new this.Socket(this.server_url, undefined, {
				transports: Connection.TRANSPORTS
			});
		}
	}, {
		key: '_processMessage',
		value: function _processMessage(msg) {
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
	}, {
		key: 'send',
		value: function send(message) {
			// if (this._socket.readyState === STATE_OPEN) {
			// 	this._socket.send(Connection._stringifyDDP(message));
			// 	messageQueue
			// 	// console.log(this._stringifyDDP(message));
			// }
		}
	}, {
		key: 'close',
		value: function close() {
			if (this._socket) {
				this._socket.close();
				_lodash2.default.unset(this, 'socket');
			}
		}
	}, {
		key: 'subscribe',
		value: function subscribe() /* arguments */{
			var _stateSubject;

			return (_stateSubject = this.stateSubject).subscribe.apply(_stateSubject, arguments);
		}
	}, {
		key: 'call',
		value: function call(method) {
			var _this2 = this;

			for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
				args[_key - 1] = arguments[_key];
			}

			return _rx2.default.Observable.create(function (observer) {
				var id = (0, _util.generateId)();
				_lodash2.default.set(_this2, 'pending-calls.' + id, observer);
				_this2.messageQueue.push({
					msg: "method",
					id: id,
					method: method,
					params: args
				});
				// observer.onNext({ result: "OK" });
			});
		}
	}], [{
		key: '_stringifyDDP',
		value: function _stringifyDDP(msg) {
			var copy = _ejson2.default.clone(msg);
			// swizzle 'changed' messages from 'fields undefined' rep to 'fields
			// and cleared' rep
			if (_lodash2.default.has(msg, 'fields')) {
				(function () {
					var cleared = [];
					_lodash2.default.forEach(msg.fields, function (value, key) {
						if (value === undefined) {
							cleared.push(key);
							delete copy.fields[key];
						}
					});
					if (!_lodash2.default.isEmpty(cleared)) copy.cleared = cleared;
					if (_lodash2.default.isEmpty(copy.fields)) delete copy.fields;
				})();
			}
			// adjust types to basic
			_lodash2.default.each(['fields', 'params', 'result'], function (field) {
				if (_lodash2.default.has(copy, field)) copy[field] = _ejson2.default._adjustTypesToJSONValue(copy[field]);
			});
			if (msg.id && typeof msg.id !== 'string') {
				throw new Error("Message id is not a string");
			}
			return (0, _stringify2.default)(copy);
		}
	}, {
		key: '_parseDDP',
		value: function _parseDDP(stringMessage) {
			var msg = void 0;
			try {
				msg = JSON.parse(stringMessage);
			} catch (e) {
				console.warn("Discarding message with invalid JSON", stringMessage);
				return null;
			}
			// DDP messages must be objects.
			if (msg === null || (typeof msg === 'undefined' ? 'undefined' : (0, _typeof3.default)(msg)) !== 'object') {
				console.warn("Discarding non-object DDP message", stringMessage);
				return null;
			}

			// massage msg to get it into "abstract ddp" rather than "wire ddp" format.
			// switch between "cleared" rep of unsetting fields and "undefined"
			// rep of same
			if (_lodash2.default.has(msg, 'cleared')) {
				if (!_lodash2.default.has(msg, 'fields')) msg.fields = {};
				_lodash2.default.forEach(msg.cleared, function (clearKey) {
					msg.fields[clearKey] = undefined;
				});
				delete msg.cleared;
			}

			_lodash2.default.forEach(['fields', 'params', 'result'], function (field) {
				if (_lodash2.default.has(msg, field)) msg[field] = _ejson2.default._adjustTypesFromJSONValue(msg[field]);
			});

			return msg;
		}
	}]);
	return Connection;
}(), _class.TRANSPORTS = ['websocket', 'xdr-streaming', 'xhr-streaming', 'iframe-eventsource', 'iframe-htmlfile', 'xdr-polling', 'xhr-polling', 'iframe-xhr-polling', 'jsonp-polling'], _temp);
//# sourceMappingURL=connection.js.map