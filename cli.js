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

try {
	cpy([cli.input[0]], cli.input[1], {overwrite: cli.flags.overwrite}, function (err) {
		if (err) {
			console.error(err.toLocaleString());
			process.exit(1);
		}
	});
} catch (err) {
	console.error(err.toLocaleString());
	process.exit(1);
}
