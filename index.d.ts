import {Options as GlobOptions} from 'globby';
import {Options as CpFileOptions} from 'cp-file';

export interface Entry {
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

export interface Options extends Readonly<GlobOptions>, CpFileOptions {
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
	Omits the specified amount of parent directories from files being copied.

	@default 0

	@example
	```
	import cpy from 'cpy';

	await cpy('src/**\/*.js', 'destination/flatSourceFiles', {
		trimPathComponents: 2
	});
	```
	*/
	readonly trimPathComponents?: number;

	/**
	Filename or function returning a filename used to rename every file in `source`.

	@example
	```
	import cpy from 'cpy';

	await cpy('foo.js', 'destination', {
		rename: basename => `prefix-${basename}`
	});

	await cpy('foo.js', 'destination', {
		rename: 'new-name'
	});
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
	import cpy from 'cpy';

	await cpy('foo', 'destination', {
		filter: file => file.extension !== 'nocopy'
	});
	```
	*/
	readonly filter?: (file: Entry) => boolean | Promise<boolean>;
}

export interface ProgressData {
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

export interface ProgressEmitter {
	on(
		event: 'progress',
		handler: (progress: ProgressData) => void
	): Promise<string[]>;
}

export interface CopyStatus {
	written: number;
	percent: number;
}

/**
Copy files.

@param source - Files to copy. If any of the files do not exist, an error will be thrown (does not apply to globs).
@param destination - Destination directory.
@param options - In addition to the options defined here, options are passed to [globby](https://github.com/sindresorhus/globby#options).

@example
```
import cpy from 'cpy';

await cpy([
	'source/*.png', // Copy all .png files
	'!source/goat.png', // Ignore goat.png
], 'destination');

// Copy node_modules to destination/node_modules
await cpy('node_modules', 'destination');

// Copy node_modules content to destination
await cpy('node_modules/**', 'destination');

// Copy node_modules structure but skip all files except any .json files
await cpy('node_modules/**\/*.json', 'destination');

// Copy all png files into destination without keeping directory structure
await cpy('**\/*.png', 'destination', {flat: true});

console.log('Files copied!');
```
*/
export default function cpy(
	source: string | readonly string[],
	destination: string,
	options?: Options
): Promise<string[]> & ProgressEmitter;
