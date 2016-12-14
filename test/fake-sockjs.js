import _ from 'lodash';
import { Connection } from '../src/connection';
const SERVER_URL = 'http://localhost:3000/sockjs';

export class FakeSockJS {

	constructor(server_url, reserved, options) {
		if (arguments.length !== 3) {
			throw new Error("FakeSockJs Invalid Parameters")
		}
		if (server_url !== SERVER_URL) {
			throw new Error("FakeSockJs Invalid URL")
		}
		if (!_.isUndefined(reserved)) {
			throw new Error("FakeSockJs Invalid reserved parameter")
		}
		if (!_.isEqual(options, { transports: Connection.TRANSPORTS })) {
			throw new Error("FakeSockJs Invalid options")
		}
		this.readyState = 1;
		_.delay(this.dispatchEvent, 1, { type: 'open' });
	}

	send(msg) {
		let message = Connection._parseDDP(msg)
		switch (message.msg) {
			case 'connect':
				_.delay(this.dispatchEvent, 1, {
					type: 'message',
					bubbles: false,
					cancelable: false,
					timeStamp: 1481738830823,
					data: '{"msg":"connected","session":"2J2G47wTEwvsLe27k"}'
				});
				break;
			default:
				console.log(message);
		}

	}

	close() {
		_.delay(this.dispatchEvent, 1, {
			type: 'close',
			bubbles: false,
			cancelable: false,
			timeStamp: 1481738830826,
			wasClean: true,
			code: 1000,
			reason: 'Normal closure'
		});
		this.readyState = 0;
	}

}
