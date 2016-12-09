import test from 'tape';
import { Connection } from '../src/connection';


test('Create connection', (t) => {
	t.plan(3);
	let options = {
		autoConnect: false,
		autoReconect: true,
		reconnectInterval: 5000
	};
	let connection = new Connection(options);
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
		let connection = new Connection(options);
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
	let connection = new Connection(options);

	connection.subscribe(
		event => {
			if (event.name === 'connected') {
				t.pass('Failed creating connection');
			} else {
				t.fail(`Unexpected event on connection ${event.name}`);
			}
		},
		error => t.fail('Failed creating connection')
	)

	// t.equal(connection.autoConnect, true, 'autoConnect should be correct setted');
	// t.equal(connection.autoReconect, true, 'autoReconect should be correct setted');
	// t.equal(connection.reconnectInterval, 5000, 'reconnectInterval should be correct setted');
});
