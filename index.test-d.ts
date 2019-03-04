import {expectType} from 'tsd-check';
import cpy, {ProgressEmitter, ProgressData} from '.';

expectType<Promise<void> & ProgressEmitter>(
	cpy(['source/*.png', '!source/goat.png'], 'destination')
);
expectType<Promise<void> & ProgressEmitter>(
	cpy('foo.js', 'destination', {rename: 'foobar'})
);
expectType<Promise<void> & ProgressEmitter>(
	cpy('foo.js', 'destination', {rename: basename => `prefix-${basename}`})
);
expectType<Promise<void> & ProgressEmitter>(
	cpy('foo.js', 'destination', {cwd: '/'})
);
expectType<Promise<void> & ProgressEmitter>(
	cpy('foo.js', 'destination', {parents: true})
);
expectType<Promise<void> & ProgressEmitter>(
	cpy('foo.js', 'destination', {expandDirectories: true})
);
expectType<Promise<void> & ProgressEmitter>(
	cpy('foo.js', 'destination', {overwrite: false})
);

expectType<Promise<void>>(
	cpy('foo.js', 'destination').on('progress', progress => {
		expectType<ProgressData>(progress);

		expectType<number>(progress.completedFiles);
		expectType<number>(progress.totalFiles);
		expectType<number>(progress.completedSize);
		expectType<number>(progress.percent);
	})
);
