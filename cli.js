#!/usr/bin/env node
'use strict';
var meow = require('meow');
var cpy = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ cpy <source>... <destination> [--no-overwrite] [--parents] [--cwd=<dir>] [--rename=<filename>]',
		'',
		'Example',
		'  $ cpy \'src/*.png\' \'!src/goat.png\' dist',
		'',
		'Options',
		'  --no-overwrite       Don\'t overwrite the destination',
		'  --parents            Preseve path structure',
		'  --cwd=<dir>          Working directory for source files',
		'  --rename=<filename>  Rename all <source> filenames to <filename>',
		'',
		'<source> can contain globs if quoted'
	]
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
	var dest = cli.input.pop();
	cpy(cli.input, dest, {
		cwd: cli.flags.cwd || process.cwd(),
		rename: cli.flags.rename,
		parents: cli.flags.parents,
		overwrite: cli.flags.overwrite !== false,
		nonull: true,
	}, errorHandler);
} catch (err) {
	errorHandler(err);
}
