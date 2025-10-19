import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {rimrafSync} from 'rimraf';
import test from 'ava';
import {temporaryFile, temporaryDirectory} from 'tempy';
import proxyquire from 'proxyquire';
import CpyError from './cpy-error.js';
import cpy from './index.js';

const read = (...arguments_) => fs.readFileSync(path.join(...arguments_), 'utf8');

const cpyMockedError = module => proxyquire('.', {
	[module]() {
		throw new Error(`${module}:\tERROR`);
	},
});

test.beforeEach(t => {
	t.context.tmp = temporaryFile();
	t.context.dir = temporaryDirectory();
});

test.afterEach(t => {
	rimrafSync(t.context.tmp);
	rimrafSync(t.context.dir);
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
	await t.throwsAsync(cpy(['license', 'package.json'], t.context.tmp, {concurrency: -2}));
	await t.throwsAsync(cpy(['license', 'package.json'], t.context.tmp, {concurrency: 'foo'}));
});

test('copy array of files with filter', async t => {
	await cpy(['license', 'package.json'], t.context.tmp, {
		filter(file) {
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
		async filter(file) {
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

test('cwd with glob *', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['*'], 'destination', {
		cwd: path.join(t.context.tmp, 'cwd'),
	});

	t.is(
		read(t.context.tmp, 'cwd/hello.js'),
		read(t.context.tmp, 'cwd/destination/hello.js'),
	);
});

test('cwd with glob * and relative destination', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['*'], '../destination', {
		cwd: path.join(t.context.tmp, 'cwd'),
	});

	t.is(
		read(t.context.tmp, 'cwd/hello.js'),
		read(t.context.tmp, 'destination/hello.js'),
	);
});

test('cwd with glob ./*', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['./*'], 'destination', {
		cwd: path.join(t.context.tmp, 'cwd'),
	});

	t.is(
		read(t.context.tmp, 'cwd/hello.js'),
		read(t.context.tmp, 'cwd/destination/hello.js'),
	);
});

test('glob with redundant parent segments in pattern is normalized', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'src/nested'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'src/nested/file.js'), 'x');

	await cpy(['src/../src/**/*.js'], 'out', {cwd: t.context.tmp});

	t.true(fs.existsSync(path.join(t.context.tmp, 'out/nested/file.js')));
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

test('directory source outside cwd preserves structure under destination', async t => {
	const root = temporaryDirectory();
	const cwd = path.join(root, 'cwd');
	const src = path.join(root, 'src');
	const out = path.join(cwd, 'out');
	fs.mkdirSync(path.join(src, 'nested'), {recursive: true});
	fs.mkdirSync(cwd, {recursive: true});
	fs.writeFileSync(path.join(src, 'a.txt'), 'A');
	fs.writeFileSync(path.join(src, 'nested', 'b.txt'), 'B');

	await cpy(['../src'], 'out', {cwd});

	t.is(read(src, 'a.txt'), read(out, 'src/a.txt'));
	t.is(read(src, 'nested/b.txt'), read(out, 'src/nested/b.txt'));
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

test('rename string: rejects path separators and traversal', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'a.js'), 'A');

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: '../evil.js'}),
		{instanceOf: TypeError, message: /must not contain path separators|filename/},
	);

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: 'dir/evil.js'}),
		{instanceOf: TypeError, message: /must not contain path separators|filename/},
	);
});

test('rename: rejects empty and dot names', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'a.js'), 'A');

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: ''}),
		{instanceOf: TypeError, message: /valid filename/},
	);

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: '.'}),
		{instanceOf: TypeError, message: /valid filename/},
	);

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: '..'}),
		{instanceOf: TypeError, message: /valid filename/},
	);
});

test('rename function: rejects path separators and traversal', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'a.js'), 'A');

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: () => '../evil.js'}),
		{instanceOf: TypeError, message: /must not contain path separators|filename/},
	);

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: () => 'dir/evil.js'}),
		{instanceOf: TypeError, message: /must not contain path separators|filename/},
	);
});

test('rename function: rejects non-string return values', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'a.js'), 'A');

	await t.throwsAsync(
		cpy(['a.js'], 'out', {cwd: t.context.tmp, rename: () => 42}),
		{instanceOf: TypeError, message: /must return a string/},
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

test('rename function receives the basename argument with the file extension', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'foo.js'), '');
	fs.writeFileSync(path.join(t.context.tmp, 'foo.ts'), '');

	const visited = [];
	await cpy(['foo.js', 'foo.ts'], 'destination/subdir', {
		cwd: t.context.tmp,
		rename(basename) {
			visited.push(basename);
			return basename;
		},
	});

	t.is(visited.length, 2);
	t.true(visited.includes('foo.js'));
	t.true(visited.includes('foo.ts'));
});

test('rename at the same directory', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'dest'));
	fs.writeFileSync(path.join(t.context.tmp, 'hello.js'), 'console.log("hello");');

	await cpy(['hello.js'], './', {
		cwd: t.context.tmp,
		rename: 'file-renamed.js',
	});

	t.is(read(t.context.tmp, 'file-renamed.js'), 'console.log("hello");');
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
	t.falsy(fs.existsSync(path.join(t.context.tmp, 'destination/subdir/baz.ts')));
});

test('flatten single file', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'source/bar.js'),
		'console.log("bar");',
	);

	await cpy('source/bar.js', 'destination', {
		cwd: t.context.tmp,
		flat: true,
	});

	t.is(
		read(t.context.tmp, 'source/bar.js'),
		read(t.context.tmp, 'destination/bar.js'),
	);
});

test('pattern with Windows-style backslashes is normalized', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.writeFileSync(path.join(t.context.tmp, 'source', 'hello.js'), 'console.log("hello");');

	await cpy([String.raw`source\hello.js`], 'dest', {cwd: t.context.tmp});

	t.is(
		read(t.context.tmp, 'source/hello.js'),
		read(t.context.tmp, 'dest/source/hello.js'),
	);
});

// TODO: Enable again when ESM supports mocking.
// eslint-disable-next-line ava/no-skip-test
test.skip('copy-file errors are CpyErrors', async t => {
	const cpy = cpyMockedError('copy-file');
	await t.throwsAsync(cpy('license', t.context.dir), {message: /copy-file/, instanceOf: CpyError});
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
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/foo'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/cwd/foo'));
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
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/foo'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/cwd/foo'));
});

test('nested junk files are ignored', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/Thumbs.db'), 'lorem ipsum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/test'), 'lorem ipsum');

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
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/test'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/test'));
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
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/foo'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/foo'));
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
	// Final progress event may correspond to any file due to concurrency; don't assume order
	const finalSourceBase = path.basename(report.sourcePath);
	const finalDestBase = path.basename(report.destinationPath);
	t.true(['foo', 'bar'].includes(finalSourceBase));
	t.is(finalSourceBase, finalDestBase);
	// Verify content equality between reported source and destination
	t.is(read(report.destinationPath), read(report.sourcePath));
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
	t.is(read(report.sourcePath), read(t.context.tmp, 'cwd/fatfile'));
	t.is(read(report.destinationPath), read(t.context.tmp, 'fatfile'));
	t.true(chunkCount > 1);
	t.is(report.percent, 1);
});

test('reports copy progress of single file with onProgress option', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy(['foo'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
		onProgress(event) {
			report = event;
		},
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 1);
	t.is(report.completedFiles, 1);
	t.is(report.completedSize, 11);
	t.is(report.percent, 1);
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/foo'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/foo'));
});

test('reports copy progress of multiple files with onProgress option', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/foo'), 'lorem ipsum');
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/bar'), 'dolor sit amet');

	let report;

	await cpy(['foo', 'bar'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
		onProgress(event) {
			report = event;
		},
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 2);
	t.is(report.completedFiles, 2);
	t.is(report.completedSize, 25);
	t.is(report.percent, 1);
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/bar'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/bar'));
});

test('reports correct completedSize with onProgress option', async t => {
	const ONE_MEGABYTE = (1 * 1024 * 1024) + 1;
	const buf = crypto.randomBytes(ONE_MEGABYTE);

	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'cwd'));
	fs.writeFileSync(path.join(t.context.tmp, 'cwd/fatfile'), buf);

	let report;
	let chunkCount = 0;

	await cpy(['fatfile'], t.context.tmp, {
		cwd: path.join(t.context.tmp, 'cwd'),
		onProgress(event) {
			chunkCount++;
			report = event;
		},
	});

	t.not(report, undefined);
	t.is(report.totalFiles, 1);
	t.is(report.completedFiles, 1);
	t.is(report.completedSize, ONE_MEGABYTE);
	t.is(read(report.sourcePath), read(t.context.tmp, 'cwd/fatfile'));
	t.is(read(report.destinationPath), read(t.context.tmp, 'fatfile'));
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

test('absolute directory source paths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.mkdirSync(path.join(t.context.tmp, 'out'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'source/hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(t.context.tmp, 'source')], path.join(t.context.tmp, 'out'));

	t.is(
		read(t.context.tmp, 'source/hello.js'),
		read(t.context.tmp, 'out/hello.js'),
	);
});

test('absolute file source paths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'out'));
	fs.writeFileSync(
		path.join(t.context.tmp, 'hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(t.context.tmp, 'hello.js')], path.join(t.context.tmp, 'out'));

	t.is(
		read(t.context.tmp, 'hello.js'),
		read(t.context.tmp, 'out/hello.js'),
	);
});

test('negative patterns', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.mkdirSync(path.join(t.context.tmp, 'out'));
	fs.writeFileSync(path.join(t.context.tmp, 'source/keep.js'), 'console.log("keep");');
	fs.writeFileSync(path.join(t.context.tmp, 'source/ignore.js'), 'console.log("ignore");');
	fs.writeFileSync(path.join(t.context.tmp, 'source/also-keep.txt'), 'keep this');

	await cpy(['source/*', '!source/ignore.js'], path.join(t.context.tmp, 'out'), {
		cwd: t.context.tmp,
	});

	t.is(
		read(t.context.tmp, 'source/keep.js'),
		read(t.context.tmp, 'out/keep.js'),
	);
	t.is(
		read(t.context.tmp, 'source/also-keep.txt'),
		read(t.context.tmp, 'out/also-keep.txt'),
	);
	t.false(fs.existsSync(path.join(t.context.tmp, 'out/ignore.js')));
});

test('recursive directory copying', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'source'));
	fs.mkdirSync(path.join(t.context.tmp, 'source/nested'));
	fs.mkdirSync(path.join(t.context.tmp, 'source/nested/deep'));
	fs.mkdirSync(path.join(t.context.tmp, 'out'));

	fs.writeFileSync(path.join(t.context.tmp, 'source/file1.js'), 'console.log("file1");');
	fs.writeFileSync(path.join(t.context.tmp, 'source/nested/file2.js'), 'console.log("file2");');
	fs.writeFileSync(path.join(t.context.tmp, 'source/nested/deep/file3.js'), 'console.log("file3");');

	await cpy(['source/**'], path.join(t.context.tmp, 'out'), {
		cwd: t.context.tmp,
	});

	t.is(
		read(t.context.tmp, 'source/file1.js'),
		read(t.context.tmp, 'out/file1.js'),
	);
	t.is(
		read(t.context.tmp, 'source/nested/file2.js'),
		read(t.context.tmp, 'out/nested/file2.js'),
	);
	t.is(
		read(t.context.tmp, 'source/nested/deep/file3.js'),
		read(t.context.tmp, 'out/nested/deep/file3.js'),
	);
});

// #114 – absolute cwd + absolute destination must not self-copy or escape dest
test('absolute cwd + absolute dest: preserves structure from cwd and never self-copies', async t => {
	const root = temporaryDirectory();
	const source = path.join(root, 'project', 'packages', 'pkg-name');
	const dest = path.join(root, 'project', 'build', 'packages', 'pkg-name');

	// Source tree
	fs.mkdirSync(path.join(source, 'src', 'nested'), {recursive: true});
	const fileA = path.join(source, 'src', 'example.ts');
	const fileB = path.join(source, 'src', 'nested', 'deep.ts');
	fs.writeFileSync(fileA, 'console.log("A");\n');
	fs.writeFileSync(fileB, 'console.log("B");\n');

	// Copy everything except tsx/tests/node_modules (like the issue)
	const globs = [
		'**/*',
		'!**/node_modules/**',
		'!**/*.test.*',
		'!**/__snapshots__/**',
		'!**/__fixtures__/**',
		'!**/__mocks__/**',
	];

	await cpy(globs, dest, {cwd: source});

	// Destination must contain files under dest (no `..` escapes)
	const outA = path.join(dest, 'src', 'example.ts');
	const outB = path.join(dest, 'src', 'nested', 'deep.ts');

	t.true(fs.existsSync(outA));
	t.true(fs.existsSync(outB));

	// Ensure content intact (no truncation / self-copy)
	t.is(fs.readFileSync(outA, 'utf8'), fs.readFileSync(fileA, 'utf8'));
	t.is(fs.readFileSync(outB, 'utf8'), fs.readFileSync(fileB, 'utf8'));

	// Sanity: every created file path starts with dest (no traversal)
	const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
		const p = path.join(dir, d.name);
		return d.isDirectory() ? walk(p) : [p];
	});
	for (const p of walk(dest)) {
		t.true(p.startsWith(dest));
	}
});

// #114 – when glob parent and destination share ancestry, output still stays inside dest
test('never joins a path that resolves back to the source (guards against data loss)', async t => {
	const root = temporaryDirectory();
	const repo = path.join(root, 'repo');
	const source = path.join(repo, 'packages', 'alpha');
	const dest = path.join(repo, 'build', 'packages', 'alpha');

	fs.mkdirSync(path.join(source, 'dir'), {recursive: true});
	const file = path.join(source, 'dir', 'file.txt');
	fs.writeFileSync(file, 'x'.repeat(8192)); // Sizeable to catch truncation

	await cpy(['**/*'], dest, {cwd: source});

	const out = path.join(dest, 'dir', 'file.txt');
	t.true(fs.existsSync(out));
	t.is(fs.readFileSync(out, 'utf8'), fs.readFileSync(file, 'utf8'));

	// Ensure destination is not the same as source path
	t.not(path.resolve(out), path.resolve(file));
});

test('deeply nested ../ in source and dest', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'a/b/c/d/e/f'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'a/b/target.txt'), 'target');

	await cpy(['../../../../target.txt'], '../../../../output', {cwd: path.join(t.context.tmp, 'a/b/c/d/e/f')});

	t.is(read(t.context.tmp, 'a/b/target.txt'), read(t.context.tmp, 'a/b/output/target.txt'));
});

test('mixed ../ and ./ in paths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'src/sub'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'file.txt'), 'content');

	await cpy(['../../file.txt'], '.././../output', {cwd: path.join(t.context.tmp, 'src/sub')});

	t.is(read(t.context.tmp, 'file.txt'), read(t.context.tmp, 'output/file.txt'));
});

test('redundant path segments', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'nested/file.txt'), 'content');

	const results = await cpy(['./nested/../nested/file.txt'], './output', {cwd: t.context.tmp});

	t.is(results.length, 1);
	t.true(fs.existsSync(results[0]));
	t.is(fs.readFileSync(results[0], 'utf8'), 'content');
});

test('empty path segments', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'file.txt'), 'content');

	await cpy(['./file.txt'], 'output//subdir', {cwd: t.context.tmp});

	t.is(read(t.context.tmp, 'file.txt'), read(t.context.tmp, 'output/subdir/file.txt'));
});

test('current directory references', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.writeFileSync(path.join(t.context.tmp, 'file.txt'), 'content');

	await cpy(['./././file.txt'], './././output', {cwd: t.context.tmp});

	t.is(read(t.context.tmp, 'file.txt'), read(t.context.tmp, 'output/file.txt'));
});

test('source outside cwd with absolute destination', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested/deep'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'file.txt'), 'content');

	const absoluteDest = path.join(t.context.tmp, 'absolute-output');
	await cpy(['../../file.txt'], absoluteDest, {cwd: path.join(t.context.tmp, 'nested/deep')});

	t.is(read(t.context.tmp, 'file.txt'), read(t.context.tmp, 'absolute-output/file.txt'));
});

test('non-glob single file: refuse self-copy when destination resolves to source directory', async t => {
	// Arrange a file outside cwd and a destination that resolves to that same directory
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested'), {recursive: true});
	const outsideFile = path.join(t.context.tmp, 'file.txt');
	fs.writeFileSync(outsideFile, 'self-copy-guard');

	const cwd = path.join(t.context.tmp, 'nested');

	// Act + Assert
	await t.throwsAsync(
		cpy(['../file.txt'], '../', {cwd}),
		{instanceOf: CpyError, message: /Refusing to copy to itself/},
	);

	// Ensure content intact
	t.is(fs.readFileSync(outsideFile, 'utf8'), 'self-copy-guard');
});

test('non-glob single file inside cwd: refuse self-copy when destination is current directory', async t => {
	fs.mkdirSync(t.context.tmp);
	const cwd = t.context.tmp;
	const src = path.join(cwd, 'same.txt');
	fs.writeFileSync(src, 'same');

	await t.throwsAsync(
		cpy(['same.txt'], '.', {cwd}),
		{instanceOf: CpyError, message: /Refusing to copy to itself/},
	);

	t.is(fs.readFileSync(src, 'utf8'), 'same');
});

test('source and dest both with trailing slashes', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'nested/file.txt'), 'content');

	await cpy(['../nested/file.txt'], '../output/', {cwd: path.join(t.context.tmp, 'nested')});

	t.is(read(t.context.tmp, 'nested/file.txt'), read(t.context.tmp, 'output/file.txt'));
});

test('both source and dest with ../ paths', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested/deep'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'nested/file.txt'), 'content');

	await cpy(['../file.txt'], '../output', {cwd: path.join(t.context.tmp, 'nested/deep')});

	t.is(read(t.context.tmp, 'nested/file.txt'), read(t.context.tmp, 'nested/output/file.txt'));
	t.true(fs.existsSync(path.join(t.context.tmp, 'nested/output/file.txt')));
});

test('multiple ../ in both source and dest', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'a/b/c/d'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'a/b/target.txt'), 'target');

	await cpy(['../../target.txt'], '../../output', {cwd: path.join(t.context.tmp, 'a/b/c/d')});

	t.is(read(t.context.tmp, 'a/b/target.txt'), read(t.context.tmp, 'a/b/output/target.txt'));
	t.true(fs.existsSync(path.join(t.context.tmp, 'a/b/output/target.txt')));
});

test('source with ./ prefix and ../ destination', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'nested/file.txt'), 'content');

	await cpy(['./file.txt'], '../output', {cwd: path.join(t.context.tmp, 'nested')});

	t.is(read(t.context.tmp, 'nested/file.txt'), read(t.context.tmp, 'output/file.txt'));
});

test('absolute source with relative destination', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'file.txt'), 'content');

	await cpy([path.join(t.context.tmp, 'file.txt')], '../output', {cwd: path.join(t.context.tmp, 'nested')});

	t.is(read(t.context.tmp, 'file.txt'), read(t.context.tmp, 'output/file.txt'));
});

test('glob with ../ and flat option', async t => {
	fs.mkdirSync(t.context.tmp);
	fs.mkdirSync(path.join(t.context.tmp, 'nested/deep'), {recursive: true});
	fs.writeFileSync(path.join(t.context.tmp, 'file1.js'), 'js1');
	fs.writeFileSync(path.join(t.context.tmp, 'file2.js'), 'js2');

	await cpy(['../../*.js'], '../output', {cwd: path.join(t.context.tmp, 'nested/deep'), flat: true});

	t.is(read(t.context.tmp, 'file1.js'), read(t.context.tmp, 'nested/output/file1.js'));
	t.is(read(t.context.tmp, 'file2.js'), read(t.context.tmp, 'nested/output/file2.js'));
});

test('relative source outside cwd to relative destination', async t => {
	const testRoot = temporaryDirectory();

	fs.mkdirSync(path.join(testRoot, 'cwd'), {recursive: true});
	fs.mkdirSync(path.join(testRoot, 'src/a/b'), {recursive: true});
	fs.writeFileSync(path.join(testRoot, 'src/a/b/foo.txt'), 'test content');

	try {
		await cpy(['../src/a/b/foo.txt'], '../dest', {
			cwd: path.join(testRoot, 'cwd'),
		});

		t.true(fs.existsSync(path.join(testRoot, 'dest/foo.txt')));
		t.is(read(testRoot, 'dest/foo.txt'), 'test content');

		t.true(fs.existsSync(path.join(testRoot, 'src/a/b/foo.txt')));
	} finally {
		rimrafSync(testRoot);
	}
});

test('glob with flat and absolute destination', async t => {
	fs.mkdirSync(t.context.tmp);
	const cwd = path.join(t.context.tmp, 'proj');
	const absDest = path.join(t.context.tmp, 'abs-out');

	fs.mkdirSync(path.join(cwd, 'src', 'nested'), {recursive: true});
	fs.writeFileSync(path.join(cwd, 'a.js'), 'A');
	fs.writeFileSync(path.join(cwd, 'src', 'b.js'), 'B');
	fs.writeFileSync(path.join(cwd, 'src', 'nested', 'c.ts'), 'C');

	await cpy('**/*.js', absDest, {cwd, flat: true});

	// Only files, flattened; retains extensions; ignores directories
	t.true(fs.existsSync(path.join(absDest, 'a.js')));
	t.true(fs.existsSync(path.join(absDest, 'b.js')));
	t.false(fs.existsSync(path.join(absDest, 'c.ts')));
});
