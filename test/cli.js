import path from 'path';
import fs from 'fs';
import test from 'ava';
import tempfile from 'tempfile';
import execa from 'execa';
import pathExists from 'path-exists';

global.Promise = Promise;

function read() {
	return fs.readFileSync(path.join.apply(path, arguments), 'utf8');
}

test.beforeEach(t => {
	t.context.tmp = tempfile();
});

test('missing file operands', t => {
	t.throws(execa('../cli.js'), /`src` and `dest` required/);
});

test('source file does not exist', t => {
	t.throws(execa('../cli.js', [path.join(t.context.tmp, 'nonexistentfile'), t.context.tmp]), /nonexistentfile/);
});

test('cwd', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await execa('../cli.js', ['hello.js', 'dest', '--cwd', path.join(t.context.tmp, 'cwd')]);

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(path.join(t.context.tmp, 'cwd/dest/hello.js')));
});

test('keep path structure with flag "--parents"', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/hello.js'), 'console.log("hello");');

	await execa('../cli.js', [path.join(t.context.tmp, 'cwd/hello.js'), t.context.tmp, '--parents']);

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(path.join(t.context.tmp, t.context.tmp, 'cwd/hello.js')));
});

test('rename filenames but not filepaths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'dest'));
	fs.writeFileSync(path.join(t.context.tmp, 'hello.js'), 'console.log("hello");');

	await execa('../cli.js', [path.join(t.context.tmp, 'hello.js'), path.join(t.context.tmp, 'dest'), '--rename=hi.js']);

	t.is(read(t.context.tmp, 'hello.js'), read(path.join(t.context.tmp, 'dest/hi.js')));
});

test('overwrite files by default', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'dest'));
	fs.writeFileSync(path.join(t.context.tmp, 'hello.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'dest/hello.js'), 'console.log("world");');

	await execa('../cli.js', [path.join(t.context.tmp, 'hello.js'), path.join(t.context.tmp, 'dest')]);

	t.is(read(t.context.tmp, 'dest/hello.js'), 'console.log("hello");');
});

test('do not copy files in the ngated glob patterns', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'src'));
	fs.mkdirSync(path.join(t.context.tmp, 'dest'));
	fs.writeFileSync(path.join(t.context.tmp, 'src/hello.js'), 'console.log("hello");');
	fs.writeFileSync(path.join(t.context.tmp, 'src/hello.jsx'), 'console.log("world");');
	fs.writeFileSync(path.join(t.context.tmp, 'src/hello.es6'), 'console.log("world");');

	await execa('../cli.js', ['src/*.*', '!src/*.jsx', '!src/*.es6', 'dest', '--cwd', t.context.tmp]);

	t.is(read(t.context.tmp, 'dest/hello.js'), 'console.log("hello");');
	t.false(pathExists.sync(path.join(t.context.tmp, 'dest/hello.jsx')));
	t.false(pathExists.sync(path.join(t.context.tmp, 'dest/hello.es6')));
});
