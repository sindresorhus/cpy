import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import rimraf from 'rimraf';
import test from 'ava';
import tempy from 'tempy';
import proxyquire from 'proxyquire';
import CpyError from './cpy-error.js';
import cpy from './index.js';

const read = (...args) => fs.readFileSync(path.join(...args), 'utf8');

const cpyMockedError = module => proxyquire('.', {
	[module]() {
		throw new Error(`${module}:\tERROR`);
	},
});

test.beforeEach(t => {
	t.context.tmp = tempy.file();
	t.context.dir = tempy.directory();
});

test.afterEach(t => {
	rimraf.sync(t.context.tmp);
	rimraf.sync(t.context.dir);
});

test('reject Errors on missing `source`', async t => {
	await t.throwsAsync(cpy, {message: /`source`/, instanceOf: CpyError});

	await t.throwsAsync(cpy(null, 'destination'), {message: /`source`/, instanceOf: CpyError});

	await t.throwsAsync(cpy([], 'destination'), {message: /`source`/, instanceOf: CpyError});
});

test('reject Errors on missing `destination`', async t => {
	await t.throwsAsync(cpy('TARGET'), {message: /`destination`/, instanceOf: CpyError});
});

test('copy single file', async t => {
	await cpy('license', t.context.tmp);

	t.is(read('license'), read(t.context.tmp, 'license'));
});

test('copy array of files', async t => {
	await cpy(['license', 'package.json'], t.context.tmp);

	t.is(read('license'), read(t.context.tmp, 'license'));
	t.is(read('package.json'), read(t.context.tmp, 'package.json'));
});

test('throws on invalid concurrency value', async t => {
	await t.throwsAsync(
		cpy(['license', 'package.json'], t.context.tmp, {concurrency: -2}),
	);
	await t.throwsAsync(
		cpy(['license', 'package.json'], t.context.tmp, {concurrency: 'foo'}),
	);
});

test('copy array of files with filter', async t => {
	await cpy(['license', 'package.json'], t.context.tmp, {
		filter: file => {
			if (file.path.endsWith('license')) {
				t.is(file.path, path.join(process.cwd(), 'license'));
				t.is(file.name, 'license');
				t.is(file.nameWithoutExtension, 'license');
				t.is(file.extension, '');
			} else if (file.path.endsWith('package.json')) {
				t.is(file.path, path.join(process.cwd(), 'package.json'));
				t.is(file.name, 'package.json');
				t.is(file.nameWithoutExtension, 'package');
				t.is(file.extension, 'json');
			}

			return !file.path.endsWith('license');
		},
	});

	t.false(fs.existsSync(path.join(t.context.tmp, 'license')));
	t.is(read('package.json'), read(t.context.tmp, 'package.json'));
});

test('copy array of files with async filter', async t => {
	await cpy(['license', 'package.json'], t.context.tmp, {
		filter: async file => {
			if (file.path.endsWith(`${path.sep}license`)) {
				t.is(file.path, path.join(process.cwd(), 'license'));
				t.is(file.name, 'license');
				t.is(file.nameWithoutExtension, 'license');
				t.is(file.extension, '');
			} else if (file.path.endsWith(`${path.sep}package.json`)) {
				t.is(file.path, path.join(process.cwd(), 'package.json'));
				t.is(file.name, 'package.json');
				t.is(file.nameWithoutExtension, 'package');
				t.is(file.extension, 'json');
			}

			return !file.path.endsWith(`${path.sep}license`);
		},
	});

	t.false(fs.existsSync(path.join(t.context.tmp, 'license')));
	t.is(read('package.json'), read(t.context.tmp, 'package.json'));
});

test('cwd', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['hello.js'], 'destination', {
		cwd: path.join(t.context.tmp, 'cwd'),
	});

	t.is(
		read(t.context.tmp, 'cwd/hello.js'),
		read(t.context.tmp, 'cwd/destination/hello.js'),
	);
});

test('do not overwrite', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'license'), '');

	await t.throwsAsync(cpy(['license'], t.context.tmp, {overwrite: false}));

	t.is(read(t.context.tmp, 'license'), '');
});

test('do not keep path structure', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(t.context.tmp, 'cwd/hello.js')], t.context.tmp);

	t.is(read(t.context.tmp, 'cwd/hello.js'), read(t.context.tmp, 'hello.js'));
});

test('path structure', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.mkdirSync(path.join(t.context.tmp, 'out'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(t.context.tmp, '**')], path.join(t.context.tmp, 'out'));

	t.is(
		read(t.context.tmp, 'cwd/hello.js'),
		read(t.context.tmp, 'out', 'cwd/hello.js'),
	);
});

test('rename filenames but not filepaths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'hello.js'),
		'console.log("hello");',
	);
	fs.writeFileSync(
		path.join(t.context.tmp, 'source/hello.js'),
		'console.log("hello");',
	);

	await cpy(['hello.js', 'source/hello.js'], 'destination/subdir', {
		cwd: t.context.tmp,
		rename: 'hi.js',
	});

	t.is(
		read(t.context.tmp, 'hello.js'),
		read(t.context.tmp, 'destination/subdir/hi.js'),
	);
	t.is(
		read(t.context.tmp, 'source/hello.js'),
		read(t.context.tmp, 'destination/subdir/source/hi.js'),
	);
});

test('rename filenames using a function', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.writeFileSync(path.join(t.context.tmp, 'foo.js'), 'console.log("foo");');
	fs.writeFileSync(
		path.join(t.context.tmp, 'source/bar.js'),
		'console.log("bar");',
	);

	await cpy(['foo.js', 'source/bar.js'], 'destination/subdir', {
		cwd: t.context.tmp,
		rename: basename => `prefix-${basename}`,
	});

	t.is(
		read(t.context.tmp, 'foo.js'),
		read(t.context.tmp, 'destination/subdir/prefix-foo.js'),
	);
	t.is(
		read(t.context.tmp, 'source/bar.js'),
		read(t.context.tmp, 'destination/subdir/source/prefix-bar.js'),
	);
});

test('flatten directory tree', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.mkdirSync(path.join(t.context.tmp, 'source', 'nested'));
	fs.writeFileSync(path.join(t.context.tmp, 'foo.js'), 'console.log("foo");');
	fs.writeFileSync(
		path.join(t.context.tmp, 'source/bar.js'),
		'console.log("bar");',
	);
	fs.writeFileSync(
		path.join(t.context.tmp, 'source/nested/baz.ts'),
		'console.log("baz");',
	);

	await cpy('**/*.js', 'destination/subdir', {
		cwd: t.context.tmp,
		flat: true,
	});

	t.is(
		read(t.context.tmp, 'foo.js'),
		read(t.context.tmp, 'destination/subdir/foo.js'),
	);
	t.is(
		read(t.context.tmp, 'source/bar.js'),
		read(t.context.tmp, 'destination/subdir/bar.js'),
	);
	t.falsy(
		fs.existsSync(path.join(t.context.tmp, 'destination/subdir/baz.ts')),
	);
});

// TODO: Enable again when ESM supports mocking.
// eslint-disable-next-line ava/no-skip-test
test.skip('cp-file errors are CpyErrors', async t => {
	const cpy = cpyMockedError('cp-file');
	await t.throwsAsync(cpy('license', t.context.dir), {message: /cp-file/, instanceOf: CpyError});
});

test('throws on non-existing file', async t => {
	fs.mkdirSync(t.context.tmp);

	await t.throwsAsync(cpy(['no-file'], t.context.tmp), {
		instanceOf: CpyError,
	});
});

test('throws on multiple non-existing files', async t => {
	fs.mkdirSync(t.context.tmp);

	await t.throwsAsync(cpy(['no-file1', 'no-file2'], t.context.tmp), {
		instanceOf: CpyError,
	});
});

test('does not throw when not matching any file on glob pattern', async t => {
	fs.mkdirSync(t.context.tmp);

	await t.notThrowsAsync(cpy(['*.nonexistent'], t.context.tmp));
});

test('junk files are ignored', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/Thumbs.db'), 'lorem ipsum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy('*', t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
		ignoreJunk: true,
	}).on('progress', event => {
		report = event;
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 1);
	t.is(report.completedFiles, 1);
	t.is(report.completedSize, 11);
	t.is(report.percent, 1);
});

test('junk files are copied', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/Thumbs.db'), 'lorem ipsum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy('*', t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
		ignoreJunk: false,
	}).on('progress', event => {
		report = event;
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 2);
	t.is(report.completedFiles, 2);
	t.is(report.completedSize, 22);
	t.is(report.percent, 1);
});

test('nested junk files are ignored', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/Thumbs.db'), 'lorem ispum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/test'), 'lorem ispum');

	let report;

	await cpy(['cwd/*'], t.context.tmp, {
		cwd: t.context.tmp,
		ignoreJunk: true,
	}).on('progress', event => {
		report = event;
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 1);
	t.is(report.completedFiles, 1);
	t.is(report.completedSize, 11);
	t.is(report.percent, 1);
});

test('reports copy progress of single file', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy(['foo'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
	}).on('progress', event => {
		report = event;
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 1);
	t.is(report.completedFiles, 1);
	t.is(report.completedSize, 11);
	t.is(report.percent, 1);
});

test('reports copy progress of multiple files', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/bar'), 'dolor sit amet');

	let report;

	await cpy(['foo', 'bar'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
	}).on('progress', event => {
		report = event;
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 2);
	t.is(report.completedFiles, 2);
	t.is(report.completedSize, 25);
	t.is(report.percent, 1);
});

test('reports correct completedSize', async t => {
	const ONE_MEGABYTE = (1 * 1024 * 1024) + 1;
	const buf = crypto.randomBytes(ONE_MEGABYTE);

	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/fatfile'), buf);

	let report;
	let chunkCount = 0;

	await cpy(['fatfile'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
	}).on('progress', event => {
		chunkCount++;
		report = event;
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 1);
	t.is(report.completedFiles, 1);
	t.is(report.completedSize, ONE_MEGABYTE);
	t.true(chunkCount > 1);
	t.is(report.percent, 1);
});

test('returns the event emitter on early rejection', t => {
	const rejectedPromise = cpy(null, null);
	t.is(typeof rejectedPromise.on, 'function');
	rejectedPromise.catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
});

test('returns destination path', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/bar'), 'dolor sit amet');

	const to = await cpy(['foo', 'bar'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
	});

	t.deepEqual(to, [
		path.join(t.context.tmp, 'foo'),
		path.join(t.context.tmp, 'bar'),
	]);
});
