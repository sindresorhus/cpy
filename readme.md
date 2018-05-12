# cpy [![Build Status](https://travis-ci.org/sindresorhus/cpy.svg?branch=master)](https://travis-ci.org/sindresorhus/cpy)

> Copy files


## Why

- Fast by using streams.
- Resilient by using [graceful-fs](https://github.com/isaacs/node-graceful-fs).
- User-friendly by accepting [globs](https://github.com/sindresorhus/globby#globbing-patterns) and creating non-existant destination directories.
- User-friendly error messages.
- Progress reporting.


## Install

```
$ npm install cpy
```


## Usage

```js
const cpy = require('cpy');

(async () => {
	await cpy(['src/*.png', '!src/goat.png'], 'dist');
	console.log('Files copied!');
})();
```


## API

### cpy(files, destination, [options])

#### files

Type: `string` `Array`

Files to copy.

#### destination

Type: `string`

Destination directory.

#### options

Type: `Object`

Options are passed to [cp-file](https://github.com/sindresorhus/cp-file#options) and [globby](https://github.com/sindresorhus/globby#options).

##### cwd

Type: `string`<br>
Default: `process.cwd()`

Working directory to find source files.

##### parents

Type: `boolean`<br>
Default: `false`

Preserve path structure.

##### rename

Type: `string` `Function`

Filename or function returning a filename used to rename every file in `files`.

```js
cpy('foo.js', 'destination', {
	rename: basename => `prefix-${basename}`
});
```


## Progress reporting

### cpy.on('progress', handler)

#### handler(progress)

Type: `Function`

##### progress

```js
{
	completedFiles: Number,
	totalFiles: Number,
	completedSize: Number
}
```

- `completedSize` is in bytes
- `percent` is a value between `0` and `1`

Note that the `.on()` method is available only right after the initial `cpy` call, so make sure you add a `handler` before calling `.then()`:

```js
(async () => {
	await cpy(source, destination).on('progress', progress => {
		// …
	});
})();
```


## Related

- [cpy-cli](https://github.com/sindresorhus/cpy-cli) - CLI for this module
- [cp-file](https://github.com/sindresorhus/cp-file) - Copy a single file
- [move-file](https://github.com/sindresorhus/move-file) - Move a file
- [make-dir](https://github.com/sindresorhus/make-dir) - Make a directory and its parents if needed


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
