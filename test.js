'use strict';
var assert = require('assert');
var fs = require('fs');
var cpy = require('./');

afterEach(function () {
	try {
		fs.unlinkSync('tmp/license');
		fs.unlinkSync('tmp/package.json');
	} catch (err) {}
	fs.rmdirSync('tmp');
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

it('should not overwrite when disabled', function (cb) {
	fs.mkdirSync('tmp');
	fs.writeFileSync('tmp/license', '');

	cpy(['license'], 'tmp', {overwrite: false}, function (err) {
		assert(!err, err);
		assert.strictEqual(fs.readFileSync('tmp/license', 'utf8'), '');
		cb();
	});
});
