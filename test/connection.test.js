import test from 'tape';
import { Connection } from '../src/connection';
const SERVER_URL = 'http://localhost:3000/sockjs';

test('Create connection', (t) => {
	t.plan(4);
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
});

test('Not create Connection with invalid options', (t) => {
	t.plan(1);
	let options = {
		incorrectOption: 'blah'
	};
	try {
		let connection = new Connection(SERVER_URL, options);
		t.fail('Connection created with invalid options');
	} catch (e) {
		t.pass('Connection NOT created with invalid options');
	}

});


test('Create Connection and then connect', (t) => {
	t.plan(1);
	let options = {
		autoConnect: true
	};
	let connection = new Connection(SERVER_URL, options);

	connection.subscribe(
		event => {
			if (event.state === 'open') {
				t.pass('Creating connection and connect');
			} else {
				t.fail(`Unexpected state on connection ${event.state}`);
			}
			connection.close();
		},
		error => t.fail('Failed creating connection')
	)
});
