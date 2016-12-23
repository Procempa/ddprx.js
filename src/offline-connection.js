import { Connection } from './connection';
import SockJS from 'sockjs-client';

export class CachedCollection extends Connection {

	constructor(server_url, options, socket = SockJS) {
		super(server_url, options, socket);

	}

}