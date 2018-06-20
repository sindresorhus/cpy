'use strict';
const EventEmitter = require('events');
const path = require('path');
const arrify = require('arrify');
const globby = require('globby');
const cpFile = require('cp-file');
const CpyError = require('./cpy-error');

const preprocessSrcPath = (srcPath, options) => options.cwd ? path.resolve(options.cwd, srcPath) : srcPath;

const preprocessDestPath = (srcPath, dest, options) => {
	let basename = path.basename(srcPath);
	const dirname = path.dirname(srcPath);

	if (typeof options.rename === 'string') {
		basename = options.rename;
	} else if (typeof options.rename === 'function') {
		basename = options.rename(basename);
	}

	if (options.cwd) {
		dest = path.resolve(options.cwd, dest);
	}

	if (options.parents) {
		return path.join(dest, dirname, basename);
	}

	return path.join(dest, basename);
};

module.exports = (src, dest, options = {}) => {
	src = arrify(src);

	const progressEmitter = new EventEmitter();

	if (src.length === 0 || !dest) {
		const promise = Promise.reject(new CpyError('`files` and `destination` required'));
		promise.on = (...args) => {
			progressEmitter.on(...args);
			return promise;
		};
		return promise;
	}

	const copyStatus = new Map();
	let completedFiles = 0;
	let completedSize = 0;

	const promise = globby(src, options)
		.catch(err => {
			throw new CpyError(`Cannot glob \`${src}\`: ${err.message}`, err);
		})
		.then(files => {
			if (files.length === 0) {
				progressEmitter.emit('progress', {
					totalFiles: 0,
					percent: 1,
					completedFiles: 0,
					completedSize: 0
				});
			}

			return Promise.all(files.map(srcPath => {
				const from = preprocessSrcPath(srcPath, options);
				const to = preprocessDestPath(srcPath, dest, options);

				return cpFile(from, to, options)
					.on('progress', event => {
						const fileStatus = copyStatus.get(event.src) || {written: 0, percent: 0};

						if (fileStatus.written !== event.written || fileStatus.percent !== event.percent) {
							completedSize -= fileStatus.written;
							completedSize += event.written;

							if (event.percent === 1 && fileStatus.percent !== 1) {
								completedFiles++;
							}

							copyStatus.set(event.src, {written: event.written, percent: event.percent});

							progressEmitter.emit('progress', {
								totalFiles: files.length,
								percent: completedFiles / files.length,
								completedFiles,
								completedSize
							});
						}
					})
					.catch(err => {
						throw new CpyError(`Cannot copy from \`${from}\` to \`${to}\`: ${err.message}`, err);
					});
			}));
		});

	promise.on = (...args) => {
		progressEmitter.on(...args);
		return promise;
	};

	return promise;
};
