#!/usr/bin/env node
'use strict';
var meow = require('meow');
var cpy = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ cpy <source> <destination> [--no-overwrite] [--parents] [--cwd <dir>]',
		'',
		'Example',
		'  $ cpy \'src/*.png\' dist',
		'',
		'<source> can contain globs if quoted',
		'--parents whether or not to keep path structure',
		'--cwd <dir> the working directory to look for the source files'
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
		parents: !!cli.flags.parents,
		overwrite: cli.flags.overwrite
	}, errorHandler);
} catch (err) {
	errorHandler(err);
}
