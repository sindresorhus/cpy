# cpy [![Build Status](https://travis-ci.org/sindresorhus/cpy.svg?branch=master)](https://travis-ci.org/sindresorhus/cpy)

> Copy files


## Why

- Fast by using streams.
- Resilient by using [graceful-fs](https://github.com/isaacs/node-graceful-fs).
- User-friendly by accepting [globs](https://github.com/sindresorhus/globby#globbing-patterns) and creating non-existent destination directories.
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
	await cpy(['source/*.png', '!source/goat.png'], 'destination');
	console.log('Files copied!');
})();
```


## API

### cpy(source, destination, options?)

Returns a `Promise<string[]>` with the destination file paths.

#### source

Type: `string | string[]`

Files to copy.

#### destination

Type: `string`

Destination directory.

#### options

Type: `object`

Options are passed to [globby](https://github.com/sindresorhus/globby#options).

In addition, you can specify the below options.

##### cwd

Type: `string`<br>
Default: `process.cwd()`

Working directory to find source files.

##### overwrite

Type: `boolean`<br>
Default: `true`

Overwrite existing files.

##### parents

Type: `boolean`<br>
Default: `false`

Preserve path structure.

##### rename

Type: `string | Function`

Filename or function returning a filename used to rename every file in `source`.

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
	completedFiles: number,
	totalFiles: number,
	completedSize: number
}
```

- `completedSize` is in bytes
- `percent` is a value between `0` and `1`

Note that the `.on()` method is available only right after the initial `cpy` call, so make sure you add a `handler` before awaiting the promise:

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
