import test from 'tape';
import sinon from 'sinon';
import SockJS from 'sockjs-client';
import { FakeSockJS } from './fake-sockjs';
import _ from 'lodash';
// import EJSON from 'ejson';
import { Connection } from '../src/connection';
const SERVER_URL = 'http://localhost:3000/sockjs';


test('Create connection', (t) => {
	t.plan(5);

	let spy = sinon.spy(SockJS);

	let options = {
		autoConnect: false,
		autoReconect: true,
		reconnectInterval: 5000
	};

	let connection = new Connection(SERVER_URL, options);

	t.equal(connection.server_url, SERVER_URL, 'autoConnect should be correct setted');
	t.equal(connection.autoConnect, false, 'autoConnect should be correct setted');
	t.equal(connection.autoReconect, true, 'autoReconect should be correct setted');
	t.equal(connection.reconnectInterval, 5000, 'reconnectInterval should be correct setted');
	t.false(spy.called, 'SockJS not created');

});

test('Not create Connection with invalid options', (t) => {
	t.plan(2);
	let spy = sinon.spy(SockJS);
	let options = {
		incorrectOption: 'blah'
	};
	try {
		new Connection(SERVER_URL, options);
		t.fail('Connection created with invalid options');
		t.false(spy.called, 'SockJS not created');
	} catch (e) {
		t.pass('Connection NOT created with invalid options');
		t.false(spy.called, 'SockJS not created');
	}

});

test('Create Connection and then connect', (t) => {
	t.plan(2);

	let options = {
		autoConnect: true
	};
	let connection = new Connection(SERVER_URL, options, FakeSockJS);

	connection.state.subscribe(
		state => {
			if (state === Connection.STATE_OPEN) {
				t.pass('Creating connection and connect');
				connection.close();
			} else if (state === Connection.STATE_CLOSED) {
				t.pass('Connection correct closed');
				connection.close();
			}
		},
		() => t.fail('Failed creating connection')
	);
});


test('Call method', (t) => {
	t.plan(3);

	let options = {
		autoConnect: true
	};
	let connection = new Connection(SERVER_URL, options, FakeSockJS);

	connection.state.subscribe(
		state => {
			if (state === Connection.STATE_OPEN) {
				t.pass('Creating connection and connect');
				connection
					.call('methodName', { 'param': 'RPQuuo2YjAKtTEvfT' })
					.subscribe(
					result => {
						t.pass('Method called with success');
						connection.close();
					},
					error => {
						t.fail('Error calling method');
						connection.close();
					});
			} else if (state === Connection.STATE_CLOSED) {
				t.pass('Connection correct closed');
			}
		},
		error => t.fail('Failed creating connection')
	);
});


test('Collection from a publish from server', (t) => {
	t.plan(3);

	let options = {
		autoConnect: true
	};
	let connection = new Connection(SERVER_URL, options, FakeSockJS);

	connection.state.subscribe(
		state => {
			if (state === Connection.STATE_OPEN) {
				t.pass('Creating connection and connect');
				connection
					.subscribe('collectionName', 'publishName', { '_id': 'RPQuuo2YjAKtTEvfT' })
					.subscribe(
					result => {
						t.pass('Collection received with success');
						connection.unsubscribe('publishName');
						connection.close();
					},
					error => {
						t.fail('Error calling method');
						connection.close();
					});
			} else if (state === Connection.STATE_CLOSED) {
				t.pass('Connection correct closed');
			}
		},
		error => t.fail('Failed creating connection')
	);
});



test('Create Connection and then connect, and reconnect', (t) => {
	t.plan(4);

	let options = {
		autoConnect: true,
		autoReconect: true,
		reconnectInterval: 10
	};
	let connection = new Connection(SERVER_URL, options, FakeSockJS);
	let connectTry = 0;
	let retry = false;
	connection.state.subscribe(
		state => {
			if (state === Connection.STATE_OPEN) {
				t.pass(`Creating connection and connect ${++connectTry}`);
				if (connectTry === 1) {
					connection._socket.close();
				} else {
					connection.close();
				}
			} else if (state === Connection.STATE_RECONNECTING) {
				if (!retry) {
					retry = true;
					t.pass('Trying to reconnect correct');
				}
			} else if (state === Connection.STATE_CLOSED) {
				t.pass('Connection correct closed');
			}
		},
		() => t.fail('Failed creating connection')
	);
});
