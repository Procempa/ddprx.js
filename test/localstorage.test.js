import test from 'tape';
import { LocalStorage } from '../src/localstorage';
import _ from 'lodash';


test('Create storage', (t) => {
	t.plan(2);
	let storage = new LocalStorage('test');
	t.equal(storage.name, 'test', 'Name correct setted');
	storage.state.subscribe((state) => {
		if (state != LocalStorage.STATE_CLOSED) {
			t.equal(state, LocalStorage.STATE_OPEN, 'Storage created');
			storage.clear();
			storage.close();
		}
	});
});


test('Store a value and then retrieve it', (t) => {
	t.plan(2);

	let storage = new LocalStorage('test');

	storage.state.subscribe(
		(state) => {
			if (state === LocalStorage.STATE_OPEN) {
				try {
					storage
						.setItem('testKey', 'testValue')
						.subscribe(() => {
							t.pass('Value setted');
						},
						e => {
							t.fail('Error setting value: ' + e);
						});
				} catch (error) {
					t.fail('Error setting value: ' + error.message);
				}

				try {
					storage
						.item('testKey')
						.subscribe(v => {
							t.equal(v, 'testValue', 'Item successfully retrived');
							storage.clear();
							storage.close();
						});
				} catch (error) {
					t.fail('Error retriving value: ' + error.message);
				}
			}
		}
	);
});


test('Store values and then retrieve them', (t) => {
	t.plan(4);

	let storage = new LocalStorage('test');

	storage.state.subscribe(
		(state) => {
			if (state === LocalStorage.STATE_OPEN) {
				try {
					storage
						.setItem('testKey1', 'testValue1')
						.subscribe(() => {
							t.pass('testKey1 setted');
						},
						e => {
							t.fail('Error setting value: ' + e);
						});

					storage
						.setItem('testKey2', 'testValue2')
						.subscribe(() => {
							t.pass('testKey2 setted');
						},
						e => {
							t.fail('Error setting value: ' + e);
						});

				} catch (error) {
					t.fail('Error setting value: ' + error.message);
				}

				try {
					storage.subscribe(v => {
						if (!_.isUndefined(v) && _.size(_.keys(v)) === 2) {
							t.true(_.isObject(v), 'Successfully retrived items');
							t.equal(_.size(_.keys(v)), 2, 'Successfully retrived 2 items');
							storage.clear();
							storage.close();
						}
					});
				} catch (error) {
					t.fail('Error retriving values: ' + error.message);
				}
			}
		});

});



test('Store a value, close database, reopen and then retrieve it', (t) => {
	t.plan(2);

	let storage = new LocalStorage('test');

	storage.state.subscribe(
		(state) => {
			if (state === LocalStorage.STATE_OPEN) {
				storage
					.setItem('testKey1', 'testValue1')
					.subscribe(() => {
						storage
							.setItem('testKey2', 'testValue2')
							.subscribe(() => {
								t.pass('Value setted');
								storage.close();
								storage = new LocalStorage('test');
								storage
									.length
									.subscribe(v => {
										if (v) {
											t.equal(v, 2, 'Item successfully retrived after reopen');
											storage.clear();
											storage.close();
										}
									});
							},
							e => {
								t.fail('Error setting value: ' + e);
							});
					});
			}
		});
});