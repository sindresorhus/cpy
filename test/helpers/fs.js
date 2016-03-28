'use strict';
var fs = require('fs');
var path = require('path');
var arrify = require('arrify');
var mkdirp = require('mkdirp');
var pify = require('pify');
var Promise = require('pinkie-promise');

var fsP = pify(fs, Promise);

function join(paths) {
	return path.join.apply(null, paths);
}

module.exports.lstatP = function () {
	return fsP.lstat(join(arguments));
};

module.exports.lstat = function () {
	return fs.lstatSync(join(arguments));
};

module.exports.mkdir = function () {
	return mkdirp.sync(join(arguments));
};

module.exports.read = function () {
	return fs.readFileSync(join(arguments), 'utf8');
};

module.exports.write = function () {
	var args = Array.prototype.slice.call(arguments);
	var data = args.pop();
	var file = join(args);

	mkdirp.sync(path.dirname(file));

	return fs.writeFileSync(file, data);
};

module.exports.readdir = function () {
	return fs.readdirSync(join(arguments));
};

module.exports.symlink = function (target, src, type) {
	target = join(arrify(target));
	src = join(arrify(src));

	mkdirp.sync(path.dirname(src));

	return fs.symlinkSync(target, src, type);
};
