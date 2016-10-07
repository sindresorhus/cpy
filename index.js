'use strict';
const path = require('path');
const arrify = require('arrify');
const globby = require('globby');
const cpFile = require('cp-file');
const NestedError = require('nested-error-stacks');

class CpyError extends NestedError {
	constructor(message, nested) {
		super(message, nested);
		Object.assign(this, nested);
		this.name = 'CpyError';
	}
}

const preprocessSrcPath = (srcPath, opts) => opts.cwd ? path.resolve(opts.cwd, srcPath) : srcPath;

const preprocessDestPath = (srcPath, dest, opts) => {
	const basename = opts.rename || path.basename(srcPath);
	const dirname = path.dirname(srcPath);

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

	return globby(src, opts)
		.then(files => Promise.all(files.map(srcPath => {
			const from = preprocessSrcPath(srcPath, opts);
			const to = preprocessDestPath(srcPath, dest, opts);

			return cpFile(from, to, opts).catch(err => {
				throw new CpyError(`Cannot copy from \`${from}\` to \`${to}\`: ${err.message}`, err);
			});
		})))
		.catch(err => {
			throw new CpyError(`Cannot glob \`${src}\`: ${err.message}`, err);
		});
};
