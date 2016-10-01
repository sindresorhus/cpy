import path from 'path';
import fs from 'fs';
import test from 'ava';
import tempfile from 'tempfile';
import globby from 'globby';
import fn from './';

function read(...args) {
	return fs.readFileSync(path.join(...args), 'utf8');
}

test.beforeEach(t => {
	t.context.tmp = tempfile();
});

test('copy files', async t => {
	await fn(['license', 'package.json'], t.context.tmp);

	t.is(read('license'), read(t.context.tmp, 'license'));
	t.is(read('package.json'), read(t.context.tmp, 'package.json'));
});

test('size', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'support'));
	fs.mkdirSync(path.join(t.context.tmp, 'supportSample'));
	fs.writeFileSync(path.join(t.context.tmp, 'support/lulu.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'support/janna.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'support/nami.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'support/soraka.js'), 'console.log("hello");');

	await fn([path.join(t.context.tmp, 'support/*.js')], path.join(t.context.tmp, 'supportSample'), {size: 3});

	await globby(path.join(t.context.tmp, 'supportSample/*.js')).then(files => {
		t.is(files.length, 3);
	});
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
