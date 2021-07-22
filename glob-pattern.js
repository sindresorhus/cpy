import path from 'node:path';
import fs from 'node:fs';
import {globbySync, isDynamicPattern} from 'globby';
import junk from 'junk';

export default class GlobPattern {
	/**
	@param {string} pattern
	@param {string} destination
	@param {import('.').Options} options
	*/
	constructor(pattern, destination, options) {
		this.path = pattern;
		this.originalPath = pattern;
		this.destination = destination;
		this.options = options;

		if (
			!isDynamicPattern(pattern)
				&& fs.existsSync(pattern)
				&& fs.lstatSync(pattern).isDirectory()
		) {
			this.path = [pattern, '**'].join('/');
		}
	}

	get name() {
		return path.basename(this.originalPath);
	}

	get normalizedPath() {
		const segments = this.originalPath.split('/');
		const magicIndex = segments.findIndex(item => item ? isDynamicPattern(item) : false);
		const normalized = segments.slice(0, magicIndex).join('/');

		if (normalized) {
			return path.isAbsolute(normalized) ? normalized : path.join(this.options.cwd, normalized);
		}

		return this.destination;
	}

	hasMagic() {
		return isDynamicPattern(this.options.flat ? this.path : this.originalPath);
	}

	getMatches() {
		let matches = globbySync(this.path, {
			...this.options,
			dot: true,
			absolute: true,
			onlyFiles: true,
		});

		if (this.options.ignoreJunk) {
			matches = matches.filter(file => junk.not(path.basename(file)));
		}

		return matches;
	}
}
