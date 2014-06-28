'use strict';
var path = require('path');
var eachAsync = require('each-async');
var globby = require('globby');
var cpFile = require('cp-file');

module.exports = function (src, dest, opts, cb) {
	if (!(Array.isArray(src) && src.length > 0) || !dest) {
		throw new Error('`src` and `dest` required');
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = cb || function () {};

	globby(src, opts, function (err, files) {
		if (err) {
			cb(err);
			return;
		}

		eachAsync(files, function (el, i, next) {
			cpFile(el, path.join(dest, el), opts, next);
		}, cb);
	});
};
