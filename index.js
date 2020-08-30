'use strict';
const EventEmitter = require('events');
const {
	basename,
	extname,
	join,
	relative,
	sep,
	isAbsolute
} = require('path');
const os = require('os');
const pMap = require('p-map');
const arrify = require('arrify');
const cpFile = require('cp-file');
const pFilter = require('p-filter');
const CpyError = require('./cpy-error');
const GlobPattern = require('./glob-pattern');
const {glob} = require('glob');

/**
 * @typedef {object} Options
 * @property {number} concurrency
 * @property {boolean} ignoreJunk
 * @property {boolean} flat
 * @property {string} cwd
 * @property {boolean} overwrite
 */

const defaultConcurrency = (os.cpus().length || 1) * 2;

/**
 * @type {Options}
 */
const defaultOptions = {
	ignoreJunk: true,
	flat: false,
	cwd: process.cwd()
};

class Entry {
	/**
	 * @param {string} path
	 * @param {GlobPattern} pattern
	 */
	constructor(path, pattern) {
		this.path = path.split('/').join(sep);
		this.pattern = pattern;
		Object.freeze(this);
	}

	get name() {
		return basename(this.path);
	}

	get nameWithoutExtension() {
		return basename(this.path, extname(this.path));
	}

	get extension() {
		return extname(this.path).slice(1);
	}
}

/**
 * @param {object} props
 * @param {Entry} props.entry
 * @param {Options} props.options
 * @param {string} props.destination
 * @returns {string}
 */
const preprocessDestinationPath = ({entry, destination, options}) => {
	if (entry.pattern.hasMagic()) {
		if (options.flat) {
			return join(destination, entry.name);
		}

		if (isAbsolute(destination)) {
			return join(
				destination,
				relative(entry.pattern.normalizedPath, entry.path)
			);
		}

		return join(
			destination,
			relative(entry.pattern.normalizedPath, entry.path)
		);
	}

	if (isAbsolute(destination)) {
		return join(destination, entry.name);
	}

	return join(options.cwd, destination, relative(options.cwd, entry.path));
};

/**
 * @param {string} source
 * @param {string} destination
 * @param {Options} options
 */
const cpy = (
	source,
	destination,
	{concurrency = defaultConcurrency, ...options} = {}
) => {
	/**
	 * @type {Map<string, {written: number, percent: number}>}
	 */
	const copyStatus = new Map();

	/**
	 * @type {import('events').EventEmitter}
	 */
	const progressEmitter = new EventEmitter();

	options = {
		...defaultOptions,
		...options
	};

	const promise = (async () => {
		/**
		 * @type {Entry[]}
		 */
		let entries = [];
		let completedFiles = 0;
		let completedSize = 0;
		/**
		 * @type {GlobPattern[]}
		 */
		let patterns = arrify(source).map(str => {
			return str.split(sep).join('/');
		});

		if (patterns.length === 0 || !destination) {
			throw new CpyError('`source` and `destination` required');
		}

		patterns = patterns.map(
			pattern => new GlobPattern(pattern, destination, options)
		);

		for (const pattern of patterns) {
			/**
			 * @type {string[]}
			 */
			let matches = [];

			try {
				matches = pattern.getMatches();
			} catch (error) {
				throw new CpyError(
					`Cannot glob \`${pattern.originalPath}\`: ${error.message}`,
					error
				);
			}

			if (matches.length === 0 && !glob.hasMagic(pattern.originalPath)) {
				throw new CpyError(
					`Cannot copy \`${pattern.originalPath}\`: the file doesn't exist`
				);
			}

			entries = [].concat(
				entries,
				matches.map(sourcePath => new Entry(sourcePath, pattern))
			);
		}

		if (options.filter !== undefined) {
			entries = await pFilter(entries, options.filter, {concurrency: 1024});
		}

		if (entries.length === 0) {
			progressEmitter.emit('progress', {
				totalFiles: 0,
				percent: 1,
				completedFiles: 0,
				completedSize: 0
			});
		}

		/**
		 * @param {import('cp-file').ProgressData} event
		 */
		const fileProgressHandler = event => {
			const fileStatus = copyStatus.get(event.src) || {
				written: 0,
				percent: 0
			};

			if (
				fileStatus.written !== event.written ||
				fileStatus.percent !== event.percent
			) {
				completedSize -= fileStatus.written;
				completedSize += event.written;

				if (event.percent === 1 && fileStatus.percent !== 1) {
					completedFiles++;
				}

				copyStatus.set(event.src, {
					written: event.written,
					percent: event.percent
				});

				progressEmitter.emit('progress', {
					totalFiles: entries.length,
					percent: completedFiles / entries.length,
					completedFiles,
					completedSize
				});
			}
		};

		return pMap(
			entries,
			async entry => {
				const to = preprocessDestinationPath({
					entry,
					destination,
					options
				});

				try {
					await cpFile(entry.path, to, options).on(
						'progress',
						fileProgressHandler
					);
				} catch (error) {
					// If (/EISDIR/.test(error.message)) {
					// 	try {
					// 		await mkdirp(to);
					// 	} catch (error) {
					// 		throw new CpyError(
					// 			`Cannot copy from \`${entry.relativePath}\` to \`${to}\`: ${error.message}`,
					// 			error
					// 		);
					// 	}
					// } else {
					throw new CpyError(
						`Cannot copy from \`${entry.relativePath}\` to \`${to}\`: ${error.message}`,
						error
					);
					// }
				}

				return to;
			},
			{concurrency}
		);
	})();

	promise.on = (...arguments_) => {
		progressEmitter.on(...arguments_);
		return promise;
	};

	return promise;
};

module.exports = cpy;
