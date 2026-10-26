// Research only: how much backup.mjs adds to a browser bundle (minified, then gzip).
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';

const r = await build({ entryPoints: [new URL('./backup.mjs', import.meta.url).pathname], bundle: true, minify: true, format: 'esm', platform: 'browser', write: false, logLevel: 'warning' });
const js = r.outputFiles[0].contents;
console.log(JSON.stringify({ minified_bytes: js.length, gzip_bytes: gzipSync(js, { level: 9 }).length }));
