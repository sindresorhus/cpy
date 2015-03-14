'use strict';
var path = require('path');
var eachAsync = require('each-async');
var globby = require('globby');
var cpFile = require('cp-file');
var VError = require('verror');

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
	}

	return path.join(dest, basename);
}

module.exports = function (src, dest, opts, cb) {
	if (!(Array.isArray(src) && src.length > 0) || !dest) {
		var err = new VError('`src` and `dest` required');
		err.name = 'CpyError';
		throw err;
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = cb || function () {};

	globby(src, opts, function (err, files) {
		if (err) {
			err = new VError(err, 'cannot glob %j', src);
			err.name = 'CpyError';
			cb(err);
			return;
		}

		eachAsync(files, function (srcPath, i, next) {
			var from = preprocessSrcPath(srcPath, opts);
			var to = preprocessDestPath(srcPath, dest, opts);
			cpFile(from, to, opts, function (err) {
				if (err) {
					err = new VError(err, 'cannot copy from \'%s\' to \'%s\'', from, to);
					err.name = 'CpyError';
				}

				next(err);
			});
		}, cb);
	});
};
