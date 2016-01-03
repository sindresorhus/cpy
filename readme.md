# cpy [![Build Status](https://travis-ci.org/sindresorhus/cpy.svg?branch=master)](https://travis-ci.org/sindresorhus/cpy)

> Copy files

- Fast by using streams.
- Resilient by using [graceful-fs](https://github.com/isaacs/node-graceful-fs).
- User-friendly by accepting [globs](https://github.com/sindresorhus/globby#globbing-patterns) and creating non-existant destination directories.
- User-friendly error messages.


## Install

```
$ npm install --save cpy
```


## Usage

```js
const cpy = require('cpy');

cpy(['src/*.png', '!src/goat.png'], 'dist']).then(() => {
	console.log('files copied');
});
```


## API

### cpy(files, destination, [options])

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

##### rename

Type: `string`

The filename which is used to rename every file in `files`.


## CLI

```
$ npm install --global cpy
```

```
$ cpy --help

  Copy files

  Usage
    $ cpy <source>... <destination> [--no-overwrite] [--parents] [--cwd=<dir>] [--rename=<filename>]

  Options
    --no-overwrite       Don't overwrite the destination
    --parents            Preserve path structure
    --cwd=<dir>          Working directory for source files
    --rename=<filename>  Rename all <source> filenames to <filename>

  <source> can contain globs if quoted

  Examples
    $ cpy 'src/*.png' '!src/goat.png' dist
    copy all .png files in src folder into dist except src/goat.png

    $ cpy '**/*.html' '../dist/' --cwd=src --parents
    copy all .html files inside src folder into dist and preserve path structure
```


## Related

See [`cp-file`](https://github.com/sindresorhus/cp-file) if you only need to copy a single file.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
