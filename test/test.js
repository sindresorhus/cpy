import path from 'path';
import fs from 'fs';
import test from 'ava';
import tempfile from 'tempfile';
import fn from '../';

function read() {
	return fs.readFileSync(path.join.apply(path, arguments), 'utf8');
}

test.beforeEach(t => {
	t.context.tmp = tempfile();
});

test('copy files', async t => {
	await fn(['../license', '../package.json'], t.context.tmp);

	t.is(read('../license'), read(path.join(t.context.tmp, 'license')));
	t.is(read('../package.json'), read(path.join(t.context.tmp, 'package.json')));
});

test('cwd', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await fn(['hello.js'], 'dest', {cwd: path.join(t.context.tmp, 'cwd')});

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(path.join(t.context.tmp, 'cwd/dest/hello.js')));
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

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(path.join(t.context.tmp, 'hello.js')));
});

test('path structure', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await fn([path.join(t.context.tmp, 'cwd/hello.js')], t.context.tmp, {parents: true});

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(path.join(t.context.tmp, t.context.tmp, 'cwd/hello.js')));
});

test('rename filenames but not filepaths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'src'));
	fs.writeFileSync(path.join(t.context.tmp, 'hello.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'src/hello.js'), 'console.log("hello");');

	const opts = {cwd: t.context.tmp, parents: true, rename: 'hi.js'};

	await fn(['hello.js', 'src/hello.js'], 'dest/subdir', opts);

	t.is(read(t.context.tmp, 'hello.js'), read(path.join(t.context.tmp, 'dest/subdir/hi.js')));
	t.is(read(t.context.tmp, 'src/hello.js'), read(path.join(t.context.tmp, 'dest/subdir/src/hi.js')));
});
