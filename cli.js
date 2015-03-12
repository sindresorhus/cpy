#!/usr/bin/env node
'use strict';
var meow = require('meow');
var cpy = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ cpy <source> <destination> [--no-overwrite]',
		'',
		'Example',
		'  $ cpy \'src/*.png\' dist',
		'',
		'<source> can contain globs if quoted'
	].join('\n')
}, {
	string: ['_']
});

function errorHandler(err) {
	if (err) {
		console.error(err.message);
		process.exit(1);
	}
}

try {
	cpy([cli.input[0]], cli.input[1], {overwrite: cli.flags.overwrite}, errorHandler);
} catch (err) {
	errorHandler(err);
}
