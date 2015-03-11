'use strict';
var assert = require('assert');
var fs = require('fs');
var cpy = require('./');

afterEach(function () {
	[
		'tmp/license',
		'tmp/package.json',
		'tmp/cwd/hello.js',
		'tmp/hello.js',
		'tmp/tmp/cwd/hello.js'
	].forEach(function (path) {
		try {
			fs.unlinkSync(path);
		} catch (err) {}
	});
	[
		'tmp/tmp/cwd',
		'tmp/cwd',
		'tmp/tmp',
		'tmp'
	].forEach(function (path) {
		try {
			fs.rmdirSync(path);
		} catch (err) {}
	});
});

it('should copy files', function (cb) {
	cpy(['license', 'package.json'], 'tmp', function (err) {
		assert(!err, err);

		assert.strictEqual(
			fs.readFileSync('license', 'utf8'),
			fs.readFileSync('tmp/license', 'utf8')
		);

		assert.strictEqual(
			fs.readFileSync('package.json', 'utf8'),
			fs.readFileSync('tmp/package.json', 'utf8')
		);

		cb();
	});
});

it('should respect cwd', function (cb) {
	fs.mkdirSync('tmp');
	fs.mkdirSync('tmp/cwd');
	fs.writeFileSync('tmp/cwd/hello.js', 'console.log("hello");');

	cpy(['hello.js'], 'tmp', {cwd: 'tmp/cwd'}, function (err) {
		assert(!err, err);

		assert.strictEqual(
			fs.readFileSync('tmp/cwd/hello.js', 'utf8'),
			fs.readFileSync('tmp/hello.js', 'utf8')
		);

		cb();
	});
});

it('should not overwrite when disabled', function (cb) {
	fs.mkdirSync('tmp');
	fs.writeFileSync('tmp/license', '');

	cpy(['license'], 'tmp', {overwrite: false}, function (err) {
		assert(!err, err);
		assert.strictEqual(fs.readFileSync('tmp/license', 'utf8'), '');
		cb();
	});
});

it('should keep path structure', function (cb) {
	fs.mkdirSync('tmp');
	fs.mkdirSync('tmp/cwd');
	fs.writeFileSync('tmp/cwd/hello.js', 'console.log("hello");');

	cpy(['tmp/cwd/hello.js'], 'tmp', {parents: true}, function (err) {
		assert(!err, err);

		assert.strictEqual(
			fs.readFileSync('tmp/cwd/hello.js', 'utf8'),
			fs.readFileSync('tmp/tmp/cwd/hello.js', 'utf8')
		);

		cb();
	});
});

it('should not keep path structure by default', function (cb) {
	fs.mkdirSync('tmp');
	fs.mkdirSync('tmp/cwd');
	fs.writeFileSync('tmp/cwd/hello.js', 'console.log("hello");');

	cpy(['tmp/cwd/hello.js'], 'tmp', function (err) {
		assert(!err, err);

		assert.strictEqual(
			fs.readFileSync('tmp/cwd/hello.js', 'utf8'),
			fs.readFileSync('tmp/hello.js', 'utf8')
		);

		cb();
	});
});
