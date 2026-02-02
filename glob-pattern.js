import path from 'node:path';
import fs from 'node:fs';
import {globbySync, isDynamicPattern} from 'globby';
import {isNotJunk} from 'junk';

export default class GlobPattern {
	/**
	@param {string} pattern
	@param {string} destination
	@param {import('.').Options} options
	*/
	constructor(pattern, destination, options) {
		const normalized = path.normalize(pattern);
		// Force POSIX-style separators for globby compatibility across platforms
		const posixNormalized = normalized.split(path.sep).join('/');
		this.path = posixNormalized;
		this.originalPath = pattern;
		this.destination = destination;
		this.options = options;
		this.isDirectory = false;
		this.symlinkTarget = undefined;
		this.symlinkRelative = undefined;

		if (isDynamicPattern(pattern)) {
			return;
		}

		const resolved = path.resolve(options.cwd, pattern);
		if (!fs.existsSync(resolved)) {
			return;
		}

		let lstat;
		try {
			lstat = fs.lstatSync(resolved);
		} catch {
			return;
		}

		const isSymlink = lstat.isSymbolicLink();
		let stats = lstat;
		if (options.followSymbolicLinks !== false) {
			try {
				stats = fs.statSync(resolved);
			} catch {
				return;
			}
		}

		if (!stats.isDirectory()) {
			return;
		}

		if (isSymlink && options.followSymbolicLinks !== false) {
			const realPath = fs.realpathSync(resolved);
			const relative = path.relative(options.cwd, resolved);
			const realRelative = path.relative(options.cwd, realPath);
			this.symlinkTarget = realPath;
			this.symlinkRelative = relative.startsWith('..') ? undefined : relative;
			const realRelativePosix = path.normalize(realRelative || '.').split(path.sep).join('/');
			this.path = [realRelativePosix, '**'].join('/');
		} else {
			const directoryPosix = path.normalize(pattern).split(path.sep).join('/');
			this.path = [directoryPosix, '**'].join('/');
		}

		this.isDirectory = true;
	}

	get name() {
		return path.basename(this.originalPath);
	}

	get normalizedPath() {
		const normalizedPattern = this.path.startsWith('!') && !this.path.startsWith('!(')
			? this.path.slice(1)
			: this.path;
		const segments = normalizedPattern.split('/');
		const magicIndex = segments.findIndex(item => item ? isDynamicPattern(item) : false);
		const normalized = segments.slice(0, magicIndex).join('/');

		if (normalized) {
			return path.isAbsolute(normalized)
				? path.normalize(normalized)
				: path.normalize(path.join(this.options.cwd, normalized));
		}

		return this.options.cwd;
	}

	hasMagic() {
		return isDynamicPattern(this.options.flat ? this.path : this.originalPath);
	}

	getMatches() {
		let matches = globbySync(this.path, {
			...this.options,
			absolute: true,
			onlyFiles: true,
		});

		if (this.options.ignoreJunk) {
			matches = matches.filter(file => isNotJunk(path.basename(file)));
		}

		return matches;
	}
}
