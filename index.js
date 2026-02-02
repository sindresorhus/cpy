import process from 'node:process';
import EventEmitter from 'node:events';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
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

const assertBasename = (name, label, valueLabel = label) => {
	if (typeof name !== 'string') {
		throw new TypeError(`${valueLabel} must be a string, got ${typeof name}`);
	}

	// Disallow any path separators and traversal
	if (name.includes('/') || name.includes('\\')) {
		throw new TypeError(`${label} must not contain path separators`);
	}

	if (name === '' || name === '.' || name === '..') {
		throw new TypeError(`${label} must be a valid filename`);
	}

	if (path.basename(name) !== name) {
		throw new TypeError(`${label} must be a filename, not a path`);
	}

	return name;
};

const assertRenameBasename = name => assertBasename(name, 'Rename', 'Rename value');
const assertDestinationBasename = (name, label) => assertBasename(name, label);

const assertDestinationExtension = extension => {
	if (typeof extension !== 'string') {
		throw new TypeError(`Destination extension must be a string, got ${typeof extension}`);
	}

	let normalizedExtension = extension;

	if (normalizedExtension.startsWith('.')) {
		normalizedExtension = normalizedExtension.slice(1);
	}

	if (normalizedExtension.includes('/') || normalizedExtension.includes('\\')) {
		throw new TypeError('Destination extension must not contain path separators');
	}

	if (normalizedExtension.includes('.')) {
		throw new TypeError('Destination extension must not include dots');
	}

	return normalizedExtension;
};

let hasWarnedAboutLegacyRename = false;

const warnAboutLegacyRename = () => {
	if (hasWarnedAboutLegacyRename) {
		return;
	}

	hasWarnedAboutLegacyRename = true;
	process.emitWarning('The rename callback with a single basename argument is deprecated and will be removed in the next major release. Use rename(source, destination) instead.', {
		code: 'CPY_RENAME_DEPRECATED',
		type: 'DeprecationWarning',
	});
};

const hasSecondParameter = function_ => {
	const source = Function.prototype.toString.call(function_).trim();
	const arrowIndex = source.indexOf('=>');
	const parenIndex = source.indexOf('(');
	if (parenIndex === -1) {
		return false;
	}

	if (arrowIndex !== -1 && parenIndex > arrowIndex) {
		return false;
	}

	const endIndex = source.indexOf(')', parenIndex + 1);
	if (endIndex === -1) {
		return false;
	}

	const parameters = source.slice(parenIndex + 1, endIndex);
	return parameters.includes(',');
};

const parseBasename = basename => {
	const extension = path.extname(basename);
	return {
		name: basename,
		nameWithoutExtension: path.basename(basename, extension),
		extension: extension.slice(1),
	};
};

const createSourceFile = filePath => Object.freeze({
	path: filePath,
	...parseBasename(path.basename(filePath)),
});

const createDestinationFile = filePath => {
	const directory = path.dirname(filePath);
	const resolvedDirectory = path.resolve(directory);
	let {name, nameWithoutExtension, extension} = parseBasename(path.basename(filePath));
	let resolvedPath = filePath;

	const updateNameValues = nextName => {
		({name, nameWithoutExtension, extension} = parseBasename(nextName));
		resolvedPath = path.join(directory, name);
	};

	const updatePath = nextPath => {
		if (typeof nextPath !== 'string') {
			throw new TypeError(`Destination path must be a string, got ${typeof nextPath}`);
		}

		const resolvedNextPath = path.resolve(directory, nextPath);
		const nextDirectory = path.dirname(resolvedNextPath);
		if (nextDirectory !== resolvedDirectory) {
			throw new TypeError('Destination path must stay within the destination directory');
		}

		const nextName = path.basename(resolvedNextPath);
		assertDestinationBasename(nextName, 'Destination path');
		updateNameValues(nextName);
	};

	const updateName = nextName => {
		assertDestinationBasename(nextName, 'Destination name');
		updateNameValues(nextName);
	};

	const updateNameWithoutExtension = nextNameWithoutExtension => {
		assertDestinationBasename(nextNameWithoutExtension, 'Destination nameWithoutExtension');
		nameWithoutExtension = nextNameWithoutExtension;
		name = extension === '' ? nameWithoutExtension : `${nameWithoutExtension}.${extension}`;
		resolvedPath = path.join(directory, name);
	};

	const updateExtension = nextExtension => {
		extension = assertDestinationExtension(nextExtension);
		name = extension === '' ? nameWithoutExtension : `${nameWithoutExtension}.${extension}`;
		resolvedPath = path.join(directory, name);
	};

	const destination = {};
	Object.defineProperties(destination, {
		path: {
			get() {
				return resolvedPath;
			},
			set(value) {
				updatePath(value);
			},
			enumerable: true,
		},
		name: {
			get() {
				return name;
			},
			set(value) {
				updateName(value);
			},
			enumerable: true,
		},
		nameWithoutExtension: {
			get() {
				return nameWithoutExtension;
			},
			set(value) {
				updateNameWithoutExtension(value);
			},
			enumerable: true,
		},
		extension: {
			get() {
				return extension;
			},
			set(value) {
				updateExtension(value);
			},
			enumerable: true,
		},
	});

	return destination;
};

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
@param {string} from - Source path
@param {string} to - Destination path
@returns {boolean}
*/
const resolveCopyPath = (filePath, cwd) => path.isAbsolute(filePath)
	? path.normalize(filePath)
	: path.resolve(cwd, filePath);

const isSelfCopy = (from, to, cwd = process.cwd()) => resolveCopyPath(to, cwd) === resolveCopyPath(from, cwd);

const relativizeWithin = (base, file) => {
	const relativePath = path.relative(base, file);
	if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		return;
	}

	return relativePath;
};

const resolveRelativePath = (bases, file) => {
	for (const base of bases) {
		const relativePath = relativizeWithin(base, file);
		if (relativePath !== undefined) {
			return relativePath;
		}
	}

	return path.basename(file);
};

const resolveCwdRelativePathForGlob = (entry, options) => {
	const relativeToCwd = relativizeWithin(options.cwd, entry.path);
	if (relativeToCwd !== undefined) {
		return relativeToCwd;
	}

	const globParent = entry.pattern.normalizedPath;
	const relativeToGlobParent = relativizeWithin(globParent, entry.path);
	if (relativeToGlobParent !== undefined) {
		const globParentBasename = path.basename(globParent);
		return globParentBasename === '' ? relativeToGlobParent : path.join(globParentBasename, relativeToGlobParent);
	}

	return path.basename(entry.path);
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
	const baseA = entry.pattern.normalizedPath; // Glob parent path
	const baseB = options.cwd;
	const relativePath = options.base === 'cwd'
		? resolveCwdRelativePathForGlob(entry, options)
		: resolveRelativePath([baseA, baseB], entry.path);
	let toPath = path.join(destination, relativePath);

	// Guard: never copy a file into itself (can truncate under concurrency).
	if (isSelfCopy(from, toPath, options.cwd)) {
		const alternativeRelativePath = relativizeWithin(baseB, entry.path);
		const alternativeToPath = alternativeRelativePath
			? path.join(destination, alternativeRelativePath)
			: path.join(destination, path.basename(entry.path));

		toPath = isSelfCopy(from, alternativeToPath, options.cwd)
			? path.join(destination, path.basename(entry.path))
			: alternativeToPath;
	}

	return toPath;
};

const computeToForNonGlob = ({entry, destination, options}) => {
	const baseDestination = path.isAbsolute(destination)
		? destination
		: path.join(options.cwd, destination);

	if (options.base === 'pattern') {
		const patternBase = entry.pattern.isDirectory
			? path.resolve(options.cwd, entry.pattern.originalPath)
			: path.resolve(options.cwd, path.dirname(entry.pattern.originalPath));
		const relativePath = resolveRelativePath([patternBase], entry.path);
		return path.join(baseDestination, relativePath);
	}

	const relativeToCwd = relativizeWithin(options.cwd, entry.path);
	const insideCwd = relativeToCwd !== undefined;

	if (entry.pattern.isDirectory && entry.pattern.symlinkTarget !== undefined) {
		const relativeToTarget = path.relative(entry.pattern.symlinkTarget, entry.path);
		if (!relativeToTarget.startsWith('..') && !path.isAbsolute(relativeToTarget)) {
			const symlinkBase = entry.pattern.symlinkRelative ?? path.basename(entry.pattern.originalPath);
			return path.join(baseDestination, symlinkBase, relativeToTarget);
		}
	}

	// This check should treat different partitions on Windows as outside the cwd.
	if (entry.pattern.isDirectory && !insideCwd) {
		const originalDir = path.resolve(options.cwd, entry.pattern.originalPath);
		return path.join(baseDestination, path.basename(originalDir), path.relative(originalDir, entry.path));
	}

	if (!entry.pattern.isDirectory && entry.path === entry.relativePath) {
		return path.join(baseDestination, path.basename(entry.pattern.originalPath), path.relative(entry.pattern.originalPath, entry.path));
	}

	if (!entry.pattern.isDirectory && options.flat) {
		return path.join(baseDestination, path.basename(entry.pattern.originalPath));
	}

	if (!entry.pattern.isDirectory && !insideCwd) {
		return path.join(baseDestination, entry.name);
	}

	if (relativeToCwd === undefined) {
		return path.join(baseDestination, entry.name);
	}

	return path.join(baseDestination, relativeToCwd);
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
const renameFile = ({source, destination, rename}) => {
	const directory = path.dirname(destination);

	if (typeof rename === 'string') {
		return path.join(directory, assertRenameBasename(rename));
	}

	if (typeof rename === 'function') {
		const isLegacyRename = rename.length <= 1 && !hasSecondParameter(rename);
		if (isLegacyRename) {
			warnAboutLegacyRename();
			const filename = path.basename(destination);
			const result = rename(filename);
			const isStringObject = result !== null
				&& typeof result === 'object'
				&& Object.prototype.toString.call(result) === '[object String]';
			if (typeof result !== 'string' && !isStringObject) {
				throw new TypeError(`Rename function with a single parameter must return a string, got ${typeof result}. Use rename(source, destination) for the object form.`);
			}

			return path.join(directory, assertRenameBasename(String(result)));
		}

		const sourceFile = createSourceFile(source);
		const destinationFile = createDestinationFile(destination);
		const result = rename(sourceFile, destinationFile);
		if (result !== undefined) {
			const isStringObject = result !== null
				&& typeof result === 'object'
				&& Object.prototype.toString.call(result) === '[object String]';
			if (typeof result === 'string' || isStringObject) {
				warnAboutLegacyRename();
				return path.join(directory, assertRenameBasename(String(result)));
			}

			throw new TypeError(`Rename function must return a string (legacy) or undefined (object form), got ${typeof result}`);
		}

		return destinationFile.path;
	}

	return destination;
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

	/**
	@param {GlobPattern[]} patterns
	@param {string[]} ignorePatterns
	@returns {Promise<Entry[]>}
	*/
	const getEntries = async (patterns, ignorePatterns) => {
		let entries = [];

		for (const pattern of patterns) {
			/**
			@type {string[]}
			*/
			let matches = [];

			try {
				matches = pattern.getMatches();
			} catch (error) {
				options.signal?.throwIfAborted();
				throw new CpyError(`Cannot glob \`${pattern.originalPath}\`: ${error.message}`, {cause: error});
			}

			if (matches.length === 0 && !isDynamicPattern(pattern.originalPath) && !isDynamicPattern(ignorePatterns)) {
				throw new CpyError(`Cannot copy \`${pattern.originalPath}\`: the file doesn't exist`);
			}

			for (const sourcePath of matches) {
				entries.push(new Entry(sourcePath, path.relative(options.cwd, sourcePath), pattern));
			}
		}

		if (options.filter !== undefined) {
			entries = await pFilter(entries, options.filter, {
				concurrency: 1024,
				signal: options.signal,
			});
		}

		return entries;
	};

	const promise = (async () => {
		options.signal?.throwIfAborted();

		if (options.base !== undefined && options.base !== 'cwd' && options.base !== 'pattern') {
			throw new TypeError('`base` must be "cwd" or "pattern"');
		}

		/**
		@type {Entry[]}
		*/
		let entries = [];
		let completedFiles = 0;
		let completedSize = 0;

		const rawPatterns = [source ?? []].flat();
		if (rawPatterns.some(pattern => typeof pattern !== 'string')) {
			throw new TypeError('`source` must be a string or an array of strings');
		}

		if (rawPatterns.includes('')) {
			throw new CpyError('`source` must not contain empty strings');
		}

		/**
		@type {GlobPattern[]}
		*/
		let patterns = expandPatternsWithBraceExpansion(rawPatterns)
			.map(string => string.replaceAll('\\', '/'));
		const sources = patterns.filter(item => !item.startsWith('!'));
		const ignore = patterns.filter(item => item.startsWith('!'));

		if (sources.length === 0 || !destination) {
			throw new CpyError('`source` and `destination` required');
		}

		patterns = patterns.map(pattern => new GlobPattern(pattern, destination, {...options, ignore}));

		entries = await getEntries(patterns, ignore);

		options.signal?.throwIfAborted();

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
		const fileProgressHandler = (statusKey, event) => {
			const fileStatus = copyStatus.get(statusKey) || {
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

				copyStatus.set(statusKey, {
					writtenBytes: event.writtenBytes,
					percent: event.percent,
				});

				const progressData = {
					totalFiles: entries.length,
					percent: completedFiles / entries.length,
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

		const copyFileMapper = async entry => {
			let to = preprocessDestinationPath({
				entry,
				destination,
				options,
			});

			// Apply rename after computing the base destination path
			to = renameFile({
				source: entry.path,
				destination: to,
				rename: options.rename,
			});

			// Check for self-copy after rename has been applied
			if (isSelfCopy(entry.path, to, options.cwd)) {
				throw new CpyError(`Refusing to copy to itself: \`${entry.path}\``);
			}

			const statusKey = `${entry.path}\0${to}`;

			try {
				await copyFile(entry.path, to, {
					...options,
					onProgress(event) {
						fileProgressHandler(statusKey, event);
					},
				});

				if (options.preserveTimestamps) {
					options.signal?.throwIfAborted();
					const stats = await fs.stat(entry.path);
					await fs.utimes(to, stats.atime, stats.mtime);
				}
			} catch (error) {
				options.signal?.throwIfAborted();
				throw new CpyError(`Cannot copy from \`${entry.relativePath}\` to \`${to}\`: ${error.message}`, {cause: error});
			}

			return to;
		};

		return pMap(entries, copyFileMapper, {
			concurrency,
			signal: options.signal,
		});
	})();

	promise.on = (_eventName, callback) => {
		progressEmitter.on(_eventName, callback);
		return promise;
	};

	return promise;
}
