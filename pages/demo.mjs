import { market } from './commerce.mjs';

const dataKey = 'island-pantry-demo-db-' + new URL('../',import.meta.url).pathname;
let database;

function restore() {
  try {
    const saved = sessionStorage.getItem(dataKey);
    return saved ? Uint8Array.from(atob(saved),character => character.charCodeAt(0)) : null;
  } catch {
    return null;
  }
}

function persist(sqlite) {
  try {
    const bytes = sqlite.export();
    const chunks = [];
    for (let start = 0; start < bytes.length; start += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(start,start+8192)));
    }
    sessionStorage.setItem(dataKey,btoa(chunks.join('')));
  } catch {
    // Keep the in-memory demo usable if session storage is unavailable.
  } finally {
    sqlite.run('PRAGMA foreign_keys = ON');
  }
}

function binding(sqlite) {
  function rows(sql,params) {
    const query = sqlite.prepare(sql,params);
    try {
      const results = [];
      while (query.step()) results.push(query.getAsObject());
      return results;
    } finally {
      query.free();
    }
  }
  function statement(sql, params = []) {
    return {
      bind: (...values) => statement(sql,values),
      first: () => rows(sql,params)[0] ?? null,
      all: () => ({ results:rows(sql,params) }),
      run: () => {
        sqlite.run(sql,params);
        return { meta:{ changes:sqlite.getRowsModified() } };
      },
    };
  }
  return {
    prepare:statement,
    batch(operations) {
      sqlite.run('BEGIN IMMEDIATE');
      try {
        const results = operations.map(x=>x.run());
        sqlite.run('COMMIT');
        return results;
      } catch (error) {
        sqlite.run('ROLLBACK');
        throw error;
      }
    },
  };
}

async function openDatabase() {
  const SQL = await globalThis.initSqlJs({
    locateFile: file => new URL(file,import.meta.url).href,
  });
  const saved = restore();
  const sqlite = new SQL.Database(saved ?? undefined);
  sqlite.run('PRAGMA foreign_keys = ON');
  if (!saved) {
    const migration = await fetch(new URL('schema.sql',import.meta.url));
    if (!migration.ok) throw new Error('The demo database could not start.');
    sqlite.run(await migration.text());
  }
  return {sqlite, DB:binding(sqlite)};
}

export async function previewRequest(request) {
  database ??= openDatabase();
  const {sqlite,DB} = await database;
  const response = await market(request,{DB},{localAdmin:true});
  if (request.method === 'POST' && response.ok) persist(sqlite);
  return response;
}
