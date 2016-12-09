import _ from 'lodash';
import Ajv from 'ajv';
import Rx from 'rx';
// import SockJS from 'sockjs-client';

const OPTIONS_STRUCTURE = {
	"type": "object",
	"properties": {
		"autoConnect": { "type": "boolean", "default": false },
		"autoReconect": { "type": "boolean", "default": false },
		"reconnectInterval": { "type": "integer", "default": 10000 }
	},
	"additionalProperties": false
};

export class Connection {

	constructor(options) {
		let ajv = new Ajv();
		let validate = ajv.compile(OPTIONS_STRUCTURE);
		let valid = validate(options);
		if (options && valid) {
			_.assign(this, options);
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


		this.stateSubject.onNext({ "name": "connected" });
	}

	subscribe( /* arguments */ ) {
		return this.stateSubject.subscribe(...arguments);
	}
}
