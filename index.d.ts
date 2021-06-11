import {IOptions as GlobOptions} from 'glob';
import {Options as CpFileOptions} from 'cp-file';

declare namespace cpy {
	interface Entry {
		/**
		Resolved path to the file.

		@example '/tmp/dir/foo.js'
		*/
		readonly path: string;

		/**
		Relative path to the file from cwd.

		@example 'dir/foo.js'
		*/
		readonly relativePath: string;

		/**
		Filename with extension.

		@example 'foo.js'
		*/
		readonly name: string;

		/**
		Filename without extension.

		@example 'foo'
		*/
		readonly nameWithoutExtension: string;

		/**
		File extension.

		@example 'js'
		*/
		readonly extension: string;
	}

	interface Options extends Readonly<GlobOptions>, CpFileOptions {
		/**
		Working directory to find source files.

		@default process.cwd()
		*/
		readonly cwd?: string;

		/**
		Flatten directory tree.

		@default false
		*/
		readonly flat?: boolean;

		/**
		Filename or function returning a filename used to rename every file in `source`.

		@example
		```
		import cpy = require('cpy');

		(async () => {
			await cpy('foo.js', 'destination', {
				rename: basename => `prefix-${basename}`
			});
		})();
		```
		*/
		readonly rename?: string | ((basename: string) => string);

		/**
		Number of files being copied concurrently.

		@default (os.cpus().length || 1) * 2
		*/
		readonly concurrency?: number;

		/**
		Ignore junk files.

		@default true
		*/
		readonly ignoreJunk?: boolean;

		/**
		Function to filter files to copy.

		Receives a source file object as the first argument.

		Return true to include, false to exclude. You can also return a Promise that resolves to true or false.

		@example
		```
		import cpy = require('cpy');

		(async () => {
			await cpy('foo', 'destination', {
				filter: file => file.extension !== '.nocopy'
			});
		})();
		```
		*/
		readonly filter?: (file: Entry) => (boolean | Promise<boolean>);
	}

	interface ProgressData {
		/**
		Copied file count.
		*/
		completedFiles: number;

		/**
		Overall file count.
		*/
		totalFiles: number;

		/**
		Completed size in bytes.
		*/
		completedSize: number;

		/**
		Completed percentage. A value between `0` and `1`.
		*/
		percent: number;
	}

	interface ProgressEmitter {
		on(
			event: 'progress',
			handler: (progress: ProgressData) => void
		): Promise<string[]>;
	}
}

/**
Copy files.

@param source - Files to copy. If any of the files do not exist, an error will be thrown (does not apply to globs).
@param destination - Destination directory.
@param options - In addition to the options defined here, options are passed to [glob](https://github.com/isaacs/node-glob).

@example
```
import cpy = require('cpy');

(async () => {
	await cpy(['source/*.png', '!source/goat.png'], 'destination');
	console.log('Files copied!');
})();
```
*/
declare function cpy(
	source: string | ReadonlyArray<string>,
	destination: string,
	options?: cpy.Options
): Promise<string[]> & cpy.ProgressEmitter;

export = cpy;
