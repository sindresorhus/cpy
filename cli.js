#!/usr/bin/env node
'use strict';
var meow = require('meow');
var cpy = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ cpy <source> [--rename <filename>] <destination> [--no-overwrite] [--parents] [--cwd <dir>]',
		'',
		'Example',
		'  $ cpy \'src/*.png\' dist',
		'',
		'Options',
		'  --rename <filename>  Rename all <source> filenames to <filename>',
		'  --parents            Preseve path structure',
		'  --cwd <dir>          Working directory for source files',
		'',
		'<source> can contain globs if quoted',
	].join('\n')
}, {
	string: ['_']
});

function errorHandler(err) {
	if (err) {
		if (err.name === 'CpyError') {
			console.error(err.message);
			process.exit(1);
		} else {
			throw err;
		}
	}
}

try {
	cpy([cli.input[0]], cli.input[1], {
		cwd: cli.flags.cwd || process.cwd(),
		rename: cli.flags.rename,
		parents: cli.flags.parents,
		overwrite: cli.flags.overwrite
	}, errorHandler);
} catch (err) {
	errorHandler(err);
}
