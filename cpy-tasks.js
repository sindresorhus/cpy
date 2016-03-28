'use strict';
var objectAssign = require('object-assign');
var Promise = require('pinkie-promise');
var glob = require('glob');
var globby = require('globby');
var pify = require('pify');

var globP = pify(glob, Promise);

var CpyError = require('./cpy-error');
var CpyTask = require('./cpy-task');

/*
 * generate optimized negative ignore patterns, e.g.:
 * ['!node_modules'] => ['!node_modules', '!node_modules/**']
 *
 * see https://github.com/sindresorhus/globby/pull/24#issuecomment-199655477
 */
function generateRecusiveIgnores(ignore) {
	return ignore.reduce(function (ignore, pattern) {
		ignore.push(pattern);
		ignore.push(pattern + '/**');

		return ignore;
	}, []);
}

function CpyTasks() {
	this.tasks = [];
}

CpyTasks.prototype._addSrcPath = function (srcPath, dest, opts) {
	var self = this;
	var task = new CpyTask(srcPath, dest, opts);

	self.tasks.push(task);

	return task.srcStat()
		.then(function (srcStats) {
			if (opts.recursive && srcStats.isDirectory()) {
				return self._addGlobPattern(
					srcPath + '/**/*',
					dest,
					objectAssign({}, opts, {
						parents: true,
						ignore: generateRecusiveIgnores(opts.ignore),
						recursive: false
					})
				);
			}

			return self;
		});
};

CpyTasks.prototype._addGlobPattern = function (pattern, dest, opts) {
	var self = this;

	return globP(pattern, opts)
		.catch(function (err) {
			throw new CpyError('Cannot glob `' + pattern + '`: ' + err.message, err);
		})
		.then(function (paths) {
			return paths.map(function (path) {
				return self._addSrcPath(path, dest, opts);
			});
		})
		.then(Promise.all.bind(Promise))
		.then(function () {
			return self;
		});
};

CpyTasks.prototype.add = function (patterns, dest, opts) {
	var self = this;

	opts = objectAssign({recursive: true}, opts);

	return Promise.all(globby.generateGlobTasks(patterns, opts).map(function (globTask) {
		return self._addGlobPattern(globTask.pattern, dest, globTask.opts);
	}))
	.then(function () {
		return self;
	});
};

CpyTasks.prototype.start = function () {
	var self = this;

	return Promise.all(self.tasks.map(function (task) {
		return task.start();
	}))
	.then(function () {
		return self;
	});
};

module.exports = CpyTasks;
