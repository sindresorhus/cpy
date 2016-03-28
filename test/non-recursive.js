import {join} from 'path';
import test from 'ava';
import tempfile from 'tempfile';

import fn from '../';
import {read, write, mkdir, lstat, readdir} from './helpers/fs';

test.beforeEach(t => {
	t.context.tmp = tempfile();
});

test('copy files', async t => {
	await fn(['../license', '../package.json'], t.context.tmp);

	t.is(read('../license'), read(t.context.tmp, 'license'));
	t.is(read('../package.json'), read(t.context.tmp, 'package.json'));
});

test('cwd', async t => {
	write(t.context.tmp, 'cwd/hello.js', 'console.log("hello");');

	await fn(['hello.js'], 'dest', {cwd: join(t.context.tmp, 'cwd')});

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, 'cwd/dest/hello.js'));
});

test('do not overwrite', async t => {
	write(t.context.tmp, 'license', '');

	await fn(['../license'], t.context.tmp, {overwrite: false});

	t.is(read(t.context.tmp, 'license'), '');
});

test('do not keep path structure', async t => {
	write(t.context.tmp, 'cwd/hello.js', 'console.log("hello");');

	await fn([join(t.context.tmp, 'cwd/hello.js')], t.context.tmp);

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, 'hello.js'));
});

test('path structure', async t => {
	write(t.context.tmp, 'cwd/hello.js', 'console.log("hello");');

	await fn([join(t.context.tmp, 'cwd/hello.js')], t.context.tmp, {parents: true});

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, t.context.tmp, 'cwd/hello.js'));
});

test('rename filenames but not filepaths', async t => {
	write(t.context.tmp, 'hello.js', 'console.log("hello");');
	write(t.context.tmp, 'src/hello.js', 'console.log("hello");');

	await fn(['hello.js', 'src/hello.js'], 'dest/subdir', {
		cwd: t.context.tmp,
		parents: true,
		rename: 'hi.js'
	});

	t.is(read(t.context.tmp, 'hello.js'), read(t.context.tmp, 'dest/subdir/hi.js'));
	t.is(read(t.context.tmp, 'src/hello.js'), read(t.context.tmp, 'dest/subdir/src/hi.js'));
});

test('copy empty directories', async t => {
	mkdir(t.context.tmp, 'src');

	await fn(['src'], 'dest', {
		cwd: t.context.tmp
	});

	t.true(lstat(t.context.tmp, 'dest').isDirectory());
	t.true(lstat(t.context.tmp, 'dest/src').isDirectory());
	t.deepEqual(readdir(t.context.tmp, 'dest/src'), []);
});
