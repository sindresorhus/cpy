'use strict';
const EventEmitter = require('events');
const path = require('path');
const arrify = require('arrify');
const globby = require('globby');
const cpFile = require('cp-file');
const CpyError = require('./cpy-error');

const preprocessSrcPath = (srcPath, opts) => opts.cwd ? path.resolve(opts.cwd, srcPath) : srcPath;

const preprocessDestPath = (srcPath, dest, opts) => {
	let basename = path.basename(srcPath);
	const dirname = path.dirname(srcPath);

	if (typeof opts.rename === 'string') {
		basename = opts.rename;
	} else if (typeof opts.rename === 'function') {
		basename = opts.rename(basename);
	}

	if (opts.cwd) {
		dest = path.resolve(opts.cwd, dest);
	}

	if (opts.parents) {
		return path.join(dest, dirname, basename);
	}

	return path.join(dest, basename);
};

module.exports = (src, dest, opts) => {
	src = arrify(src);
	opts = opts || {};

	if (src.length === 0 || !dest) {
		return Promise.reject(new CpyError('`files` and `destination` required'));
	}

	const progressEmitter = new EventEmitter();
	const copyStatus = new Map();
	let completedFiles = 0;
	let completedSize = 0;

	const promise = globby(src, opts)
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
				const from = preprocessSrcPath(srcPath, opts);
				const to = preprocessDestPath(srcPath, dest, opts);

				return cpFile(from, to, opts)
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

	promise.on = function () {
		progressEmitter.on.apply(progressEmitter, arguments);
		return promise;
	};

	return promise;
};
