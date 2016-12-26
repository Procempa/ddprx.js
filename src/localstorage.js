import { Observable, Subject, BehaviorSubject } from 'rxjs/Rx';
import _ from 'lodash';
/* global global*/

const DB_STORE_NAME = 'keyvaluepairs';

export class LocalStorage extends BehaviorSubject {

	static STATE_CLOSED = 0;
	static STATE_OPEN = 1;
	static STATE_ERROR = 2;

	allItems = {};
	state = new BehaviorSubject();
	length = new BehaviorSubject();
	db = new BehaviorSubject();


	constructor(name, storage = global.indexedDB) {
		super();
		this.state.next(LocalStorage.STATE_CLOSED);
		this.state.next(0);
		this.name = name;
		let request = storage.open(name);

		request.onerror = (error) => {
			console.error(`Error opening storage: ${error.message}`);
			this.state.next(LocalStorage.STATE_ERROR);
		};

		request.onsuccess = (event) => {
			let db = event.target.result;
			let store = db.transaction(DB_STORE_NAME, 'readonly').objectStore(DB_STORE_NAME);
			let req = store.openCursor();
			req.onsuccess = (event) => {
				let cursor = event.target.result;
				if (cursor) {
					_.set(this, `allItems.${_.get(req, 'result.key')}`, _.get(req, 'result.value'));
					cursor.continue();
				} else {
					this.next(this.allItems);
				}
			};
			this.state.next(LocalStorage.STATE_OPEN);

			this.db.next(db);

			this.subscribe((items) => {
				this.length.next(_.size(_.keys(items)));
			});
		};

		request.onupgradeneeded = (event) => {
			let db = event.target.result;
			this.store = db.createObjectStore(DB_STORE_NAME, { keypath: 'key' });
			this.store.createIndex('key', 'key', { unique: true });
		};
	}

	setItem(key, value) {
		return Observable.create((subscriber) => {
			this.db.subscribe(db => {
				if (_.isUndefined(db)) return;
				let transaction = db.transaction([DB_STORE_NAME], 'readwrite');
				transaction.objectStore(DB_STORE_NAME).put(value, key);

				transaction.oncomplete = () => {
					_.set(this, `allItems.${key}`, value);
					this.next(this.allItems);
					subscriber.next(value);
					subscriber.complete();
				};

				transaction.onabort = transaction.onerror = function (event) {
					console.error('Error', event);
					subscriber.error(event.target.error);
					subscriber.complete();
				};

			});

		});
	}

	removeItem(key) {
		return Observable.create((subscriber) => {
			this.db.subscribe(db => {
				if (_.isUndefined(db)) return;
				let transaction = db.transaction([DB_STORE_NAME], 'readwrite');
				transaction.objectStore(DB_STORE_NAME).delete(key);

				transaction.oncomplete = () => {
					_.unset(this, `allItems.${key}`);
					this.next(this.allItems);
					subscriber.next();
					subscriber.complete();
				};

				transaction.onabort = transaction.onerror = function (event) {
					console.error('Error', event);
					subscriber.error(event.target.error);
					subscriber.complete();
				};

			});

		});
	}

	item(key) {
		let subject = new Subject();
		this.subscribe((items) => {
			if (!_.isUndefined(_.get(items, key))) {
				subject.next(_.get(items, key));
			}
		});
		return subject;
	}

	clear() {
		this.db.subscribe(db => {
			if (_.isUndefined(db)) return;
			let store = db.transaction([DB_STORE_NAME], 'readwrite').objectStore(DB_STORE_NAME);
			let req = store.clear();
			req.onsuccess = () => {
				this.allItems = {};
				this.next(this.allItems);
			};
			req.onerror = function (evt) {
				console.error('Clear error:', evt.target.errorCode);
			};
		});
	}

	close() {
		this.state.next(LocalStorage.STATE_CLOSED);
		this.state.complete();
		this.db.subscribe(db => {
			if (db) {
				db.close();
			}
		});
	}
}