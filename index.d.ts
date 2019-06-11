import {GlobbyOptions} from 'globby';
import {Options as CpFileOptions} from 'cp-file';

declare namespace cpy {
	interface Options extends Readonly<GlobbyOptions>, CpFileOptions {
		/**
		Working directory to find source files.

		@default process.cwd()
		*/
		readonly cwd?: string;

		/**
		Preserve path structure.

		@default false
		*/
		readonly parents?: boolean;

		/**
		Filename or function returning a filename used to rename every file in `source`.

		@example
		```
		cpy('foo.js', 'destination', {
			rename: basename => `prefix-${basename}`
		});
		```
		*/
		readonly rename?: string | ((basename: string) => string);
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

declare const cpy: {
	/**
	Copy files.

	@param source - Files to copy.
	@param destination - Destination directory.
	@param options - Options are passed to [cp-file](https://github.com/sindresorhus/cp-file#options) and [globby](https://github.com/sindresorhus/globby#options).

	@example
	```
	import cpy = require('cpy');

	(async () => {
		await cpy(['source/*.png', '!source/goat.png'], 'destination');
		console.log('Files copied!');
	})();
	```
	*/
	(
		source: string | ReadonlyArray<string>,
		destination: string,
		options?: cpy.Options
	): Promise<string[]> & cpy.ProgressEmitter;

	// TODO: Remove this for the next major release, refactor the whole definition to:
	// declare function cpy(
	// 	source: string | ReadonlyArray<string>,
	// 	destination: string,
	// 	options?: cpy.Options
	// ): Promise<void> & cpy.ProgressEmitter;
	// export = cpy;
	default: typeof cpy;
};

export = cpy;
