import test from 'ava';
import tempfile from 'tempfile';

import fn from '../';
import {read, write, lstat, lstatP, symlink} from './helpers/fs';

test.beforeEach(t => {
	t.context.tmp = tempfile();
});

test('recursively copy', async t => {
	/*
	 * src
	 * └── a
	 *     ├── a.js
	 *     └── b
	 *         └── b.js
	 */
	write(t.context.tmp, 'src/a/a.js', 'console.log("a");');
	write(t.context.tmp, 'src/a/b/b.js', 'console.log("b");');

	await fn(['src'], 'src', {
		cwd: t.context.tmp
	});

	t.is(read(t.context.tmp, 'src/src/a/a.js'), read(t.context.tmp, 'src/a/a.js'));
	t.is(read(t.context.tmp, 'src/src/a/b/b.js'), read(t.context.tmp, 'src/a/b/b.js'));
});

test('recursively copy, respecting negation', async t => {
	/*
	 * src
	 * └── a
	 *     ├── a.js
	 *     ├── a.css
	 *     └── ab
	 *         └── ab.js
	 */
	write(t.context.tmp, 'src/a/a.js', 'console.log("a");');
	write(t.context.tmp, 'src/a/a.css', 'a { color: rainbow; }');
	write(t.context.tmp, 'src/a/ab/ab.js', 'console.log("ab");');

	await fn(['src', '!**/*.css', '!**/ab'], 'src', {
		cwd: t.context.tmp
	});

	t.true(lstat(t.context.tmp, 'src/src').isDirectory());
	t.is(read(t.context.tmp, 'src/src/a/a.js'), read(t.context.tmp, 'src/a/a.js'));
	t.true(lstat(t.context.tmp, 'src/src').isDirectory());
	t.throws(lstatP(t.context.tmp, 'src/src/a/a.css'), /ENOENT/);
	t.throws(lstatP(t.context.tmp, 'src/src/a/ab/ab.js'), /ENOENT/);
});

test('following mutually recursively linked directories throws ELOOP', async t => {
	/*
	 * src
	 * ├── a
	 * │   └── b -> ../b
	 * └── b
	 *     └── a -> ../a
	 */
	symlink('../b', [t.context.tmp, 'src/a/b']);
	symlink('../a', [t.context.tmp, 'src/b/a']);

	t.throws(fn(['src'], 'src', {
		cwd: t.context.tmp,
		follow: true
	}), /ELOOP/);
});
