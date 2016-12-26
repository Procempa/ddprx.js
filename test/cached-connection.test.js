import test from 'tape';
import { FakeSockJS } from './fake-sockjs';
import _ from 'lodash';
import { CachedConnection } from '../src/cached-connection';
import { Connection } from '../src/connection';
const SERVER_URL = 'http://localhost:3000/sockjs';


test('Cache method calls', t => {
	t.plan(5);

	let options = {
		autoConnect: true,
		autoReconect: false,
		reconnectInterval: 10000
	};

	let connection = new CachedConnection(SERVER_URL, options, FakeSockJS);

	connection.state.subscribe(
		state => {
			if (state === Connection.STATE_OPEN) {
				t.pass('Connection created and connected');
				connection._socket.close();
				t.pass('Broken connection');
			} else if (state === Connection.STATE_CLOSED) {
				t.pass('Connection correct closed');
				connection
					.call('methodName', { 'param': 'RPQuuo2YjAKtTEvfT' })
					.subscribe(
					() => {
						t.fail('Method called without offline error code');
						connection.close();
					},
					error => {
						t.equal(error.code, 503, 'Call cached');
						let id = _.get(error, 'data.id');
						connection.close();
						connection = new CachedConnection(SERVER_URL, options, FakeSockJS);
						connection.offlineResults.subscribe(
							data => {
								t.equal(data.id, id);
								connection.close();
							});
					});
			}
		},
		() => t.fail('Failed creating connection')
	);
});


// test('Retrive cached items', t => {
// 	t.plan(5);
// 	let options = {
// 		autoConnect: true,
// 		autoReconect: false,
// 		reconnectInterval: 10000
// 	};

// 	let connection = new CachedConnection(SERVER_URL, options, FakeSockJS);

// 	connection.state.subscribe(
// 		state => {
// 			if (state === Connection.STATE_OPEN) {
// 				t.pass('Connection created and connected');
// 				connection
// 					.collection('collectionName', 'publishName', { '_id': 'RPQuuo2YjAKtTEvfT' })
// 					.subscribe(r1 => {
// 						console.log(r1);
// 						t.pass('Online collection received success');
// 						connection.unsubscribe('publishName');
// 						connection.close();
// 					});
// 			}
// 		});
// });