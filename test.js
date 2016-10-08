import path from 'path';
import fs from 'fs';
import rimraf from 'rimraf';
import test from 'ava';
import tempfile from 'tempfile';
import CpyError from './cpy-error';
import fn from './';

function read(...args) {
	return fs.readFileSync(path.join(...args), 'utf8');
}

test.beforeEach(t => {
	t.context.tmp = tempfile();
	t.context.EPERM = tempfile('EPERM');
	fs.mkdirSync(t.context.EPERM, 0);
});

test.afterEach(t => {
	rimraf.sync(t.context.tmp);
	rimraf.sync(t.context.EPERM);
});

test('reject Errors on missing `files`', async t => {
	const err1 = await t.throws(fn(), /`files`/);
	t.true(err1 instanceof CpyError);

	const err2 = await t.throws(fn(null, 'dest'), /`files`/);
	t.true(err2 instanceof CpyError);

	const err3 = await t.throws(fn([], 'dest'), /`files`/);
	t.true(err3 instanceof CpyError);
});

test('reject Errors on missing `destination`', async t => {
	const err = await t.throws(fn('TARGET'), /`destination`/);
	t.true(err instanceof CpyError);
});

test('copy single file', async t => {
	await fn('license', t.context.tmp);

	t.is(read('license'), read(t.context.tmp, 'license'));
});

test('copy array of files', async t => {
	await fn(['license', 'package.json'], t.context.tmp);

	t.is(read('license'), read(t.context.tmp, 'license'));
	t.is(read('package.json'), read(t.context.tmp, 'package.json'));
});

test('cwd', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await fn(['hello.js'], 'dest', {cwd: path.join(t.context.tmp, 'cwd')});

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, 'cwd/dest/hello.js'));
});

test('do not overwrite', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'license'), '');

	await fn(['license'], t.context.tmp, {overwrite: false});

	t.is(read(t.context.tmp, 'license'), '');
});

test('do not keep path structure', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await fn([path.join(t.context.tmp, 'cwd/hello.js')], t.context.tmp);

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, 'hello.js'));
});

test('path structure', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await fn([path.join(t.context.tmp, 'cwd/hello.js')], t.context.tmp, {parents: true});

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, t.context.tmp, 'cwd/hello.js'));
});

test('rename filenames but not filepaths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'src'));
	fs.writeFileSync(path.join(t.context.tmp, 'hello.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'src/hello.js'), 'console.log("hello");');

	await fn(['hello.js', 'src/hello.js'], 'dest/subdir', {
		cwd: t.context.tmp,
		parents: true,
		rename: 'hi.js'
	});

	t.is(read(t.context.tmp, 'hello.js'), read(t.context.tmp, 'dest/subdir/hi.js'));
	t.is(read(t.context.tmp, 'src/hello.js'), read(t.context.tmp, 'dest/subdir/src/hi.js'));
});

test('cp-file errors are not glob errors', async t => {
	const err = await t.throws(fn('license', t.context.EPERM), /EPERM/);
	t.notRegex(err, /glob/);
});

test('cp-file errors are CpyErrors', async t => {
	const err = await t.throws(fn('license', t.context.EPERM), /EPERM/);
	t.true(err instanceof CpyError);
});

test('glob errors are CpyErrors', async t => {
	const err = await t.throws(fn(t.context.EPERM + '/**', t.context.tmp), /EPERM/);
	t.true(err instanceof CpyError);
});
