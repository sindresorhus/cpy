import {type Options as GlobOptions} from 'globby';
import {type Options as CopyFileOptions} from 'copy-file';

export type Entry = {
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
};

export type Options = {
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
	import cpy from 'cpy';

	await cpy('foo.js', 'destination', {
		// The `basename` is the filename with extension.
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

	/**
	The given function is called whenever there is measurable progress.

	@example
	```
	import cpy from 'cpy';

	await cpy('foo', 'destination', {
		onProgress: progress => {
			// …
		}
	});
	```
	*/
	readonly onProgress?: (progress: ProgressData) => void;

	/**
	Abort signal to cancel the copy operation.
	*/
	readonly signal?: AbortSignal;

	/**
	Whether to follow symbolic links.

	@default true
	*/
	readonly followSymbolicLinks?: boolean;
} & Readonly<GlobOptions> & CopyFileOptions;

export type ProgressData = {
	/**
	Number of files copied so far.
	*/
	completedFiles: number;

	/**
	Total number of files to copy.
	*/
	totalFiles: number;

	/**
	Number of bytes copied so far.
	*/
	completedSize: number;

	/**
	Progress percentage as a value between `0` and `1`.
	*/
	percent: number;

	/**
	Absolute source path of the current file being copied.
	*/
	sourcePath: string;

	/**
	Absolute destination path of the current file being copied.
	*/
	destinationPath: string;
};

export type ProgressEmitter = {
	/**
	@deprecated Use `onProgress` option instead.
	*/
	on(
		event: 'progress',
		handler: (progress: ProgressData) => void
	): Promise<string[]>;
};

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

// Progress reporting
await cpy('source/**', 'destination', {
	onProgress: progress => {
		console.log(`Progress: ${Math.round(progress.percent * 100)}%`);
	}
});

console.log('Files copied!');
```
*/
export default function cpy(
	source: string | readonly string[],
	destination: string,
	options?: Options
): Promise<string[]> & ProgressEmitter;
