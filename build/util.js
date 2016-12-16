'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.generateId = generateId;
function generateId() {
	var id = [];
	for (var i = 0; i < 17; i++) {
		var array = new Uint32Array(1);
		window.crypto.getRandomValues(array);
		var random = array[0] * 2.3283064365386963e-10; // 2^-32
		var index = Math.floor(random * UNMISTAKABLE_CHARS.length);
		id.push(UNMISTAKABLE_CHARS.substr(index, 1));
	}
	return id.join('');
}
//# sourceMappingURL=util.js.map