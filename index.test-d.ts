import {expectType} from 'tsd';
import cpy, {type ProgressEmitter, type ProgressData, type Entry} from './index.js';

expectType<Promise<string[]> & ProgressEmitter>(cpy(['source/*.png', '!source/goat.png'], 'destination'));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {rename: 'foobar'}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {rename: (basename: string) => `prefix-${basename}`}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {
	rename(source, destination) {
		expectType<string>(source.path);
		expectType<string>(source.name);
		expectType<string>(source.nameWithoutExtension);
		expectType<string>(source.extension);
		expectType<string>(destination.path);
		expectType<string>(destination.name);
		expectType<string>(destination.nameWithoutExtension);
		expectType<string>(destination.extension);
		destination.extension = 'txt';
	},
}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {cwd: '/'}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {flat: true}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {overwrite: false}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {concurrency: 2}));

expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {
	filter(file) {
		expectType<Entry>(file);

		expectType<string>(file.path);
		expectType<string>(file.relativePath);
		expectType<string>(file.name);
		expectType<string>(file.nameWithoutExtension);
		expectType<string>(file.extension);
		return true;
	},
}));
expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {filter: async (_file: Entry) => true}));

expectType<Promise<string[]> & ProgressEmitter>(cpy('foo.js', 'destination', {
	onProgress(progress) {
		expectType<ProgressData>(progress);

		expectType<number>(progress.completedFiles);
		expectType<number>(progress.totalFiles);
		expectType<number>(progress.completedSize);
		expectType<number>(progress.percent);
		expectType<string>(progress.sourcePath);
		expectType<string>(progress.destinationPath);
	},
}));

// Test that deprecated .on still works but is deprecated
// eslint-disable-next-line @typescript-eslint/no-deprecated
expectType<Promise<string[]>>(cpy('foo.js', 'destination').on('progress', progress => {
	expectType<ProgressData>(progress);

	expectType<number>(progress.completedFiles);
	expectType<number>(progress.totalFiles);
	expectType<number>(progress.completedSize);
	expectType<number>(progress.percent);
	expectType<string>(progress.sourcePath);
	expectType<string>(progress.destinationPath);
}));
