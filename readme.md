# cpy [![Build Status](https://travis-ci.org/sindresorhus/cpy.svg?branch=master)](https://travis-ci.org/sindresorhus/cpy)

> Copy files

- Fast by using streams.  
- Resilient by using [graceful-fs](https://github.com/isaacs/node-graceful-fs).  
- User-friendly by accepting [globs](https://github.com/sindresorhus/globby#globbing-patterns) and creating non-existant destination directories.


## Install

```sh
$ npm install --save cpy
```


## Usage

```js
var cpy = require('cpy');

cpy(['src/*.png'], 'dist', function (err) {
	console.log('files copied');
});
```


## API

### cpy(files, destination, [options], [callback])

#### files

*Required*  
Type: `array`

Files to copy.

#### destination

*Required*  
Type: `string`

Destination directory.

#### options

Type: `object`

Options are passed to [cp-file](https://github.com/sindresorhus/cp-file#options) and [glob](https://github.com/isaacs/node-glob#options).

##### cwd

Type: `string`  
Default: `process.cwd()`

The working directory to look for the source files.

##### parents

Type: `boolean`  
Default: `false`

Keep the path structure when copying files.


#### callback(err)

Type: `function`


## CLI

```sh
$ npm install --global cpy
```

```
$ cpy --help

Usage
  $ cpy <source> <destination> [--no-overwrite]

Example
  $ cpy 'src/*.png' dist

<source> can contain globs if quoted
```


## Related

See [cp-file](https://github.com/sindresorhus/cp-file) if you only need to copy a single file.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
