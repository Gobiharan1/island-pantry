import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { market } from './commerce.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const publicRoot = resolve(root,'public');
const state = resolve(root,'.local');
mkdirSync(state,{recursive:true});
const db = new DatabaseSync(process.env.PANTRY_DB ?? resolve(state,'preview.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for (const file of readdirSync(resolve(root,'drizzle')).filter(x => x.endsWith('.sql')).sort()) {
  if (db.prepare('SELECT name FROM local_migrations WHERE name=?').get(file)) continue;
  db.exec('BEGIN');
  try {
    db.exec(readFileSync(resolve(root,'drizzle',file),'utf8'));
    db.prepare('INSERT INTO local_migrations VALUES (?)').run(file);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function statement(sql, params = []) {
  const cmd = db.prepare(sql);
  return {
    bind: (...values) => statement(sql, values),
    first: () => cmd.get(...params) ?? null,
    all: () => ({ results:cmd.all(...params) }),
    run: () => ({ meta:{ changes:Number(cmd.run(...params).changes) } }),
  };
}
const DB = {
  prepare:statement,
  batch(operations) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const results = operations.map(x => x.run());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },
};

const content = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp',
};
const port = Number(process.env.PANTRY_PORT ?? 4317);
const origin = 'http://127.0.0.1:' + port;
createServer(async (req, res) => {
  try {
    const url = new URL(req.url,origin);
    if (url.pathname.startsWith('/api/market/')) {
      const init = { method:req.method, headers:req.headers };
      if (req.method === 'POST') {
        init.body = Readable.toWeb(req);
        init.duplex = 'half';
      }
      const result = await market(new Request(url,init),{DB},{localAdmin:true});
      res.writeHead(result.status,Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    const path = resolve(publicRoot,'.' + (url.pathname === '/' ? '/market/index.html' : url.pathname));
    if (!path.startsWith(publicRoot + sep) || !existsSync(path) || !statSync(path).isFile() || !content[extname(path)]) {
      res.writeHead(404).end('Page not found');
      return;
    }
    res.writeHead(200,{'Content-Type':content[extname(path)],'X-Content-Type-Options':'nosniff'});
    createReadStream(path).pipe(res);
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) res.writeHead(500);
    res.end('Preview error');
  }
}).listen(port,'127.0.0.1',() => console.log('Island Pantry preview at ' + origin));
