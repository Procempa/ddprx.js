import EJSON from 'ejson';
import _ from 'lodash';
import crypto from 'crypto';

const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';

export function generateId() {
	let id = [];
	for (let i = 0; i < 17; i++) {
		let bytes = crypto.randomBytes(4);
		let numerator = parseInt(bytes.toString('hex'), 16);
		let random = numerator * 2.3283064365386963e-10; // 2^-32
		let index = Math.floor(random * UNMISTAKABLE_CHARS.length);
		id.push(UNMISTAKABLE_CHARS.substr(index, 1));
	}

	return id.join('');
}


export function stringifyDDP(msg) {
	let copy = EJSON.clone(msg);
	// swizzle 'changed' messages from 'fields undefined' rep to 'fields
	// and cleared' rep
	if (_.has(msg, 'fields')) {
		let cleared = [];
		_.forEach(msg.fields, (value, key) => {
			if (value === undefined) {
				cleared.push(key);
				delete copy.fields[key];
			}
		});
		if (!_.isEmpty(cleared))
			copy.cleared = cleared;
		if (_.isEmpty(copy.fields))
			delete copy.fields;
	}
	// adjust types to basic
	_.each(['fields', 'params', 'result'], function (field) {
		if (_.has(copy, field))
			copy[field] = EJSON._adjustTypesToJSONValue(copy[field]);
	});
	if (msg.id && typeof msg.id !== 'string') {
		throw new Error('Message id is not a string');
	}
	return JSON.stringify(copy);
}

export function parseDDP(stringMessage) {
	let msg;
	try {
		msg = JSON.parse(stringMessage);
	} catch (e) {
		console.warn('Discarding message with invalid JSON', stringMessage);
		return null;
	}
	// DDP messages must be objects.
	if (msg === null || typeof msg !== 'object') {
		console.warn('Discarding non-object DDP message', stringMessage);
		return null;
	}

	// massage msg to get it into "abstract ddp" rather than "wire ddp" format.
	// switch between "cleared" rep of unsetting fields and "undefined"
	// rep of same
	if (_.has(msg, 'cleared')) {
		if (!_.has(msg, 'fields'))
			msg.fields = {};
		_.forEach(msg.cleared, (clearKey) => {
			msg.fields[clearKey] = undefined;
		});
		delete msg.cleared;
	}

	_.forEach(['fields', 'params', 'result'], function (field) {
		if (_.has(msg, field))
			msg[field] = EJSON._adjustTypesFromJSONValue(msg[field]);
	});

	return msg;
}