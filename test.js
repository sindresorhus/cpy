'use strict';
var assert = require('assert');
var fs = require('fs');
var spawn = require('child_process').spawn;
var cpy = require('./');
var rimraf = require('rimraf');

beforeEach(function () {
	rimraf.sync('tmp');
});

describe('api', function() {
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

		cpy(['hello.js'], 'dest', {cwd: 'tmp/cwd'}, function (err) {
			assert(!err, err);

			assert.strictEqual(
				fs.readFileSync('tmp/cwd/dest/hello.js', 'utf8'),
				fs.readFileSync('tmp/cwd/hello.js', 'utf8')
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

	it('should handle absolute src paths', function (cb) {
		fs.mkdirSync('tmp');
		fs.writeFileSync('tmp/hello.js', 'console.log("hello");');

		var src = fs.realpathSync('tmp/hello.js');
		cpy([src], 'dest', {cwd: 'tmp'}, function (err) {
			assert(!err, err);

			assert.strictEqual(
				fs.readFileSync('tmp/dest/hello.js', 'utf8'),
				fs.readFileSync('tmp/hello.js', 'utf8')
			);

			cb();
		});
	});

	it('should handle absolute dest paths', function (cb) {
		fs.mkdirSync('tmp');
		fs.writeFileSync('tmp/hello.js', 'console.log("hello");');

		fs.mkdirSync('tmp/dest');
		var dest = fs.realpathSync('tmp/dest'); // realpath needs existing path
		fs.rmdirSync('tmp/dest'); // cpy should create 'dest'

		cpy(['hello.js'], dest, {cwd: 'tmp'}, function (err) {
			assert(!err, err);

			assert.strictEqual(
				fs.readFileSync('tmp/dest/hello.js', 'utf8'),
				fs.readFileSync('tmp/hello.js', 'utf8')
			);

			cb();
		});
	});
});

describe('cli', function() {
	it('should output an error message and return a non-zero exit status on ' +
		' missing file operands', function (done) {
		var err = '';
		var sut = spawn('./cli.js');
		sut.stderr.on('data', function (data) {
			err += String(data);
		});
		sut.on('close', function(status) {
			assert.ok(status !== 0, 'unexpected exit status: ' + status);
			assert.notStrictEqual(err, '', err);
			done();
		});
	});
});
