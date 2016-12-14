export function generateId() {
	let id = [];
	for (let i = 0; i < 17; i++) {
		let array = new Uint32Array(1);
		window.crypto.getRandomValues(array);
		let random = array[0] * 2.3283064365386963e-10; // 2^-32
		let index = Math.floor(random * UNMISTAKABLE_CHARS.length);
		id.push(UNMISTAKABLE_CHARS.substr(index, 1));
	}
	return id.join('');
}
