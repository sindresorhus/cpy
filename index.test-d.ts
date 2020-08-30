import {expectType} from 'tsd';
import cpy = require('.');
import {ProgressEmitter, ProgressData} from '.';

expectType<Promise<string[]> & ProgressEmitter>(
	cpy(['source/*.png', '!source/goat.png'], 'destination')
);
// FIXME:
// expectType<Promise<string[]> & ProgressEmitter>(
// 	cpy('foo.js', 'destination', {rename: 'foobar'})
// );
// FIXME:
// expectType<Promise<string[]> & ProgressEmitter>(
// 	cpy('foo.js', 'destination', {rename: basename => `prefix-${basename}`})
// );
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {cwd: '/'})
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {parents: true})
);
// FIXME:
// expectType<Promise<string[]> & ProgressEmitter>(
// 	cpy('foo.js', 'destination', {expandDirectories: true})
// 	);
// FIXME:
// expectType<Promise<string[]> & ProgressEmitter>(
// 	cpy('foo.js', 'destination', {overwrite: false})
// );
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {concurrency: 2})
);

expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {filter: (file: cpy.Entry) => true})
);
expectType<Promise<string[]> & ProgressEmitter>(
	cpy('foo.js', 'destination', {filter: async (file: cpy.Entry) => true})
);

expectType<Promise<string[]>>(
	cpy('foo.js', 'destination').on('progress', progress => {
		expectType<ProgressData>(progress);

		expectType<number>(progress.completedFiles);
		expectType<number>(progress.totalFiles);
		expectType<number>(progress.completedSize);
		expectType<number>(progress.percent);
	})
);
