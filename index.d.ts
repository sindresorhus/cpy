import {GlobbyOptions} from 'globby';
import {Options as CpFileOptions} from 'cp-file';

export interface Options extends Readonly<GlobbyOptions>, CpFileOptions {
	/**
	 * Working directory to find source files.
	 *
	 * @default process.cwd()
	 */
	readonly cwd?: string;

	/**
	 * Preserve path structure.
	 *
	 * @default false
	 */
	readonly parents?: boolean;

	/**
	 * Filename or function returning a filename used to rename every file in `files`.
	 *
	 * @example
	 *
	 * cpy('foo.js', 'destination', {
	 * 	rename: basename => `prefix-${basename}`
	 * });
	 */
	readonly rename?: string | ((basename: string) => string);
}

export interface ProgressData {
	/**
	 * Copied file count.
	 */
	completedFiles: number;

	/**
	 * Overall file count.
	 */
	totalFiles: number;

	/**
	 * Completed size in bytes.
	 */
	completedSize: number;

	/**
	 * Completed percentage. A value between `0` and `1`.
	 */
	percent: number;
}

export interface ProgressEmitter {
	on(
		event: 'progress',
		handler: (progress: ProgressData) => void
	): Promise<void>;
}

/**
 * Copy files.
 *
 * @param files - Files to copy.
 * @param destination - Destination directory.
 * @param options - Options are passed to [cp-file](https://github.com/sindresorhus/cp-file#options) and [globby](https://github.com/sindresorhus/globby#options).
 */
export default function cpy(
	files: string | ReadonlyArray<string>,
	destination: string,
	options?: Options
): Promise<void> & ProgressEmitter;
