import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const categories = sqliteTable('categories', {
  id: text().primaryKey(),
  label: text().notNull(),
  parent: text().references((): any => categories.id),
  image: text().notNull(),
  tint: text().notNull(),
});
export const products = sqliteTable('products', {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  category: text().notNull().references(() => categories.id),
  image: text().notNull(),
  featured: integer().notNull().default(0),
  best: integer().notNull().default(0),
  active: integer().notNull().default(1),
});
export const variants = sqliteTable('variants', {
  id: text().primaryKey(),
  product: text().notNull().references(() => products.id),
  label: text().notNull(),
  price: integer().notNull(),
  was: integer(),
  stock: integer().notNull(),
  active: integer().notNull().default(1),
}, t => [check('nonnegative_stock', sql`${t.stock} >= 0`)]);
export const coupons = sqliteTable('coupons', {
  code: text().primaryKey(),
  percent: integer().notNull(),
  active: integer().notNull().default(1),
});
export const orders = sqliteTable('orders', {
  id: text().primaryKey(),
  nonce: text().notNull(),
  tracking: text().notNull(),
  user_id: text(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text().notNull(),
  method: text().notNull(),
  address: text().notNull(),
  postcode: text().notNull(),
  date: text().notNull(),
  slot: text().notNull(),
  notes: text().notNull(),
  subtotal: integer().notNull(),
  discount: integer().notNull(),
  fee: integer().notNull(),
  total: integer().notNull(),
  coupon: text(),
  status: text().notNull(),
  paid: integer().notNull().default(0),
  created: text().notNull(),
}, t => [uniqueIndex('orders_nonce').on(t.nonce)]);
export const orderItems = sqliteTable('order_items', {
  order_id: text().notNull().references(() => orders.id),
  variant: text().notNull().references(() => variants.id),
  name: text().notNull(),
  label: text().notNull(),
  qty: integer().notNull(),
  price: integer().notNull(),
}, t => [uniqueIndex('order_items_order_variant').on(t.order_id,t.variant)]);
export const messages = sqliteTable('messages', {
  id: text().primaryKey(),
  email: text().notNull(),
  name: text().notNull(),
  body: text().notNull(),
  created: text().notNull(),
});
export const subscribers = sqliteTable('subscribers', {
  email: text().primaryKey(),
  created: text().notNull(),
});
export const reviews = sqliteTable('reviews', {
  id: text().primaryKey(),
  product: text().notNull().references(() => products.id),
  order_id: text().notNull().references(() => orders.id),
  name: text().notNull(),
  rating: integer().notNull(),
  body: text().notNull(),
  approved: integer().notNull().default(0),
  created: text().notNull(),
}, t => [uniqueIndex('reviews_product_order').on(t.product,t.order_id)]);
export const notifications = sqliteTable('notifications', {
  id: text().primaryKey(),
  order_id: text().notNull().references(() => orders.id),
  email: text().notNull(),
  subject: text().notNull(),
  created: text().notNull(),
});
