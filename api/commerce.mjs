import { categories as sampleCategories, products as sampleProducts, sampleSettings } from '../public/market/catalog.mjs';

const prefix = '/api/market/';
const orderStates = {
  pending: ['processing','cancelled'], processing: ['dispatched','completed','cancelled'],
  dispatched: ['completed'], completed: [], cancelled: [],
};
const imageKeys = new Set(sampleProducts.map(item => item.image));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
const statements = (db, sql, ...args) => db.prepare(sql).bind(...args);
const first = (db, sql, ...args) => statements(db, sql, ...args).first();
const all = async (db, sql, ...args) => (await statements(db, sql, ...args).all()).results;
const run = (db, sql, ...args) => statements(db, sql, ...args).run();
const now = () => new Date().toISOString();
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0,10);
const unique = () => crypto.randomUUID();
const response = (value, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

class MarketError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function requireValue(condition, message, status) {
  if (!condition) throw new MarketError(message, status);
}
function field(value, limit = 100) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
function integer(value, min, max, label) {
  requireValue(Number.isSafeInteger(value) && value >= min && value <= max, label + ' is invalid.');
  return value;
}
function email(value) {
  const address = field(value, 200).toLowerCase();
  requireValue(emailPattern.test(address), 'Enter a valid email address.');
  return address;
}
function slug(value) {
  const id = field(value, 80);
  requireValue(slugPattern.test(id), 'Use a short ID with lowercase letters, numbers and hyphens.');
  return id;
}

async function initialize(db) {
  const store = await first(db, "SELECT value FROM settings WHERE key = 'store'");
  if (store) return JSON.parse(store.value);
  const insert = (sql, ...args) => statements(db, sql, ...args);
  await db.batch([
    ...sampleCategories.map(x => insert('INSERT OR IGNORE INTO categories (id,label,image,tint) VALUES (?,?,?,?)', x.id,x.label,x.image,x.tint)),
    ...sampleProducts.flatMap(x => [
      insert('INSERT OR IGNORE INTO products (id,name,description,category,image,featured,best) VALUES (?,?,?,?,?,?,?)', x.id,x.name,x.description,x.category,x.image,+x.featured,+x.best),
      ...x.variants.map(v => insert('INSERT OR IGNORE INTO variants (id,product,label,price,was,stock) VALUES (?,?,?,?,?,?)', v.id,x.id,v.label,v.price,v.was,v.stock)),
    ]),
    insert('INSERT OR IGNORE INTO coupons (code,percent) VALUES (?,?)', 'ISLAND10',10),
    insert('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)', 'store',JSON.stringify(sampleSettings)),
  ]);
  return sampleSettings;
}

function identity(request, env, localAdmin) {
  const id = request.headers.get('oai-authenticated-user-id');
  const address = request.headers.get('oai-authenticated-user-email');
  if (localAdmin) return { id: 'local-preview-owner', email: 'owner@example.test', admin: true };
  if (!id || !address) return null;
  const admin = !!env.ADMIN_EMAIL && address.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase();
  return { id, email: address, admin };
}

async function catalogue(db, store, admin = false) {
  const [categories, products, variants, reviews] = await Promise.all([
    all(db, 'SELECT * FROM categories ORDER BY rowid'),
    all(db, 'SELECT * FROM products ' + (admin ? '' : 'WHERE active = 1') + ' ORDER BY rowid'),
    all(db, 'SELECT * FROM variants ' + (admin ? '' : 'WHERE active = 1') + ' ORDER BY rowid'),
    all(db, 'SELECT product, name, rating, body, created FROM reviews WHERE approved = 1 ORDER BY created DESC LIMIT 150'),
  ]);
  const byProduct = Map.groupBy(variants, v => v.product);
  const publicProducts = products.map(p => {
    const options = byProduct.get(p.id) ?? [];
    const primary = options.find(v => v.active && v.stock > 0) ?? options.find(v => v.active) ?? options[0];
    return { ...p, size: primary?.label ?? '', price: primary?.price ?? 0,
      was: primary?.was ?? null, stock: options.filter(v => v.active).reduce((n,v) => n + v.stock,0),
      variants: options };
  });
  return { categories, products: admin ? publicProducts : publicProducts.filter(p => p.variants.length), reviews, settings: store };
}

async function makeQuote(db, store, data) {
  requireValue(Array.isArray(data.items) && data.items.length > 0 && data.items.length <= 50, 'Add items to your basket first.');
  const ids = [...new Set(data.items.map(x => field(x?.id,100)))];
  requireValue(ids.length === data.items.length && ids.every(Boolean), 'Your basket contains invalid items.');
  const rows = await all(db, `SELECT v.*, p.name, p.image, p.active AS product_active FROM variants v
    JOIN products p ON p.id = v.product WHERE v.id IN (${ids.map(() => '?').join(',')})`, ...ids);
  const items = data.items.map(item => {
    const row = rows.find(x => x.id === item.id);
    requireValue(row && row.active && row.product_active, 'An item in your basket is no longer available.',409);
    const qty = integer(item.qty,1,99,'Quantity');
    requireValue(row.stock >= qty, row.name + ' has only ' + row.stock + ' in stock.',409);
    return { id:row.id, product:row.product, name:row.name, label:row.label, image:row.image, qty, price:row.price };
  });
  const subtotal = items.reduce((sum,item) => sum + item.qty * item.price,0);
  const code = field(data.coupon,30).toUpperCase();
  const promo = code && await first(db, 'SELECT percent FROM coupons WHERE code = ? AND active = 1',code);
  requireValue(!code || promo, 'This promo code is unavailable.');
  const discount = promo ? Math.floor(subtotal * promo.percent / 100) : 0;
  const method = data.method === 'collection' ? 'collection' : 'delivery';
  requireValue(method !== 'collection' || store.collection, 'Collection is currently unavailable.');
  const postcode = field(data.postcode,12);
  const area = /^\d{5}$/.test(postcode) && store.deliveryAreas.find(zone => postcode >= zone.from && postcode <= zone.to);
  const fee = method === 'collection' ? 0 : area ? (subtotal - discount >= store.freeDelivery ? 0 : area.fee) : null;
  return { items, subtotal, discount, fee, total:subtotal - discount + (fee ?? 0),
    coupon: code, method, area:area?.label ?? null, eligible:subtotal - discount >= store.minimum };
}

async function orderRecord(db, row) {
  const items = await all(db, `SELECT i.*, v.product FROM order_items i
    JOIN variants v ON v.id = i.variant WHERE order_id = ? ORDER BY i.rowid`, row.id);
  const { nonce, tracking, user_id, ...order } = row;
  return { ...order, items };
}

async function accessibleOrder(db, data, user) {
  const row = await first(db,'SELECT * FROM orders WHERE id = ?', field(data.id,40));
  const guest = field(data.tracking,50);
  requireValue(row && (user?.admin || (user && row.user_id === user.id) || (guest && row.tracking === guest)), 'Order not found. Check your order number and tracking code.',404);
  return orderRecord(db,row);
}

async function placeOrder(db, store, data, user) {
  const nonce = field(data.nonce,40);
  requireValue(/^[a-f0-9-]{36}$/.test(nonce),'Refresh checkout and try again.');
  const previous = await first(db,'SELECT * FROM orders WHERE nonce = ?',nonce);
  if (previous) return { order: await orderRecord(db,previous), tracking:previous.tracking };
  const quote = await makeQuote(db,store,data);
  requireValue(quote.eligible, 'The minimum order is Rs. ' + store.minimum.toLocaleString('en-LK') + ' after discounts.');
  requireValue(quote.fee !== null,'This postcode is outside the current delivery areas.');
  const name = field(data.name), address = field(data.address,300), phone = field(data.phone,30);
  const contact = email(data.email);
  const postcode = field(data.postcode,12);
  const date = field(data.date,10), slot = field(data.slot,40);
  const latest = new Date(Date.now() + 15 * 86400000).toISOString().slice(0,10);
  requireValue(name.length >= 2 && /^[+0-9()\s-]{7,30}$/.test(phone),'Enter your name and a valid phone number.');
  requireValue(quote.method === 'collection' || address.length >= 8,'Enter your full delivery address.');
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0,10) === date && date >= today() && date <= latest && store.slots.includes(slot),
    'Choose an available date and time slot.');
  const id = 'IP-' + unique().slice(0,8).toUpperCase();
  const tracking = unique();
  const created = now();
  const prepare = (sql, ...args) => statements(db,sql,...args);
  try {
    await db.batch([
      prepare(`INSERT INTO orders (id,nonce,tracking,user_id,name,email,phone,method,address,postcode,date,slot,notes,subtotal,discount,fee,total,coupon,status,created)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)`,
      id,nonce,tracking,data.asGuest ? null : user?.id ?? null,name,contact,phone,quote.method,
      quote.method === 'delivery' ? address : '',quote.method === 'delivery' ? postcode : '',date,slot,
      field(data.notes,500),quote.subtotal,quote.discount,quote.fee,quote.total,quote.coupon || null,created),
      ...quote.items.map(item => prepare('INSERT INTO order_items (order_id,variant,name,label,qty,price) VALUES (?,?,?,?,?,?)', id,item.id,item.name,item.label,item.qty,item.price)),
      prepare('INSERT INTO notifications VALUES (?,?,?,?,?)',unique(),id,contact,'Order confirmation',created),
    ]);
  } catch (error) {
    const retry = await first(db,'SELECT * FROM orders WHERE nonce = ?',nonce);
    if (retry) return { order: await orderRecord(db,retry),tracking:retry.tracking };
    if (/stock|variant availability|order price/i.test(String(error))) throw new MarketError('Availability or price changed. Review your basket and try again.',409);
    throw error;
  }
  const order = await accessibleOrder(db,{id,tracking},user);
  return { order, tracking };
}

async function updateAdmin(db, store, data) {
  const insert = (sql, ...args) => statements(db,sql,...args);
  if (data.kind === 'product') {
    const id = slug(data.id), category = slug(data.category);
    const name = field(data.name), description = field(data.description,1200);
    requireValue(name && description && imageKeys.has(data.image), 'Enter a name, description and valid product image.');
    requireValue(await first(db,'SELECT 1 FROM categories WHERE id = ?',category),'Select an existing category.');
    requireValue(Array.isArray(data.variants) && data.variants.length >= 1 && data.variants.length <= 20,'Supply at least one product size.');
    const ids = new Set();
    const options = data.variants.map(v => {
      const key = slug(v.id);
      const label = field(v.label,50);
      requireValue(label && !ids.has(key) && key.startsWith(id + '-'),'Enter unique variant IDs and sizes.');
      ids.add(key);
      const price = integer(v.price,1,10000000,'Price');
      if (v.was != null) integer(v.was,price + 1,10000000,'Regular price');
      return insert(`INSERT INTO variants (id,product,label,price,was,stock,active) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET label=excluded.label,price=excluded.price,was=excluded.was,
        stock=excluded.stock,active=excluded.active WHERE variants.product=excluded.product`,
        key,id,label,price,v.was ?? null,integer(v.stock,0,1000000,'Stock'),+Boolean(v.active));
    });
    await db.batch([
      insert(`INSERT INTO products (id,name,description,category,image,featured,best,active) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,
        image=excluded.image,featured=excluded.featured,best=excluded.best,active=excluded.active`,
        id,name,description,category,data.image,+Boolean(data.featured),+Boolean(data.best),+Boolean(data.active)),
      insert('UPDATE variants SET active=0 WHERE product=?',id), ...options,
    ]);
    return { saved:true };
  }
  if (data.kind === 'category') {
    const id = slug(data.id), label = field(data.label,60), parent = data.parent ? slug(data.parent) : null;
    requireValue(label && imageKeys.has(data.image) && /^#[0-9a-f]{6}$/i.test(data.tint),'Enter a label, image and colour.');
    if (parent) {
      const categories = await all(db,'SELECT id,parent FROM categories');
      const known = new Map(categories.map(x => [x.id,x.parent]));
      requireValue(known.has(parent),'Select an existing parent.');
      for (let ancestor = parent; ancestor; ancestor = known.get(ancestor)) requireValue(ancestor !== id,'A category cannot be its own ancestor.');
    }
    await run(db,`INSERT INTO categories VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,
      parent=excluded.parent,image=excluded.image,tint=excluded.tint`,id,label,parent,data.image,data.tint);
    return { saved:true };
  }
  if (data.kind === 'coupon') {
    const code = field(data.code,30).toUpperCase();
    requireValue(/^[A-Z0-9-]{2,30}$/.test(code),'Enter a promo code using letters, numbers or dashes.');
    await run(db,'INSERT INTO coupons VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,active=excluded.active',
      code,integer(data.percent,1,90,'Discount'),+Boolean(data.active));
    return { saved:true };
  }
  if (data.kind === 'order') {
    const row = await first(db,'SELECT * FROM orders WHERE id = ?',field(data.id,40));
    requireValue(row,'Order not found.',404);
    const next = field(data.status,20);
    requireValue(next === row.status || orderStates[row.status]?.includes(next),'That status change is unavailable.');
    const paid = +Boolean(data.paid);
    requireValue(next !== 'cancelled' || !paid,'Record the refund before marking a paid order cancelled.');
    const results = await db.batch([
      insert('UPDATE orders SET status=?,paid=? WHERE id=? AND status=? AND paid=?',next,paid,row.id,row.status,row.paid),
      ...(next !== row.status ? [insert(`INSERT INTO notifications SELECT ?,id,email,?,? FROM orders WHERE id=? AND changes()=1`,
      unique(),'Order ' + next,now(),row.id)] : []),
    ]);
    requireValue(results[0].meta.changes === 1,'Order changed. Reload and try again.',409);
    return { saved:true };
  }
  if (data.kind === 'settings') {
    const areas = data.deliveryAreas, slots = data.slots;
    requireValue(Array.isArray(areas) && Array.isArray(slots) && slots.length > 0 && areas.length <= 100 && slots.length <= 40,'Check delivery areas and time slots.');
    const configured = {
      ...store, minimum:integer(data.minimum,0,10000000,'Minimum order'),
      freeDelivery:integer(data.freeDelivery,0,10000000,'Free delivery threshold'),
      banner:field(data.banner,150),heroHeading:field(data.heroHeading,70),heroCopy:field(data.heroCopy,220),
      email: data.email ? email(data.email) : '',whatsapp:field(data.whatsapp,20).replace(/\D/g,''),
      collection:Boolean(data.collection),
      slots:[...new Set(slots.map(x => field(x,40)).filter(Boolean))],
      deliveryAreas:areas.map(x => {
        const label = field(x.label,80);
        requireValue(label && /^\d{5}$/.test(x.from) && /^\d{5}$/.test(x.to) && x.from <= x.to, 'Enter valid five-digit postcode ranges.');
        return { label, from:x.from, to:x.to, fee:integer(x.fee,0,10000000,'Delivery fee') };
      }),
    };
    requireValue(configured.slots.length && configured.heroHeading && configured.heroCopy,'Enter at least one time slot and complete the homepage details.');
    await run(db,"UPDATE settings SET value=? WHERE key='store'",JSON.stringify(configured));
    return { saved:true };
  }
  if (data.kind === 'review') {
    await run(db,'UPDATE reviews SET approved=? WHERE id=?',+Boolean(data.approved),field(data.id,40));
    return { saved:true };
  }
  throw new MarketError('Unknown admin action.',404);
}

export async function market(request, env, { localAdmin = false } = {}) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.slice(prefix.length);
    const method = request.method;
    const db = env.DB;
    requireValue(db,'Store database temporarily unavailable.',503);
    const user = identity(request,env,localAdmin);
    if (action === 'admin' || action === 'manage') requireValue(user?.admin,'Store administration requires owner sign-in.',403);
    if (method === 'POST') {
      const origin = request.headers.get('Origin');
      requireValue(!origin || origin === url.origin || (env.SITE_ORIGIN && origin === env.SITE_ORIGIN),'Request origin is invalid.',403);
      requireValue(request.headers.get('Content-Type')?.split(';')[0] === 'application/json','Expected JSON.',415);
    }
    const store = await initialize(db);
    if (method === 'GET') {
      if (action === 'catalogue') return response({ ...await catalogue(db,store), user });
      if (action === 'account') {
        requireValue(user,'Sign in to see your orders.',401);
        const orders = await all(db,'SELECT id,status,total,created FROM orders WHERE user_id=? ORDER BY created DESC LIMIT 100',user.id);
        return response({ user, orders });
      }
      if (action === 'admin') {
        const [inventory,orders,coupons,messages,subscribers,reviews,report,customers] = await Promise.all([
          catalogue(db,store,true),all(db,'SELECT id,name,email,method,total,status,paid,created FROM orders ORDER BY created DESC LIMIT 150'),
          all(db,'SELECT * FROM coupons ORDER BY code'),all(db,'SELECT * FROM messages ORDER BY created DESC LIMIT 150'),
          all(db,'SELECT * FROM subscribers ORDER BY created DESC LIMIT 150'),all(db,'SELECT * FROM reviews ORDER BY created DESC LIMIT 150'),
          first(db,`SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN paid=1 THEN total ELSE 0 END),0) AS revenue,
            (SELECT COUNT(*) FROM variants WHERE active=1 AND stock<=5) AS low FROM orders`),
          all(db,'SELECT email, COUNT(*) AS orders, MAX(created) AS latest FROM orders GROUP BY email ORDER BY latest DESC LIMIT 150'),
        ]);
        return response({ ...inventory, orders,coupons,messages,subscribers,reviews,report,customers });
      }
    }
    if (method === 'POST') {
      const raw = await request.text();
      requireValue(raw.length <= 64000,'Request is too large.',413);
      let data;
      try { data = JSON.parse(raw); } catch { throw new MarketError('Request could not be read.'); }
      requireValue(data && typeof data === 'object' && !Array.isArray(data),'Request could not be read.');
      if (action === 'quote') return response(await makeQuote(db,store,data));
      if (action === 'order') return response(await placeOrder(db,store,data,user));
      if (action === 'track') return response({order:await accessibleOrder(db,data,user)});
      if (action === 'manage') return response(await updateAdmin(db,store,data));
      if (action === 'newsletter') {
        await run(db,'INSERT OR IGNORE INTO subscribers VALUES (?,?)',email(data.email),now());
        return response({ saved:true });
      }
      if (action === 'message') {
        const name = field(data.name), body = field(data.message,1500);
        requireValue(name && body.length >= 8,'Enter your name and a message of at least eight characters.');
        await run(db,'INSERT INTO messages VALUES (?,?,?,?,?)',unique(),email(data.email),name,body,now());
        return response({ saved:true });
      }
      if (action === 'review') {
        const order = await accessibleOrder(db,data,user), product = slug(data.product);
        requireValue(order.status === 'completed' && order.items.some(x => x.product === product),'Reviews are available after an order containing the item is completed.');
        const body = field(data.body,650);
        requireValue(body.length >= 8,'Write a review of at least eight characters.');
        await run(db,`INSERT INTO reviews VALUES (?,?,?,?,?,?,0,?) ON CONFLICT(product,order_id) DO UPDATE SET
          rating=excluded.rating,body=excluded.body,approved=0,created=excluded.created`,
          unique(),product,order.id,order.name.split(/\s+/)[0],integer(data.rating,1,5,'Rating'),body,now());
        return response({ saved:true });
      }
    }
    return response({ error:'Store endpoint not found.' },404);
  } catch (error) {
    if (error instanceof MarketError) return response({error:error.message},error.status);
    console.error('Store request failed',error?.name,error?.message);
    return response({error:'The store service is temporarily unavailable. Try again shortly.'},503);
  }
}
