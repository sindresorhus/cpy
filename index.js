'use strict';
var path = require('path');
var eachAsync = require('each-async');
var globby = require('globby');
var cpFile = require('cp-file');

function preprocessSrcPath(srcPath, opts) {
	if (!path.isAbsolute(srcPath) && opts.cwd) {
		srcPath = path.join(opts.cwd, srcPath);
	}
	return srcPath;
}

function preprocessDestPath(srcPath, dest, opts) {
	var basename = path.basename(srcPath);
	var dirname = path.dirname(srcPath);

	if (!path.isAbsolute(dest) && opts.cwd) {
		dest = path.join(opts.cwd, dest);
	}

	if (opts.parents) {
		return path.join(dest, dirname, basename);
	} else {
		return path.join(dest, basename);
	}
}

module.exports = function (src, dest, opts, cb) {
	if (!(Array.isArray(src) && src.length > 0) || !dest) {
		throw new Error('`src` and `dest` required');
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
