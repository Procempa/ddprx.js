import Rx from 'rx';
import _ from 'lodash';
import moment from 'moment';

const DEFAULT_DELAY = 100;

export class CollectionObserver {

	constructor(options) {
		this.lastrun = moment();
		this.delay = _.get(options, 'delay') || DEFAULT_DELAY;
		this.subject = new Rx.Subject();
	}

	subscribe(/* arguments */) {
		return this.subject.subscribe(...arguments);
	}



	push(el) {
		if (moment().diff(this.lastrun) < this.delay) {
			this.subject.onNext(el);
		} else {
			Rx.Scheduler.default
				.scheduleFuture(el, this.lastrun.add(this.delay), (sc, el) => {
					this.subject.onNext(el);
				});
		}
		_.set(this, 'lastrun', moment());
	}

}