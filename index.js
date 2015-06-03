'use strict';
var path = require('path');
var util = require('util');
var eachAsync = require('each-async');
var globby = require('globby');
var cpFile = require('cp-file');
var NestedError = require('nested-error-stacks');
var objectAssign = require('object-assign');

function CpyError(message, nested) {
	NestedError.call(this, message, nested);
	objectAssign(this, nested, {message: message});
}

util.inherits(CpyError, NestedError);

CpyError.prototype.name = 'CpyError';

function preprocessSrcPath(srcPath, opts) {
	if (opts.cwd) {
		srcPath = path.resolve(opts.cwd, srcPath);
	}

	return srcPath;
}

function preprocessDestPath(srcPath, dest, opts) {
	var basename = opts.rename || path.basename(srcPath);
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
		throw new CpyError('`src` and `dest` required');
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = cb || function () {};

	globby(src, opts, function (err, files) {
		if (err) {
			cb(new CpyError('cannot glob `' + src + '`: ' + err.message, err));
			return;
		}

		eachAsync(files, function (srcPath, i, next) {
			var from = preprocessSrcPath(srcPath, opts);
			var to = preprocessDestPath(srcPath, dest, opts);

			cpFile(from, to, opts, function (err) {
				if (err) {
					err = new CpyError('cannot copy from `' + from + '` to `' + to + '`: ' + err.message, err);
				}

				next(err);
			});
		}, cb);
	});
};
