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

export type FilterContext = {
	/**
	Resolved destination path for the file.

	@example '/tmp/dir/foo.js'
	*/
	readonly destinationPath: string;
};

export type RenameFile = {
	/**
	Resolved path to the file.

	@example '/tmp/dir/foo.js'
	*/
	path: string;

	/**
	Filename with extension.

	@example 'foo.js'
	*/
	name: string;

	/**
	Filename without extension.

	@example 'foo'
	*/
	nameWithoutExtension: string;

	/**
	File extension.

	@example 'js'
	*/
	extension: string;
};

export type RenameSource = Readonly<RenameFile>;

/**
Destination file object, can be mutated to rename the file.
The `path` property must stay within the original destination directory.
*/
export type RenameDestination = RenameFile;

/**
Deprecated: Use the two-argument rename callback instead. This legacy signature emits a warning and will be removed in the next major release.
*/
export type LegacyRenameFunction = (basename: string) => string;

export type RenameFunction = LegacyRenameFunction | ((source: RenameSource, destination: RenameDestination) => void);

export type Options = {
	/**
	Working directory to find source files.

	@default process.cwd()
	*/
	readonly cwd?: string;

	/**
	Overwrite existing files.

	@default true
	*/
	readonly overwrite?: boolean;

	/**
	Skip files when the destination path already exists.

	This option takes precedence over `overwrite`.

	@default false
	*/
	readonly ignoreExisting?: boolean;

	/**
	Only overwrite when the source is newer, or when sizes differ with the same modification time.

	Ignored when `overwrite` is `false` or `ignoreExisting` is `true`.

	@default false
	*/
	readonly update?: boolean;

	/**
	Flatten directory structure. All copied files will be put in the same directory.

	@default false

	@example
	```
	import cpy from 'cpy';

	await cpy('src/**\/*.js', 'destination', {
		flat: true
	});
	```
	*/
	readonly flat?: boolean;

	/**
	Choose how destination paths are calculated for patterns. By default, globs are resolved relative to their parent and explicit paths are resolved relative to `cwd`. Set to `'pattern'` to make explicit paths behave like globs, or `'cwd'` to make globs behave like explicit paths.

	@default undefined
	*/
	readonly base?: 'cwd' | 'pattern';

	/**
	Filename or function used to rename every file in `source`. Use a two-argument function to receive a frozen source file object and a mutable destination file object. The destination path must stay within the original destination directory. The legacy single-argument form is deprecated, emits a warning, and will be removed in the next major release.

	@example
	```
	import cpy from 'cpy';

	await cpy('foo.js', 'destination', {
		rename(source, destination) {
			if (source.nameWithoutExtension === 'foo') {
				destination.nameWithoutExtension = 'bar';
			}
		}
	});

	await cpy('foo.js', 'destination', {
		rename: 'new-name'
	});
	```
	*/
	readonly rename?: string | RenameFunction;

	/**
	Number of files being copied concurrently.

	@default os.availableParallelism()
	*/
	readonly concurrency?: number;

	/**
	Ignores [junk](https://github.com/sindresorhus/junk) files.

	@default true
	*/
	readonly ignoreJunk?: boolean;

	/**
	Function to filter files to copy.

	Receives a source file object and a context object with the resolved destination path.

	Return true to include, false to exclude. You can also return a Promise that resolves to true or false.

	@example
	```
	import cpy from 'cpy';

	await cpy('foo', 'destination', {
		filter: (file, {destinationPath}) => file.extension !== 'nocopy'
	});
	```
	*/
	readonly filter?: (file: Entry, context: FilterContext) => boolean | Promise<boolean>;

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
	readonly signal?: AbortSignal | undefined;

	/**
	Whether to follow symbolic links.

	@default true
	*/
	readonly followSymbolicLinks?: boolean;

	/**
	Preserve file access and modification timestamps when copying.

	@default false
	*/
	readonly preserveTimestamps?: boolean;

	/**
	Skip copying and return the resolved destination paths.

	@default false
	*/
	readonly dryRun?: boolean;
} & Readonly<GlobOptions> & Omit<CopyFileOptions, 'overwrite'>;

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
@param options - In addition to the options defined here, options are passed to [globby](https://github.com/sindresorhus/globby#options). Note: Dotfiles are excluded by default. Set `dot: true` to include them.

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

// Copy node_modules structure but skip all files except .json files
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
