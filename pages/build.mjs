import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../',import.meta.url));
const output = resolve(process.argv[2] ?? 'dist-pages');
await mkdir(output,{recursive:true});
if ((await readdir(output)).some(name=>name!=='.git')) throw new Error('Use an empty Pages output directory.');
const market = resolve(output,'market');
const dependencies = resolve(project,'pages/node_modules/sql.js');

await cp(resolve(project,'public/market'),market,{recursive:true,filter:source=>!source.endsWith('/index.html')});
const index = await readFile(resolve(project,'public/market/index.html'),'utf8');
await writeFile(resolve(output,'index.html'),index
  .replace('<html lang="en-LK">','<html lang="en-LK" data-demo="pages">')
  .replaceAll('"/market/','"./market/')
  .replace('<script type="module"','<script src="./market/sql-wasm.js"></script>\n  <script type="module"'));
const server = await readFile(resolve(project,'api/commerce.mjs'),'utf8');
await writeFile(resolve(market,'commerce.mjs'),server.replace('../public/market/catalog.mjs','./catalog.mjs'));
await cp(resolve(project,'pages/demo.mjs'),resolve(market,'demo.mjs'));

const migrationDir = resolve(project,'drizzle');
const files = (await readdir(migrationDir)).filter(file=>file.endsWith('.sql')).sort();
const schema = await Promise.all(files.map(file=>readFile(resolve(migrationDir,file),'utf8')));
await writeFile(resolve(market,'schema.sql'),schema.join('\n'));
for (const file of ['sql-wasm.js','sql-wasm.wasm']) await cp(resolve(dependencies,'dist',file),resolve(market,file));
await cp(resolve(dependencies,'LICENSE'),resolve(output,'sql.js-LICENSE'));
await writeFile(resolve(output,'.nojekyll'),'');
console.log('GitHub Pages demo built in ' + output);
