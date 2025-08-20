import process from 'node:process';
import EventEmitter from 'node:events';
import path from 'node:path';
import os from 'node:os';
import pMap from 'p-map';
import {copyFile} from 'copy-file';
import pFilter from 'p-filter';
import {isDynamicPattern} from 'globby';
import micromatch from 'micromatch';
import CpyError from './cpy-error.js';
import GlobPattern from './glob-pattern.js';

/**
@type {import('./index').Options}
*/
const defaultOptions = {
	ignoreJunk: true,
	flat: false,
	cwd: process.cwd(),
};

class Entry {
	/**
	@param {string} source
	@param {string} relativePath
	@param {GlobPattern} pattern
	*/
	constructor(source, relativePath, pattern) {
		/**
		@type {string}
		*/
		this.path = source.split('/').join(path.sep);

		/**
		@type {string}
		*/
		this.relativePath = relativePath.split('/').join(path.sep);

		this.pattern = pattern;

		Object.freeze(this);
	}

	get name() {
		return path.basename(this.path);
	}

	get nameWithoutExtension() {
		return path.basename(this.path, path.extname(this.path));
	}

	get extension() {
		return path.extname(this.path).slice(1);
	}
}

/**
Expand patterns like `'node_modules/{globby,micromatch}'` into `['node_modules/globby', 'node_modules/micromatch']`.

@param {string[]} patterns
@returns {string[]}
*/
const expandPatternsWithBraceExpansion = patterns => patterns.flatMap(pattern => (
	micromatch.braces(pattern, {
		expand: true,
		nodupes: true,
	})
));

/**
@param {object} props
@param {Entry} props.entry
@param {import('./index').Options}
@param {string} props.destination
@returns {string}
*/
const isSelfCopy = (from, to) => path.resolve(to) === path.resolve(from);

const ensureNotSelfCopy = (from, to) => {
	if (isSelfCopy(from, to)) {
		throw new CpyError(`Refusing to copy to itself: \`${from}\``);
	}

	return to;
};

const relativizeWithin = (base, file) => {
	const relativePath = path.relative(base, file);
	if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		return;
	}

	return relativePath;
};

const computeToForGlob = ({entry, destination, options}) => {
	if (options.flat) {
		return path.isAbsolute(destination)
			? path.join(destination, entry.name)
			: path.join(options.cwd, destination, entry.name);
	}

	// Prefer glob-parent behavior to match existing semantics,
	// but defend against self-copy / traversal (#114).
	const from = path.resolve(entry.path);
	const baseA = entry.pattern.normalizedPath; // Glob parent inside cwd
	const baseB = options.cwd;
	const relativePath = relativizeWithin(baseA, entry.path) ?? relativizeWithin(baseB, entry.path) ?? path.basename(entry.path);
	let toPath = path.join(destination, relativePath);

	// Guard: never copy a file into itself (can truncate under concurrency).
	if (isSelfCopy(from, toPath)) {
		const alternativeRelativePath = relativizeWithin(baseB, entry.path);
		const alternativeToPath = alternativeRelativePath
			? path.join(destination, alternativeRelativePath)
			: path.join(destination, path.basename(entry.path));

		toPath = isSelfCopy(from, alternativeToPath)
			? path.join(destination, path.basename(entry.path))
			: alternativeToPath;
	}

	return toPath;
};

const computeToForNonGlob = ({entry, destination, options}) => {
	if (path.isAbsolute(destination)) {
		return ensureNotSelfCopy(entry.path, path.join(destination, entry.name));
	}

	const insideCwd = !path.relative(options.cwd, entry.path).startsWith('..');

	// TODO: This check will not work correctly if `options.cwd` and `entry.path` are on different partitions on Windows, see: https://github.com/sindresorhus/import-local/pull/12
	if (entry.pattern.isDirectory && !insideCwd) {
		const originalDir = path.resolve(options.cwd, entry.pattern.originalPath);
		return path.join(options.cwd, destination, path.basename(originalDir), path.relative(originalDir, entry.path));
	}

	if (!entry.pattern.isDirectory && entry.path === entry.relativePath) {
		return path.join(options.cwd, destination, path.basename(entry.pattern.originalPath), path.relative(entry.pattern.originalPath, entry.path));
	}

	if (!entry.pattern.isDirectory && options.flat) {
		return path.join(options.cwd, destination, path.basename(entry.pattern.originalPath));
	}

	if (!entry.pattern.isDirectory && !insideCwd) {
		return ensureNotSelfCopy(entry.path, path.join(path.resolve(options.cwd, destination), entry.name));
	}

	return ensureNotSelfCopy(entry.path, path.join(options.cwd, destination, path.relative(options.cwd, entry.path)));
};

const preprocessDestinationPath = ({entry, destination, options}) => (
	entry.pattern.hasMagic()
		? computeToForGlob({entry, destination, options})
		: computeToForNonGlob({entry, destination, options})
);

/**
@param {string} source
@param {string|Function} rename
*/
const renameFile = (source, rename) => {
	const directory = path.dirname(source);

	const assertSafeBasename = name => {
		if (typeof name !== 'string') {
			throw new TypeError(`Rename value must be a string, got ${typeof name}`);
		}

		// Disallow any path separators and traversal
		if (name.includes('/') || name.includes('\\')) {
			throw new TypeError('Rename must not contain path separators');
		}

		if (name === '' || name === '.' || name === '..') {
			throw new TypeError('Rename must be a valid filename');
		}

		if (path.basename(name) !== name) {
			throw new TypeError('Rename must be a filename, not a path');
		}

		return name;
	};

	if (typeof rename === 'string') {
		return path.join(directory, assertSafeBasename(rename));
	}

	if (typeof rename === 'function') {
		const filename = path.basename(source);
		const result = rename(filename);
		if (typeof result !== 'string') {
			throw new TypeError(`Rename function must return a string, got ${typeof result}`);
		}

		return path.join(directory, assertSafeBasename(result));
	}

	return source;
};

/**
@param {string|string[]} source
@param {string} destination
@param {import('./index').Options} options
*/
export default function cpy(
	source,
	destination,
	{concurrency = os.availableParallelism(), ...options} = {},
) {
	const copyStatus = new Map();

	/**
	@type {import('events').EventEmitter}
	*/
	const progressEmitter = new EventEmitter();

	options = {
		...defaultOptions,
		...options,
	};

	const promise = (async () => {
		/**
		@type {Entry[]}
		*/
		let entries = [];
		let completedFiles = 0;
		let completedSize = 0;

		/**
		@type {GlobPattern[]}
		*/
		let patterns = expandPatternsWithBraceExpansion([source ?? []].flat())
			.map(string => string.replaceAll('\\', '/'));
		const sources = patterns.filter(item => !item.startsWith('!'));
		const ignore = patterns.filter(item => item.startsWith('!'));

		if (sources.length === 0 || !destination) {
			throw new CpyError('`source` and `destination` required');
		}

		patterns = patterns.map(pattern => new GlobPattern(pattern, destination, {...options, ignore}));

		for (const pattern of patterns) {
			/**
			@type {string[]}
			*/
			let matches = [];

			try {
				matches = pattern.getMatches();
			} catch (error) {
				throw new CpyError(`Cannot glob \`${pattern.originalPath}\`: ${error.message}`, {cause: error});
			}

			if (matches.length === 0 && !isDynamicPattern(pattern.originalPath) && !isDynamicPattern(ignore)) {
				throw new CpyError(`Cannot copy \`${pattern.originalPath}\`: the file doesn't exist`);
			}

			entries = [
				...entries,
				...matches.map(sourcePath => new Entry(sourcePath, path.relative(options.cwd, sourcePath), pattern)),
			];
		}

		if (options.filter !== undefined) {
			entries = await pFilter(entries, options.filter, {concurrency: 1024});
		}

		if (entries.length === 0) {
			const progressData = {
				totalFiles: 0,
				percent: 1,
				completedFiles: 0,
				completedSize: 0,
				sourcePath: '',
				destinationPath: '',
			};

			if (options.onProgress) {
				options.onProgress(progressData);
			}

			progressEmitter.emit('progress', progressData);
		}

		/**
		@param {import('copy-file').ProgressData} event
		*/
		const fileProgressHandler = event => {
			const fileStatus = copyStatus.get(event.sourcePath) || {
				writtenBytes: 0,
				percent: 0,
			};

			if (
				fileStatus.writtenBytes !== event.writtenBytes
				|| fileStatus.percent !== event.percent
			) {
				completedSize -= fileStatus.writtenBytes;
				completedSize += event.writtenBytes;

				if (event.percent === 1 && fileStatus.percent !== 1) {
					completedFiles++;
				}

				copyStatus.set(event.sourcePath, {
					writtenBytes: event.writtenBytes,
					percent: event.percent,
				});

				const progressData = {
					totalFiles: entries.length,
					percent: entries.length === 0 ? 0 : completedFiles / entries.length,
					completedFiles,
					completedSize,
					sourcePath: event.sourcePath,
					destinationPath: event.destinationPath,
				};

				if (options.onProgress) {
					options.onProgress(progressData);
				}

				progressEmitter.emit('progress', progressData);
			}
		};

		return pMap(
			entries,
			async entry => {
				const to = renameFile(
					preprocessDestinationPath({
						entry,
						destination,
						options,
					}),
					options.rename,
				);

				try {
					await copyFile(entry.path, to, {...options, onProgress: fileProgressHandler});
				} catch (error) {
					throw new CpyError(`Cannot copy from \`${entry.relativePath}\` to \`${to}\`: ${error.message}`, {cause: error});
				}

				return to;
			},
			{concurrency},
		);
	})();

	promise.on = (_eventName, callback) => {
		progressEmitter.on(_eventName, callback);
		return promise;
	};

	return promise;
}
