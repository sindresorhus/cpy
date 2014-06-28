#!/usr/bin/env node
'use strict';
var argv = require('minimist')(process.argv.slice(2));
var pkg = require('./package.json');
var cpy = require('./');
var input = argv._;

function help() {
	console.log([
		pkg.description,
		'',
		'Usage',
		'  $ cpy <source> <destination> [--no-overwrite]',
		'',
		'Example',
		'  $ cpy \'src/*.png\' dist',
		'',
		'<source> can contain globs if quoted'
	].join('\n'));
}

if (input.length === 0 || argv.help) {
	help();
	return;
}

if (argv.version) {
	console.log(pkg.version);
	return;
}

cpy([input[0]], input[1], {overwrite: argv.overwrite});
