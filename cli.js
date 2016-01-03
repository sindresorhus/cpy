#!/usr/bin/env node
'use strict';
var meow = require('meow');
var cpy = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ cpy <source>... <destination> [--no-overwrite] [--parents] [--cwd=<dir>] [--rename=<filename>]',
		'',
		'Options',
		'  --no-overwrite       Don\'t overwrite the destination',
		'  --parents            Preserve path structure',
		'  --cwd=<dir>          Working directory for source files',
		'  --rename=<filename>  Rename all <source> filenames to <filename>',
		'',
		'<source> can contain globs if quoted',
		'',
		'Examples',
		'  $ cpy \'src/*.png\' \'!src/goat.png\' dist',
		'  copy all .png files in src folder into dist except src/goat.png',
		'',
		'  $ cpy \'**/*.html\' \'../dist/\' --cwd=src --parents',
		'  copy all .html files inside src folder into dist and preserve path structure'
	]
}, {
	string: ['_']
});

cpy(cli.input, cli.input.pop(), {
	cwd: cli.flags.cwd || process.cwd(),
	rename: cli.flags.rename,
	parents: cli.flags.parents,
	overwrite: cli.flags.overwrite !== false,
	nonull: true
}).catch(function (err) {
	if (err.name === 'CpyError') {
		console.error(err.message);
		process.exit(1);
	} else {
		throw err;
	}
});
