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
	t.is(read(report.sourcePath), read(t.context.tmp + '/cwd/bar'));
	t.is(read(report.destinationPath), read(t.context.tmp + '/bar'));
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
