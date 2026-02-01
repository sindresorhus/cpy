import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert';
import {rimrafSync} from 'rimraf';
import {temporaryFile, temporaryDirectory} from 'tempy';
import proxyquire from 'proxyquire';
import CpyError from './cpy-error.js';
import cpy from './index.js';

// Helpers
const read = (...arguments_) => fs.readFileSync(path.join(...arguments_), 'utf8');

const cpyMockedError = module => proxyquire('.', {
	[module]() {
		throw new Error(`${module}:\tERROR`);
	},
});

const expectError = (errorClass, messagePattern) => error => {
	assert.ok(error instanceof errorClass, `Expected ${errorClass.name}, got ${error.constructor.name}`);
	if (messagePattern) {
		assert.match(error.message, messagePattern);
	}

	return true;
};

const writeFiles = (base, files) => {
	for (const [file, content] of Object.entries(files)) {
		const filePath = path.join(base, file);
		fs.mkdirSync(path.dirname(filePath), {recursive: true});
		fs.writeFileSync(filePath, content);
	}
};

const context = {};

beforeEach(() => {
	context.tmp = temporaryFile();
	context.dir = temporaryDirectory();
	fs.mkdirSync(context.tmp, {recursive: true});
});

afterEach(() => {
	rimrafSync(context.tmp);
	rimrafSync(context.dir);
});

test('reject Errors on missing `source`', async () => {
	await assert.rejects(cpy(), expectError(CpyError, /`source`/));

	await assert.rejects(cpy(null, 'destination'), expectError(CpyError, /`source`/));

	await assert.rejects(cpy([], 'destination'), expectError(CpyError, /`source`/));
});

test('reject Errors on missing `destination`', async () => {
	await assert.rejects(cpy('TARGET'), expectError(CpyError, /`destination`/));
});

test('copy single file', async () => {
	await cpy('license', context.tmp);

	assert.strictEqual(read('license'), read(context.tmp, 'license'));
});

test('copy array of files', async () => {
	await cpy(['license', 'package.json'], context.tmp);

	assert.strictEqual(read('license'), read(context.tmp, 'license'));
	assert.strictEqual(read('package.json'), read(context.tmp, 'package.json'));
});

test('throws on invalid concurrency value', async () => {
	await assert.rejects(cpy(['license', 'package.json'], context.tmp, {concurrency: -2}));
	await assert.rejects(cpy(['license', 'package.json'], context.tmp, {concurrency: 'foo'}));
});

test('copy array of files with filter', async () => {
	await cpy(['license', 'package.json'], context.tmp, {
		filter(file) {
			if (file.path.endsWith('license')) {
				assert.strictEqual(file.path, path.join(process.cwd(), 'license'));
				assert.strictEqual(file.name, 'license');
				assert.strictEqual(file.nameWithoutExtension, 'license');
				assert.strictEqual(file.extension, '');
			} else if (file.path.endsWith('package.json')) {
				assert.strictEqual(file.path, path.join(process.cwd(), 'package.json'));
				assert.strictEqual(file.name, 'package.json');
				assert.strictEqual(file.nameWithoutExtension, 'package');
				assert.strictEqual(file.extension, 'json');
			}

			return !file.path.endsWith('license');
		},
	});

	assert.ok(!fs.existsSync(path.join(context.tmp, 'license')));
	assert.strictEqual(read('package.json'), read(context.tmp, 'package.json'));
});

test('copy array of files with async filter', async () => {
	await cpy(['license', 'package.json'], context.tmp, {
		async filter(file) {
			if (file.path.endsWith(`${path.sep}license`)) {
				assert.strictEqual(file.path, path.join(process.cwd(), 'license'));
				assert.strictEqual(file.name, 'license');
				assert.strictEqual(file.nameWithoutExtension, 'license');
				assert.strictEqual(file.extension, '');
			} else if (file.path.endsWith(`${path.sep}package.json`)) {
				assert.strictEqual(file.path, path.join(process.cwd(), 'package.json'));
				assert.strictEqual(file.name, 'package.json');
				assert.strictEqual(file.nameWithoutExtension, 'package');
				assert.strictEqual(file.extension, 'json');
			}

			return !file.path.endsWith(`${path.sep}license`);
		},
	});

	assert.ok(!fs.existsSync(path.join(context.tmp, 'license')));
	assert.strictEqual(read('package.json'), read(context.tmp, 'package.json'));
});

test('cwd', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['hello.js'], 'destination', {
		cwd: path.join(context.tmp, 'cwd'),
	});

	assert.strictEqual(
		read(context.tmp, 'cwd/hello.js'),
		read(context.tmp, 'cwd/destination/hello.js'),
	);
});

test('cwd with glob *', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['*'], 'destination', {
		cwd: path.join(context.tmp, 'cwd'),
	});

	assert.strictEqual(
		read(context.tmp, 'cwd/hello.js'),
		read(context.tmp, 'cwd/destination/hello.js'),
	);
});

test('cwd with glob * and relative destination', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['*'], '../destination', {
		cwd: path.join(context.tmp, 'cwd'),
	});

	assert.strictEqual(
		read(context.tmp, 'cwd/hello.js'),
		read(context.tmp, 'destination/hello.js'),
	);
});

test('cwd with glob ./*', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy(['./*'], 'destination', {
		cwd: path.join(context.tmp, 'cwd'),
	});

	assert.strictEqual(
		read(context.tmp, 'cwd/hello.js'),
		read(context.tmp, 'cwd/destination/hello.js'),
	);
});

test('glob with redundant parent segments in pattern is normalized', async () => {
	fs.mkdirSync(path.join(context.tmp, 'src/nested'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'src/nested/file.js'), 'x');

	await cpy(['src/../src/**/*.js'], 'out', {cwd: context.tmp});

	assert.ok(fs.existsSync(path.join(context.tmp, 'out/nested/file.js')));
});

test('do not overwrite', async () => {
	fs.writeFileSync(path.join(context.tmp, 'license'), '');

	await assert.rejects(cpy(['license'], context.tmp, {overwrite: false}));

	assert.strictEqual(read(context.tmp, 'license'), '');
});

test('do not keep path structure', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(
		path.join(context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(context.tmp, 'cwd/hello.js')], context.tmp);

	assert.strictEqual(read(context.tmp, 'cwd/hello.js'), read(context.tmp, 'hello.js'));
});

test('path structure', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.mkdirSync(path.join(context.tmp, 'out'));
	fs.writeFileSync(
		path.join(context.tmp, 'cwd/hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(context.tmp, '**')], path.join(context.tmp, 'out'));

	assert.strictEqual(
		read(context.tmp, 'cwd/hello.js'),
		read(context.tmp, 'out', 'cwd/hello.js'),
	);
});

test('directory source outside cwd preserves structure under destination', async () => {
	const root = temporaryDirectory();
	const cwd = path.join(root, 'cwd');
	const src = path.join(root, 'src');
	const out = path.join(cwd, 'out');
	fs.mkdirSync(path.join(src, 'nested'), {recursive: true});
	fs.mkdirSync(cwd, {recursive: true});
	fs.writeFileSync(path.join(src, 'a.txt'), 'A');
	fs.writeFileSync(path.join(src, 'nested', 'b.txt'), 'B');

	await cpy(['../src'], 'out', {cwd});

	assert.strictEqual(read(src, 'a.txt'), read(out, 'src/a.txt'));
	assert.strictEqual(read(src, 'nested/b.txt'), read(out, 'src/nested/b.txt'));
});

test('rename filenames but not filepaths', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.writeFileSync(
		path.join(context.tmp, 'hello.js'),
		'console.log("hello");',
	);
	fs.writeFileSync(
		path.join(context.tmp, 'source/hello.js'),
		'console.log("hello");',
	);

	await cpy(['hello.js', 'source/hello.js'], 'destination/subdir', {
		cwd: context.tmp,
		rename: 'hi.js',
	});

	assert.strictEqual(
		read(context.tmp, 'hello.js'),
		read(context.tmp, 'destination/subdir/hi.js'),
	);
	assert.strictEqual(
		read(context.tmp, 'source/hello.js'),
		read(context.tmp, 'destination/subdir/source/hi.js'),
	);
});

test('rename string: rejects path separators and traversal', async () => {
	writeFiles(context.tmp, {'a.js': 'A'});

	await assert.rejects(
		cpy(['a.js'], 'out', {cwd: context.tmp, rename: '../evil.js'}),
		expectError(TypeError, /must not contain path separators|filename/),
	);

	await assert.rejects(
		cpy(['a.js'], 'out', {cwd: context.tmp, rename: 'dir/evil.js'}),
		expectError(TypeError, /must not contain path separators|filename/),
	);
});

test('rename: rejects empty and dot names', async () => {
	writeFiles(context.tmp, {'a.js': 'A'});

	await assert.rejects(
		cpy(['a.js'], 'out', {cwd: context.tmp, rename: ''}),
		expectError(TypeError, /valid filename/),
	);

	await assert.rejects(
		cpy(['a.js'], 'out', {cwd: context.tmp, rename: '.'}),
		expectError(TypeError, /valid filename/),
	);

	await assert.rejects(
		cpy(['a.js'], 'out', {cwd: context.tmp, rename: '..'}),
		expectError(TypeError, /valid filename/),
	);
});

test('rename function: rejects path separators and traversal', async () => {
	writeFiles(context.tmp, {'a.js': 'A'});

	await assert.rejects(
		cpy(['a.js'], 'out', {
			cwd: context.tmp,
			rename(source, destination) {
				assert.strictEqual(source.name, 'a.js');
				destination.name = '../evil.js';
			},
		}),
		expectError(TypeError, /must not contain path separators|filename/),
	);

	await assert.rejects(
		cpy(['a.js'], 'out', {
			cwd: context.tmp,
			rename(source, destination) {
				assert.strictEqual(source.name, 'a.js');
				destination.name = 'dir/evil.js';
			},
		}),
		expectError(TypeError, /must not contain path separators|filename/),
	);
});

test('rename function: rejects non-string destination names', async () => {
	writeFiles(context.tmp, {'a.js': 'A'});

	await assert.rejects(
		cpy(['a.js'], 'out', {
			cwd: context.tmp,
			rename(source, destination) {
				assert.strictEqual(source.name, 'a.js');
				destination.name = 42;
			},
		}),
		expectError(TypeError, /must be a string/),
	);
});

test('rename filenames using a function', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.writeFileSync(path.join(context.tmp, 'foo.js'), 'console.log("foo");');
	fs.writeFileSync(
		path.join(context.tmp, 'source/bar.js'),
		'console.log("bar");',
	);

	await cpy(['foo.js', 'source/bar.js'], 'destination/subdir', {
		cwd: context.tmp,
		rename(source, destination) {
			assert.ok(source);
			destination.name = `prefix-${source.name}`;
		},
	});

	assert.strictEqual(
		read(context.tmp, 'foo.js'),
		read(context.tmp, 'destination/subdir/prefix-foo.js'),
	);
	assert.strictEqual(
		read(context.tmp, 'source/bar.js'),
		read(context.tmp, 'destination/subdir/source/prefix-bar.js'),
	);
});

test('rename function receives the basename argument with the file extension', async () => {
	fs.writeFileSync(path.join(context.tmp, 'foo.js'), '');
	fs.writeFileSync(path.join(context.tmp, 'foo.ts'), '');

	const visited = [];
	let warningCount = 0;
	const warningHandler = warning => {
		if (warning.code === 'CPY_RENAME_DEPRECATED') {
			warningCount++;
		}
	};

	process.on('warning', warningHandler);

	try {
		await cpy(['foo.js', 'foo.ts'], 'destination/subdir', {
			cwd: context.tmp,
			rename(basename) {
				visited.push(basename);
				return basename;
			},
		});
	} finally {
		process.removeListener('warning', warningHandler);
	}

	assert.strictEqual(visited.length, 2);
	assert.ok(visited.includes('foo.js'));
	assert.ok(visited.includes('foo.ts'));
	assert.strictEqual(warningCount, 1);
});

test('rename function can update destination properties', async () => {
	writeFiles(context.tmp, {'foo.js': 'console.log("foo");'});

	await cpy(['foo.js'], 'destination', {
		cwd: context.tmp,
		rename(source, destination) {
			assert.strictEqual(source.path, path.join(context.tmp, 'foo.js'));
			assert.strictEqual(source.name, 'foo.js');
			assert.strictEqual(source.nameWithoutExtension, 'foo');
			assert.strictEqual(source.extension, 'js');
			assert.ok(Object.isFrozen(source));
			assert.throws(() => {
				source.name = 'bar.js';
			}, TypeError);

			assert.strictEqual(destination.path, path.join(context.tmp, 'destination', 'foo.js'));
			assert.strictEqual(destination.name, 'foo.js');
			assert.strictEqual(destination.nameWithoutExtension, 'foo');
			assert.strictEqual(destination.extension, 'js');

			destination.nameWithoutExtension = 'bar';
			assert.strictEqual(destination.name, 'bar.js');

			destination.extension = 'ts';
			assert.strictEqual(destination.name, 'bar.ts');
			assert.strictEqual(destination.path, path.join(context.tmp, 'destination', 'bar.ts'));
		},
	});

	assert.strictEqual(
		read(context.tmp, 'foo.js'),
		read(context.tmp, 'destination/bar.ts'),
	);
});

test('rename function: destination path can be set to a filename', async () => {
	writeFiles(context.tmp, {'foo.js': 'console.log("foo");'});

	await cpy(['foo.js'], 'destination', {
		cwd: context.tmp,
		rename(_source, destination) {
			destination.path = 'renamed.js';
		},
	});

	assert.strictEqual(
		read(context.tmp, 'foo.js'),
		read(context.tmp, 'destination/renamed.js'),
	);
});

test('rename function: destination path cannot change directories', async () => {
	writeFiles(context.tmp, {'foo.js': 'console.log("foo");'});

	await assert.rejects(
		cpy(['foo.js'], 'destination', {
			cwd: context.tmp,
			rename(_source, destination) {
				destination.path = path.join(context.tmp, 'other', 'foo.js');
			},
		}),
		expectError(TypeError, /must stay within the destination directory/),
	);
});

test('rename file in same directory', async () => {
	fs.writeFileSync(path.join(context.tmp, 'hello.js'), 'console.log("hello");');

	await cpy(['hello.js'], './', {
		cwd: context.tmp,
		rename: 'file-renamed.js',
	});

	assert.strictEqual(read(context.tmp, 'file-renamed.js'), 'console.log("hello");');
	assert.strictEqual(read(context.tmp, 'hello.js'), 'console.log("hello");');
});

test('rename file in same directory using function', async () => {
	fs.writeFileSync(path.join(context.tmp, 'hello.js'), 'console.log("hello");');

	await cpy(['hello.js'], './', {
		cwd: context.tmp,
		rename(source, destination) {
			assert.ok(source);
			destination.name = `prefix-${source.name}`;
		},
	});

	assert.strictEqual(read(context.tmp, 'prefix-hello.js'), 'console.log("hello");');
	assert.strictEqual(read(context.tmp, 'hello.js'), 'console.log("hello");');
});

test('flatten directory tree', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.mkdirSync(path.join(context.tmp, 'source', 'nested'));
	fs.writeFileSync(path.join(context.tmp, 'foo.js'), 'console.log("foo");');
	fs.writeFileSync(
		path.join(context.tmp, 'source/bar.js'),
		'console.log("bar");',
	);
	fs.writeFileSync(
		path.join(context.tmp, 'source/nested/baz.ts'),
		'console.log("baz");',
	);

	await cpy('**/*.js', 'destination/subdir', {
		cwd: context.tmp,
		flat: true,
	});

	assert.strictEqual(
		read(context.tmp, 'foo.js'),
		read(context.tmp, 'destination/subdir/foo.js'),
	);
	assert.strictEqual(
		read(context.tmp, 'source/bar.js'),
		read(context.tmp, 'destination/subdir/bar.js'),
	);
	assert.ok(!fs.existsSync(path.join(context.tmp, 'destination/subdir/baz.ts')));
});

test('flatten single file', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.writeFileSync(
		path.join(context.tmp, 'source/bar.js'),
		'console.log("bar");',
	);

	await cpy('source/bar.js', 'destination', {
		cwd: context.tmp,
		flat: true,
	});

	assert.strictEqual(
		read(context.tmp, 'source/bar.js'),
		read(context.tmp, 'destination/bar.js'),
	);
});

test('pattern with Windows-style backslashes is normalized', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.writeFileSync(path.join(context.tmp, 'source', 'hello.js'), 'console.log("hello");');

	await cpy([String.raw`source\hello.js`], 'dest', {cwd: context.tmp});

	assert.strictEqual(
		read(context.tmp, 'source/hello.js'),
		read(context.tmp, 'dest/source/hello.js'),
	);
});

// TODO: Enable again when ESM supports mocking.
test('copy-file errors are CpyErrors', {skip: true}, async () => {
	const cpy = cpyMockedError('copy-file');
	await assert.rejects(cpy('license', context.dir), expectError(CpyError, /copy-file/));
});

test('throws on non-existing file', async () => {
	await assert.rejects(cpy(['no-file'], context.tmp), CpyError);
});

test('throws on multiple non-existing files', async () => {
	await assert.rejects(cpy(['no-file1', 'no-file2'], context.tmp), CpyError);
});

test('does not throw when not matching any file on glob pattern', async () => {
	await assert.doesNotReject(cpy(['*.nonexistent'], context.tmp));
});

test('junk files are ignored', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/Thumbs.db'), 'lorem ipsum');
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy('*', context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
		ignoreJunk: true,
	}).on('progress', event => {
		report = event;
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 1);
	assert.strictEqual(report.completedFiles, 1);
	assert.strictEqual(report.completedSize, 11);
	assert.strictEqual(report.percent, 1);
	assert.strictEqual(read(report.sourcePath), read(context.tmp + '/cwd/foo'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp + '/cwd/foo'));
});

test('junk files are copied', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/Thumbs.db'), 'lorem ipsum');
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy('*', context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
		ignoreJunk: false,
	}).on('progress', event => {
		report = event;
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 2);
	assert.strictEqual(report.completedFiles, 2);
	assert.strictEqual(report.completedSize, 22);
	assert.strictEqual(report.percent, 1);
	assert.strictEqual(read(report.sourcePath), read(context.tmp + '/cwd/foo'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp + '/cwd/foo'));
});

test('nested junk files are ignored', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/Thumbs.db'), 'lorem ipsum');
	fs.writeFileSync(path.join(context.tmp, 'cwd/test'), 'lorem ipsum');

	let report;

	await cpy(['cwd/*'], context.tmp, {
		cwd: context.tmp,
		ignoreJunk: true,
	}).on('progress', event => {
		report = event;
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 1);
	assert.strictEqual(report.completedFiles, 1);
	assert.strictEqual(report.completedSize, 11);
	assert.strictEqual(report.percent, 1);
	assert.strictEqual(read(report.sourcePath), read(context.tmp + '/cwd/test'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp + '/test'));
});

test('reports copy progress of single file', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy(['foo'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
	}).on('progress', event => {
		report = event;
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 1);
	assert.strictEqual(report.completedFiles, 1);
	assert.strictEqual(report.completedSize, 11);
	assert.strictEqual(report.percent, 1);
	assert.strictEqual(read(report.sourcePath), read(context.tmp + '/cwd/foo'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp + '/foo'));
});

test('reports copy progress of multiple files', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');
	fs.writeFileSync(path.join(context.tmp, 'cwd/bar'), 'dolor sit amet');

	let report;

	await cpy(['foo', 'bar'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
	}).on('progress', event => {
		report = event;
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 2);
	assert.strictEqual(report.completedFiles, 2);
	assert.strictEqual(report.completedSize, 25);
	assert.strictEqual(report.percent, 1);
	// Final progress event may correspond to any file due to concurrency; don't assume order
	const finalSourceBase = path.basename(report.sourcePath);
	const finalDestBase = path.basename(report.destinationPath);
	assert.ok(['foo', 'bar'].includes(finalSourceBase));
	assert.strictEqual(finalSourceBase, finalDestBase);
	// Verify content equality between reported source and destination
	assert.strictEqual(read(report.destinationPath), read(report.sourcePath));
});

test('reports correct completedSize', async () => {
	const ONE_MEGABYTE = (1 * 1024 * 1024) + 1;
	const buf = crypto.randomBytes(ONE_MEGABYTE);

	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/fatfile'), buf);

	let report;
	let chunkCount = 0;

	await cpy(['fatfile'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
	}).on('progress', event => {
		chunkCount++;
		report = event;
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 1);
	assert.strictEqual(report.completedFiles, 1);
	assert.strictEqual(report.completedSize, ONE_MEGABYTE);
	assert.strictEqual(read(report.sourcePath), read(context.tmp, 'cwd/fatfile'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp, 'fatfile'));
	assert.ok(chunkCount > 1);
	assert.strictEqual(report.percent, 1);
});

test('reports copy progress of single file with onProgress option', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');

	let report;

	await cpy(['foo'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
		onProgress(event) {
			report = event;
		},
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 1);
	assert.strictEqual(report.completedFiles, 1);
	assert.strictEqual(report.completedSize, 11);
	assert.strictEqual(report.percent, 1);
	assert.strictEqual(read(report.sourcePath), read(context.tmp + '/cwd/foo'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp + '/foo'));
});

test('reports copy progress of multiple files with onProgress option', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');
	fs.writeFileSync(path.join(context.tmp, 'cwd/bar'), 'dolor sit amet');

	let report;

	await cpy(['foo', 'bar'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
		onProgress(event) {
			report = event;
		},
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 2);
	assert.strictEqual(report.completedFiles, 2);
	assert.strictEqual(report.completedSize, 25);
	assert.strictEqual(report.percent, 1);
	// Final progress event may correspond to any file due to concurrency; don't assume order
	const finalSourceBase = path.basename(report.sourcePath);
	const finalDestBase = path.basename(report.destinationPath);
	assert.ok(['foo', 'bar'].includes(finalSourceBase));
	assert.strictEqual(finalSourceBase, finalDestBase);
	// Verify content equality between reported source and destination
	assert.strictEqual(read(report.destinationPath), read(report.sourcePath));
});

test('reports correct completedSize with onProgress option', async () => {
	const ONE_MEGABYTE = (1 * 1024 * 1024) + 1;
	const buf = crypto.randomBytes(ONE_MEGABYTE);

	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/fatfile'), buf);

	let report;
	let chunkCount = 0;

	await cpy(['fatfile'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
		onProgress(event) {
			chunkCount++;
			report = event;
		},
	});

	assert.notStrictEqual(report, undefined);
	assert.strictEqual(report.totalFiles, 1);
	assert.strictEqual(report.completedFiles, 1);
	assert.strictEqual(report.completedSize, ONE_MEGABYTE);
	assert.strictEqual(read(report.sourcePath), read(context.tmp, 'cwd/fatfile'));
	assert.strictEqual(read(report.destinationPath), read(context.tmp, 'fatfile'));
	assert.ok(chunkCount > 1);
	assert.strictEqual(report.percent, 1);
});

test('returns the event emitter on early rejection', () => {
	const rejectedPromise = cpy(null, null);
	assert.strictEqual(typeof rejectedPromise.on, 'function');
	rejectedPromise.catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
});

test('returns destination path', async () => {
	fs.mkdirSync(path.join(context.tmp, 'cwd'));
	fs.writeFileSync(path.join(context.tmp, 'cwd/foo'), 'lorem ipsum');
	fs.writeFileSync(path.join(context.tmp, 'cwd/bar'), 'dolor sit amet');

	const to = await cpy(['foo', 'bar'], context.tmp, {
		cwd: path.join(context.tmp, 'cwd'),
	});

	assert.deepStrictEqual(to, [
		path.join(context.tmp, 'foo'),
		path.join(context.tmp, 'bar'),
	]);
});

test('absolute directory source paths', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.mkdirSync(path.join(context.tmp, 'out'));
	fs.writeFileSync(
		path.join(context.tmp, 'source/hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(context.tmp, 'source')], path.join(context.tmp, 'out'));

	assert.strictEqual(
		read(context.tmp, 'source/hello.js'),
		read(context.tmp, 'out/hello.js'),
	);
});

test('absolute file source paths', async () => {
	fs.mkdirSync(path.join(context.tmp, 'out'));
	fs.writeFileSync(
		path.join(context.tmp, 'hello.js'),
		'console.log("hello");',
	);

	await cpy([path.join(context.tmp, 'hello.js')], path.join(context.tmp, 'out'));

	assert.strictEqual(
		read(context.tmp, 'hello.js'),
		read(context.tmp, 'out/hello.js'),
	);
});

test('negative patterns', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.mkdirSync(path.join(context.tmp, 'out'));
	fs.writeFileSync(path.join(context.tmp, 'source/keep.js'), 'console.log("keep");');
	fs.writeFileSync(path.join(context.tmp, 'source/ignore.js'), 'console.log("ignore");');
	fs.writeFileSync(path.join(context.tmp, 'source/also-keep.txt'), 'keep this');

	await cpy(['source/*', '!source/ignore.js'], path.join(context.tmp, 'out'), {
		cwd: context.tmp,
	});

	assert.strictEqual(
		read(context.tmp, 'source/keep.js'),
		read(context.tmp, 'out/keep.js'),
	);
	assert.strictEqual(
		read(context.tmp, 'source/also-keep.txt'),
		read(context.tmp, 'out/also-keep.txt'),
	);
	assert.ok(!fs.existsSync(path.join(context.tmp, 'out/ignore.js')));
});

test('recursive directory copying', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.mkdirSync(path.join(context.tmp, 'source/nested'));
	fs.mkdirSync(path.join(context.tmp, 'source/nested/deep'));
	fs.mkdirSync(path.join(context.tmp, 'out'));

	fs.writeFileSync(path.join(context.tmp, 'source/file1.js'), 'console.log("file1");');
	fs.writeFileSync(path.join(context.tmp, 'source/nested/file2.js'), 'console.log("file2");');
	fs.writeFileSync(path.join(context.tmp, 'source/nested/deep/file3.js'), 'console.log("file3");');

	await cpy(['source/**'], path.join(context.tmp, 'out'), {
		cwd: context.tmp,
	});

	assert.strictEqual(
		read(context.tmp, 'source/file1.js'),
		read(context.tmp, 'out/file1.js'),
	);
	assert.strictEqual(
		read(context.tmp, 'source/nested/file2.js'),
		read(context.tmp, 'out/nested/file2.js'),
	);
	assert.strictEqual(
		read(context.tmp, 'source/nested/deep/file3.js'),
		read(context.tmp, 'out/nested/deep/file3.js'),
	);
});

// #10 – **/* pattern should not throw EISDIR when matching directories
test('glob **/* excludes directories and copies only files', async () => {
	fs.mkdirSync(path.join(context.tmp, 'assets'));
	fs.mkdirSync(path.join(context.tmp, 'assets/nested'));
	fs.mkdirSync(path.join(context.tmp, 'assets/empty'));
	fs.mkdirSync(path.join(context.tmp, 'output'));

	fs.writeFileSync(path.join(context.tmp, 'assets/file1.txt'), 'content1');
	fs.writeFileSync(path.join(context.tmp, 'assets/nested/file2.txt'), 'content2');

	await assert.doesNotReject(cpy(['**/*'], path.join(context.tmp, 'output'), {
		cwd: path.join(context.tmp, 'assets'),
	}));

	assert.strictEqual(
		read(context.tmp, 'assets/file1.txt'),
		read(context.tmp, 'output/file1.txt'),
	);
	assert.strictEqual(
		read(context.tmp, 'assets/nested/file2.txt'),
		read(context.tmp, 'output/nested/file2.txt'),
	);

	// Empty directories should not be created
	assert.ok(!fs.existsSync(path.join(context.tmp, 'output/empty')));
});

// #114 – absolute cwd + absolute destination must not self-copy or escape dest
test('absolute cwd + absolute dest: preserves structure from cwd and never self-copies', async () => {
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

	assert.ok(fs.existsSync(outA));
	assert.ok(fs.existsSync(outB));

	// Ensure content intact (no truncation / self-copy)
	assert.strictEqual(fs.readFileSync(outA, 'utf8'), fs.readFileSync(fileA, 'utf8'));
	assert.strictEqual(fs.readFileSync(outB, 'utf8'), fs.readFileSync(fileB, 'utf8'));

	// Sanity: every created file path starts with dest (no traversal)
	const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
		const p = path.join(dir, d.name);
		return d.isDirectory() ? walk(p) : [p];
	});
	for (const p of walk(dest)) {
		assert.ok(p.startsWith(dest));
	}
});

// #114 – when glob parent and destination share ancestry, output still stays inside dest
test('never joins a path that resolves back to the source (guards against data loss)', async () => {
	const root = temporaryDirectory();
	const repo = path.join(root, 'repo');
	const source = path.join(repo, 'packages', 'alpha');
	const dest = path.join(repo, 'build', 'packages', 'alpha');

	fs.mkdirSync(path.join(source, 'dir'), {recursive: true});
	const file = path.join(source, 'dir', 'file.txt');
	fs.writeFileSync(file, 'x'.repeat(8192)); // Sizeable to catch truncation

	await cpy(['**/*'], dest, {cwd: source});

	const out = path.join(dest, 'dir', 'file.txt');
	assert.ok(fs.existsSync(out));
	assert.strictEqual(fs.readFileSync(out, 'utf8'), fs.readFileSync(file, 'utf8'));

	// Ensure destination is not the same as source path
	assert.notStrictEqual(path.resolve(out), path.resolve(file));
});

test('deeply nested ../ in source and dest', async () => {
	fs.mkdirSync(path.join(context.tmp, 'a/b/c/d/e/f'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'a/b/target.txt'), 'target');

	await cpy(['../../../../target.txt'], '../../../../output', {cwd: path.join(context.tmp, 'a/b/c/d/e/f')});

	assert.strictEqual(read(context.tmp, 'a/b/target.txt'), read(context.tmp, 'a/b/output/target.txt'));
});

test('mixed ../ and ./ in paths', async () => {
	fs.mkdirSync(path.join(context.tmp, 'src/sub'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'file.txt'), 'content');

	await cpy(['../../file.txt'], '.././../output', {cwd: path.join(context.tmp, 'src/sub')});

	assert.strictEqual(read(context.tmp, 'file.txt'), read(context.tmp, 'output/file.txt'));
});

test('redundant path segments', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'nested/file.txt'), 'content');

	const results = await cpy(['./nested/../nested/file.txt'], './output', {cwd: context.tmp});

	assert.strictEqual(results.length, 1);
	assert.ok(fs.existsSync(results[0]));
	assert.strictEqual(fs.readFileSync(results[0], 'utf8'), 'content');
});

test('empty path segments', async () => {
	fs.writeFileSync(path.join(context.tmp, 'file.txt'), 'content');

	await cpy(['./file.txt'], 'output//subdir', {cwd: context.tmp});

	assert.strictEqual(read(context.tmp, 'file.txt'), read(context.tmp, 'output/subdir/file.txt'));
});

test('current directory references', async () => {
	fs.writeFileSync(path.join(context.tmp, 'file.txt'), 'content');

	await cpy(['./././file.txt'], './././output', {cwd: context.tmp});

	assert.strictEqual(read(context.tmp, 'file.txt'), read(context.tmp, 'output/file.txt'));
});

test('source outside cwd with absolute destination', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested/deep'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'file.txt'), 'content');

	const absoluteDest = path.join(context.tmp, 'absolute-output');
	await cpy(['../../file.txt'], absoluteDest, {cwd: path.join(context.tmp, 'nested/deep')});

	assert.strictEqual(read(context.tmp, 'file.txt'), read(context.tmp, 'absolute-output/file.txt'));
});

test('non-glob single file: refuse self-copy when destination resolves to source directory', async () => {
	// Arrange a file outside cwd and a destination that resolves to that same directory
	fs.mkdirSync(path.join(context.tmp, 'nested'), {recursive: true});
	const outsideFile = path.join(context.tmp, 'file.txt');
	fs.writeFileSync(outsideFile, 'self-copy-guard');

	const cwd = path.join(context.tmp, 'nested');

	// Act + Assert
	await assert.rejects(
		cpy(['../file.txt'], '../', {cwd}),
		expectError(CpyError, /Refusing to copy to itself/),
	);

	// Ensure content intact
	assert.strictEqual(fs.readFileSync(outsideFile, 'utf8'), 'self-copy-guard');
});

test('non-glob single file inside cwd: refuse self-copy when destination is current directory', async () => {
	const cwd = context.tmp;
	const src = path.join(cwd, 'same.txt');
	fs.writeFileSync(src, 'same');

	await assert.rejects(
		cpy(['same.txt'], '.', {cwd}),
		expectError(CpyError, /Refusing to copy to itself/),
	);

	assert.strictEqual(fs.readFileSync(src, 'utf8'), 'same');
});

test('source and dest both with trailing slashes', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'nested/file.txt'), 'content');

	await cpy(['../nested/file.txt'], '../output/', {cwd: path.join(context.tmp, 'nested')});

	assert.strictEqual(read(context.tmp, 'nested/file.txt'), read(context.tmp, 'output/file.txt'));
});

test('both source and dest with ../ paths', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested/deep'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'nested/file.txt'), 'content');

	await cpy(['../file.txt'], '../output', {cwd: path.join(context.tmp, 'nested/deep')});

	assert.strictEqual(read(context.tmp, 'nested/file.txt'), read(context.tmp, 'nested/output/file.txt'));
	assert.ok(fs.existsSync(path.join(context.tmp, 'nested/output/file.txt')));
});

test('multiple ../ in both source and dest', async () => {
	fs.mkdirSync(path.join(context.tmp, 'a/b/c/d'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'a/b/target.txt'), 'target');

	await cpy(['../../target.txt'], '../../output', {cwd: path.join(context.tmp, 'a/b/c/d')});

	assert.strictEqual(read(context.tmp, 'a/b/target.txt'), read(context.tmp, 'a/b/output/target.txt'));
	assert.ok(fs.existsSync(path.join(context.tmp, 'a/b/output/target.txt')));
});

test('source with ./ prefix and ../ destination', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'nested/file.txt'), 'content');

	await cpy(['./file.txt'], '../output', {cwd: path.join(context.tmp, 'nested')});

	assert.strictEqual(read(context.tmp, 'nested/file.txt'), read(context.tmp, 'output/file.txt'));
});

test('absolute source with relative destination', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'file.txt'), 'content');

	await cpy([path.join(context.tmp, 'file.txt')], '../output', {cwd: path.join(context.tmp, 'nested')});

	assert.strictEqual(read(context.tmp, 'file.txt'), read(context.tmp, 'output/file.txt'));
});

test('glob with ../ and flat option', async () => {
	fs.mkdirSync(path.join(context.tmp, 'nested/deep'), {recursive: true});
	fs.writeFileSync(path.join(context.tmp, 'file1.js'), 'js1');
	fs.writeFileSync(path.join(context.tmp, 'file2.js'), 'js2');

	await cpy(['../../*.js'], '../output', {cwd: path.join(context.tmp, 'nested/deep'), flat: true});

	assert.strictEqual(read(context.tmp, 'file1.js'), read(context.tmp, 'nested/output/file1.js'));
	assert.strictEqual(read(context.tmp, 'file2.js'), read(context.tmp, 'nested/output/file2.js'));
});

test('relative source outside cwd to relative destination', async () => {
	const testRoot = temporaryDirectory();

	fs.mkdirSync(path.join(testRoot, 'cwd'), {recursive: true});
	fs.mkdirSync(path.join(testRoot, 'src/a/b'), {recursive: true});
	fs.writeFileSync(path.join(testRoot, 'src/a/b/foo.txt'), 'test content');

	try {
		await cpy(['../src/a/b/foo.txt'], '../dest', {
			cwd: path.join(testRoot, 'cwd'),
		});

		assert.ok(fs.existsSync(path.join(testRoot, 'dest/foo.txt')));
		assert.strictEqual(read(testRoot, 'dest/foo.txt'), 'test content');

		assert.ok(fs.existsSync(path.join(testRoot, 'src/a/b/foo.txt')));
	} finally {
		rimrafSync(testRoot);
	}
});

test('glob with flat and absolute destination', async () => {
	const cwd = path.join(context.tmp, 'proj');
	const absDest = path.join(context.tmp, 'abs-out');

	fs.mkdirSync(path.join(cwd, 'src', 'nested'), {recursive: true});
	fs.writeFileSync(path.join(cwd, 'a.js'), 'A');
	fs.writeFileSync(path.join(cwd, 'src', 'b.js'), 'B');
	fs.writeFileSync(path.join(cwd, 'src', 'nested', 'c.ts'), 'C');

	await cpy('**/*.js', absDest, {cwd, flat: true});

	// Only files, flattened; retains extensions; ignores directories
	assert.ok(fs.existsSync(path.join(absDest, 'a.js')));
	assert.ok(fs.existsSync(path.join(absDest, 'b.js')));
	assert.ok(!fs.existsSync(path.join(absDest, 'c.ts')));
});

test('signal option allows aborting copy operation', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.mkdirSync(path.join(context.tmp, 'dest'));

	// Create many files to increase chance of catching the abort
	for (let index = 0; index < 100; index++) {
		fs.writeFileSync(
			path.join(context.tmp, 'source', `file${index}.txt`),
			'x'.repeat(10_000),
		);
	}

	const controller = new AbortController();

	setTimeout(() => {
		controller.abort();
	}, 10);

	// DOMException may not be an Error instance on some platforms (Windows)
	// so we catch and check the name manually
	try {
		await cpy('source/*', path.join(context.tmp, 'dest'), {
			cwd: context.tmp,
			signal: controller.signal,
		});
		assert.fail('Expected an error to be thrown');
	} catch (error) {
		assert.strictEqual(error.name, 'AbortError');
	}
});

test('signal option throws when already aborted', async () => {
	fs.writeFileSync(path.join(context.tmp, 'source.txt'), 'content');

	const controller = new AbortController();
	controller.abort();

	// DOMException may not be an Error instance on some platforms (Windows)
	// so we catch and check the name manually
	try {
		await cpy('source.txt', context.tmp, {
			cwd: context.tmp,
			signal: controller.signal,
		});
		assert.fail('Expected an error to be thrown');
	} catch (error) {
		assert.strictEqual(error.name, 'AbortError');
	}
});

test('signal option works with custom abort reason', async () => {
	fs.writeFileSync(path.join(context.tmp, 'source.txt'), 'content');

	const controller = new AbortController();
	const customReason = new Error('Custom abort reason');
	controller.abort(customReason);

	try {
		await cpy('source.txt', context.tmp, {
			cwd: context.tmp,
			signal: controller.signal,
		});
		assert.fail('Expected an error to be thrown');
	} catch (error) {
		assert.strictEqual(error, customReason);
	}
});

test('followSymbolicLinks option', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	fs.mkdirSync(path.join(context.tmp, 'linked'));
	fs.writeFileSync(path.join(context.tmp, 'linked', 'file.txt'), 'content');
	fs.symlinkSync(path.join(context.tmp, 'linked'), path.join(context.tmp, 'source', 'link'), 'dir');

	// Default: follows symlinks
	await cpy('source/**', path.join(context.tmp, 'dest1'), {cwd: context.tmp});
	assert.ok(fs.existsSync(path.join(context.tmp, 'dest1', 'link', 'file.txt')));

	// Disabled: does not follow symlinks
	await cpy('source/**', path.join(context.tmp, 'dest2'), {cwd: context.tmp, followSymbolicLinks: false});
	assert.ok(!fs.existsSync(path.join(context.tmp, 'dest2', 'link', 'file.txt')));
});

test('preserveTimestamps option', async () => {
	fs.mkdirSync(path.join(context.tmp, 'source'));
	const sourceFile = path.join(context.tmp, 'source', 'file.txt');
	fs.writeFileSync(sourceFile, 'content');

	// Set specific old timestamps on source file
	const oldTime = new Date(2000, 0, 1);
	fs.utimesSync(sourceFile, oldTime, oldTime);

	const sourceStats = fs.statSync(sourceFile);

	// With preserveTimestamps enabled
	await cpy('source/**', path.join(context.tmp, 'dest'), {
		cwd: context.tmp,
		preserveTimestamps: true,
	});

	const destinationStats = fs.statSync(path.join(context.tmp, 'dest', 'file.txt'));

	// Verify mtime is preserved
	assert.strictEqual(destinationStats.mtime.getTime(), sourceStats.mtime.getTime());

	// On Linux, filesystems may be mounted with noatime/relatime, which prevents atime preservation
	// Only verify atime on non-Linux platforms where it's reliably preserved
	if (process.platform !== 'linux') {
		assert.strictEqual(destinationStats.atime.getTime(), sourceStats.atime.getTime());
	}
});
