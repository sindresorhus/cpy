'use strict';
var path = require('path');
var eachAsync = require('each-async');
var globby = require('globby');
var cpFile = require('cp-file');

function preprocessSrcPath(srcPath, opts) {
	if (opts.cwd) {
		srcPath = path.resolve(opts.cwd, srcPath);
	}
	return srcPath;
}

function preprocessDestPath(srcPath, dest, opts) {
	var basename = path.basename(srcPath);
	var dirname = path.dirname(srcPath);

	if (opts.cwd) {
		dest = path.resolve(opts.cwd, dest);
	}

	if (opts.parents) {
		return path.join(dest, dirname, basename);
	} else {
		return path.join(dest, basename);
	}
}

module.exports = function (src, dest, opts, cb) {
	if (!(Array.isArray(src) && src.length > 0) || !dest) {
		var err = new Error('`src` and `dest` required');
		err.noStack = true;
		throw err;
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = cb || function () {};

	var cwd = opts.cwd || '';

	globby(src, opts, function (err, files) {
		if (err) {
			cb(err);
			return;
		}

		eachAsync(files, function (srcPath, i, next) {
			cpFile(
				preprocessSrcPath(srcPath, opts),
				preprocessDestPath(srcPath, dest, opts),
				opts, next);
		}, cb);
	});
};
