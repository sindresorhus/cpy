'use strict';
var fs = require('fs');
var path = require('path');
var cpFile = require('cp-file');
var Promise = require('pinkie-promise');
var pify = require('pify');
var mkdirp = require('mkdirp');

var fsP = pify(fs, Promise);
var mkdirpP = pify(mkdirp, Promise);

var CpyError = require('./cpy-error');

function resolveSrcPath(src, opts) {
	if (opts.cwd) {
		src = path.resolve(opts.cwd, src);
	}

	return src;
}

function resolveDestPath(src, dest, opts) {
	var basename = opts.rename || path.basename(src);
	var dirname = path.dirname(src);

	if (opts.cwd) {
		dest = path.resolve(opts.cwd, dest);
	}

	if (opts.parents) {
		return path.join(dest, dirname, basename);
	}

	return path.join(dest, basename);
}

function CpyTask(src, dest, opts) {
	this.src = resolveSrcPath(src, opts);
	this.dest = resolveDestPath(src, dest, opts);
	this.opts = opts;
}

CpyTask.prototype.srcStat = function () {
	var self = this;

	if (self._srcStats) {
		return Promise.resolve(self._srcStats);
	}

	return (self.opts.follow ? fsP.stat : fsP.lstat)(self.src)
		.then(function (stats) {
			self._srcStats = stats;

			return stats;
		})
		.catch(function (err) {
			throw new CpyError('Cannot stat `' + self.src + '`: ' + err.message, err);
		});
};

CpyTask.prototype.start = function () {
	var self = this;

	return self.srcStat()
		.then(function (srcStats) {
			if (srcStats.isDirectory()) {
				// create (possibly empty) directory
				return mkdirpP(self.dest);
			}

			return cpFile(self.src, self.dest, self.opts);
		})
		.then(function () {
			return self;
		})
		.catch(function (err) {
			throw new CpyError('Cannot copy from `' + self.src + '` to `' + self.dest + '`: ' + err.message, err);
		});
};

module.exports = CpyTask;
