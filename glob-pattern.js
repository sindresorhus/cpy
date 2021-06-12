'use strict';
const glob = require('glob');
const junk = require('junk');
const {join, basename, isAbsolute} = require('path');
const {existsSync, lstatSync} = require('fs');

class GlobPattern {
	/**
	 * @param {string} pattern
	 * @param {string} destination
	 * @param {import('.').Options} options
	 * @param {GlobSync} globSyncInstance
	 */
	constructor(pattern, destination, options, globSyncInstance) {
		this.path = pattern;
		this.originalPath = pattern;
		this.destination = destination;
		this.options = options;
		this.globSyncInstance = globSyncInstance;

		if (
			!glob.hasMagic(pattern) &&
			existsSync(pattern) &&
			lstatSync(pattern).isDirectory()
		) {
			this.path = join(pattern, '**');
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
		let matches = new glob.GlobSync(this.path, this.globSyncInstance || {
			...this.options,
			dot: true,
			absolute: true,
			nodir: true
		}).found;

		if (this.options.ignoreJunk) {
			matches = matches.filter(file => junk.not(basename(file)));
		}

		return matches;
	}
}

module.exports = GlobPattern;
