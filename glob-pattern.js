'use strict';
const glob = require('globby');
const junk = require('junk');
const {join, basename, isAbsolute} = require('path');
const {existsSync, lstatSync} = require('fs');

class GlobPattern {
	/**
	 * @param {string} pattern
	 * @param {string} destination
	 * @param {import('.').Options} options
	 */
	constructor(pattern, destination, options) {
		this.path = pattern;
		this.originalPath = pattern;
		this.destination = destination;
		this.options = options;

		if (
			!glob.hasMagic(pattern) &&
			existsSync(pattern) &&
			lstatSync(pattern).isDirectory()
		) {
			this.path = [pattern, '**'].join('/');
		}
	}

	get name() {
		return basename(this.originalPath);
	}

	get normalizedPath() {
		const segments = this.originalPath.split('/');
		const magicIndex = segments.findIndex(glob.hasMagic);
		const normalized = segments.slice(0, magicIndex).join('/');

		if (normalized) {
			return isAbsolute(normalized) ? normalized : join(this.options.cwd, normalized);
		}

		return this.destination;
	}

	hasMagic() {
		return glob.hasMagic(this.originalPath);
	}

	getMatches() {
		let matches = glob.sync(this.path, {
			...this.options,
			dot: true,
			absolute: true,
			onlyFiles: true
		});

		if (this.options.ignoreJunk) {
			matches = matches.filter(file => junk.not(basename(file)));
		}

		return matches;
	}
}

module.exports = GlobPattern;
