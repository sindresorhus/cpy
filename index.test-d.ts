import {expectType} from 'tsd';
import cpy, {ProgressEmitter, ProgressData, Entry} from './index.js';

expectType<Promise<string[]> & ProgressEmitter>(
	cpy(['source/*.png', '!source/goat.png'], 'destination'),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {rename: 'foobar'}),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {rename: basename => `prefix-${basename}`}),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {cwd: '/'}),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {flat: true}),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {overwrite: false}),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {concurrency: 2}),
);

expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {
		filter: file => {
			expectType<Entry>(file);

			expectType<string>(file.path);
			expectType<string>(file.relativePath);
			expectType<string>(file.name);
			expectType<string>(file.nameWithoutExtension);
			expectType<string>(file.extension);
			return true;
		},
	}),
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {filter: async (_file: Entry) => true}),
);

expectType<Promise<string[]>>(
	cpy('foo.js', 'destination').on('progress', progress => {
		expectType<ProgressData>(progress);

		expectType<number>(progress.completedFiles);
		expectType<number>(progress.totalFiles);
		expectType<number>(progress.completedSize);
		expectType<number>(progress.percent);
	}),
);
