'use strict';
var Promise = require('pinkie-promise');

var CpyError = require('./cpy-error');
var CpyTasks = require('./cpy-tasks');

module.exports = function (src, dest, opts) {
	if (!Array.isArray(src)) {
		return Promise.reject(new CpyError('Expected `files` to be an array, got ' + typeof src));
	}

	if (src.length === 0 || !dest) {
		return Promise.reject(new CpyError('`files` and `destination` required'));
	}

	return (new CpyTasks())
		.add(src, dest, opts)
		.then(function (cpyTasks) {
			return cpyTasks.start();
		});
};
