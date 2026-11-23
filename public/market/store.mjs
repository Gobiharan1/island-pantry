import { categories as sampleCategories, products as sampleProducts, sampleSettings } from './catalog.mjs';
import { api, appRoot, asset, browserDemo, escape as e, field, icon, image, option, rs, url } from './ui.mjs';
import { adminView, adminData } from './admin.mjs';

const storeKey = key => (browserDemo ? 'island-pantry-' + appRoot + '-' : 'island-pantry-') + key;
const storage = () => browserDemo ? sessionStorage : localStorage;
const read = (key, fallback) => {
  try { return JSON.parse(storage().getItem(storeKey(key))) ?? fallback; }
  catch { return fallback; }
};
const save = (key,value) => {
  try { storage().setItem(storeKey(key),JSON.stringify(value)); }
  catch { /* Shopping remains available for this session. */ }
};
let items = read('cart', {});
let favorites = read('favorites', []);
let guestOrders = read('orders', []);
let coupon = read('coupon', '');
let state = { products:sampleProducts, categories:sampleCategories, settings:sampleSettings, user:null, reviews:[] };
let ready = false, failed = false, sectionRequest = 0, nonce = crypto.randomUUID();
let quoteVersion = 0, quoteTimer, toastTimer;
let orderResult, account, admin, activeOrder;
const main = document.querySelector('#main');
const drawer = document.querySelector('#drawer');
const filters = () => Object.fromEntries(new URLSearchParams(location.search));
const route = () => filters().page ?? 'home';
const shop = params => url('shop',params);
const currentCategory = id => state.categories.find(c => c.id === id);
const productById = id => state.products.find(x => x.id === id);
const orderStatus = x => x.charAt(0).toUpperCase() + x.slice(1);
const amount = () => Object.values(items).reduce((n,x) => n+x,0);
const labelOrder = order => new Date(order.created).toLocaleDateString('en-LK',{timeZone:'Asia/Colombo',year:'numeric',month:'short',day:'numeric'});

function toast(message) {
  const box = document.querySelector('#toast');
  box.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.textContent = ''; },3600);
}
function go(path) {
  if (drawer.open) drawer.close();
  if (path !== location.pathname + location.search) history.pushState({},'',path);
  render();
  scrollTo(0,0);
  main.focus({preventScroll:true});
}
function trail(name, parent = '') {
  return `<nav class="crumb" aria-label="Breadcrumb"><a href="${appRoot}">Home</a><span>/</span>${parent}<span>${e(name)}</span></nav>`;
}
function section(title, body, sub = '', narrow = false) {
  return `<section class="wrap section${narrow ? ' narrow' : ''}">${trail(title)}<h1>${e(title)}</h1>${sub ? `<p class="lede">${e(sub)}</p>` : ''}${body}</section>`;
}
const link = (href,text,cls='btn') => `<a class="${cls}" href="${href}">${e(text)}</a>`;
const empty = (title, text, href = shop(), action = 'Browse groceries') =>
  `<div class="empty"><h3>${e(title)}</h3><p>${e(text)}</p>${link(href,action)}</div>`;
const brand = () => `<a class="brand" href="${appRoot}" aria-label="Island Pantry home"><img src="${asset('mark.svg')}" width="43" height="43" alt=""><span><strong>Island Pantry</strong><small>Sri Lankan Groceries</small></span></a>`;
const current = (page,category = '') => route() === page && (filters().category ?? '') === category ? ' aria-current="page"' : '';

function header() {
  const {settings,categories} = state;
  document.querySelector('#header').innerHTML = `
    <div class="topbar"><div class="wrap"><span>${icon('truck')}${e(settings.banner || 'Sri Lankan groceries for your kitchen')}</span><span class="region">${icon('pin')} Sri Lanka · LKR</span></div></div>
    <header class="header"><div class="wrap head">${brand()}
    <form class="search" data-form="search" role="search"><input aria-label="Search groceries" name="q" placeholder="Search rice, spices, Ceylon tea…" value="${e(filters().q ?? '')}"><button type="submit" aria-label="Search">${icon('search')}</button></form>
    <div class="tools"><a class="icon-link account-link" aria-label="My account" href="${url('account')}">${icon('user')}<span class="account-label">Account</span></a>
    <a href="${url('favorites')}" class="icon-link" aria-label="Favourites" title="Favourites">${icon('heart')}</a>
    <button class="basket" data-action="cart" aria-label="Basket, ${amount()} items">${icon('bag')}<span class="cart-label">Basket</span><span class="count">${amount()}</span></button></div></div>
    <nav class="wrap nav" aria-label="Shop departments"><a class="shop-all" href="${shop()}"${current('shop')}>${icon('grid')} Shop all</a>
    ${categories.filter(c => !c.parent).map(c => `<a href="${shop({category:c.id})}"${current('shop',c.id)}>${e(c.label)}</a>`).join('')}
    <a class="offer-link" href="${url('offers')}"${current('offers')}>${icon('tag')} Special Offers</a></nav></header>`;
}
function footer() {
  const whatsapp = state.settings.whatsapp;
  document.querySelector('#footer').innerHTML = `<footer class="footer"><div class="wrap">
    <div class="footer-grid"><div>${brand()}<p>From the spice cupboard to the tea tin. Sri Lankan groceries for everyday cooking.</p></div>
      <nav aria-label="Shop"><strong>Shop</strong><a href="${shop()}">All groceries</a><a href="${url('offers')}">Special offers</a><a href="${url('favorites')}">Favourites</a><a href="${url('account')}">My account</a></nav>
      <nav aria-label="Customer help"><strong>Help</strong><a href="${url('about')}">About us</a><a href="${url('contact')}">Contact us</a><a href="${url('faq')}">FAQs</a><a href="${url('policies')}">Privacy &amp; policies</a>${whatsapp ? `<a href="https://wa.me/${e(whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}</nav>
      <div class="newsletter"><h2>Pantry news</h2><p>Sign up for new products and grocery offers.</p>
      <form data-form="newsletter"><input name="email" aria-label="Email address" type="email" placeholder="Email address" required><button class="btn yellow">Subscribe</button></form><p data-feedback role="status"></p></div></div>
    <div class="footer-base"><span>© ${new Date().getFullYear()} Island Pantry</span><span>${browserDemo ? 'Interactive demo · Activity stays in this tab' : state.settings.preview ? 'Private store preview · Sample prices and availability' : 'Sri Lanka · LKR'}</span>${state.user?.admin ? `<a href="${url('admin')}">Store administration</a>` : ''}</div></div></footer>`;
}
const sale = p => p.was != null && p.was > p.price;
const cost = p => `<div class="price"><strong>${rs(p.price)}</strong>${sale(p) ? '<del>' + rs(p.was) + '</del>' : ''}</div>`;
function favorite(p) {
  return `<button class="icon-link favorite" data-action="favorite" data-id="${e(p.id)}" aria-label="Favourite ${e(p.name)}" aria-pressed="${favorites.includes(p.id)}">${icon('heart')}</button>`;
}
function productCard(p) {
  const first = p.variants.find(x => x.stock > 0) ?? p.variants[0];
  const href = url('product',{id:p.id});
  return `<article class="product"><div class="product-photo">
    <a href="${href}" aria-label="View ${e(p.name)}"><img src="${image(p.image)}" width="356" height="356" loading="lazy" alt="${e(p.name)}"></a>
    ${p.stock === 0 ? '<span class="tag sold">Out of stock</span>' : sale(p) ? `<span class="tag">Save ${rs(p.was-p.price)}</span>` : ''}
    ${favorite(p)}</div><div class="product-info"><h3><a href="${href}">${e(p.name)}</a></h3>
    <p>${e(p.size)}${p.variants.length > 1 ? ' · More sizes' : ''}</p>${cost(p)}
    ${p.stock ? `<button class="btn secondary block small" data-action="add" data-id="${e(first.id)}" aria-label="Add ${e(p.name)} to basket">${icon('plus')} Add to basket</button>` : '<button class="btn secondary block small" disabled>Unavailable</button>'}</div></article>`;
}
const productGrid = products => `<div class="products">${products.map(productCard).join('')}</div>`;

function home() {
  const {settings,categories,products} = state;
  const title = settings.heroHeading === sampleSettings.heroHeading ? 'A little taste of <em>home.</em>' : e(settings.heroHeading);
  const bundle = productById('curry-night');
  return `<section class="wrap hero"><div class="hero-copy">
      <span class="eyebrow">${icon('leaf')} The Sri Lankan pantry</span>
      <h1>${title}</h1><p>${e(settings.heroCopy)}</p>
      <div class="actions">${link(shop(),'Shop groceries')}${link(url('offers'),'View offers','btn secondary')}</div>
    </div><img src="${image('island-table')}" width="1380" height="920" fetchpriority="high" alt="Sri Lankan rice and curry with dhal, coconut sambol, greens and papadum on a banana leaf"></section>
    <div class="wrap benefits">
      <div class="benefit">${icon('leaf')} <span><strong>Sri Lankan favourites</strong><small>Pantry staples and tea-time treats</small></span></div>
      <div class="benefit">${icon('truck')} <span><strong>Local delivery</strong><small>Check your postcode at checkout</small></span></div>
      <div class="benefit">${icon('box')} <span><strong>${settings.collection ? 'Collection available' : 'Scheduled delivery'}</strong><small>Choose a date and time slot</small></span></div></div>
    <section class="wrap section" aria-labelledby="category-title"><div class="section-head"><h2 id="category-title">Shop by category</h2>${link(shop(),'All groceries','textlink')}</div>
      <div class="categories">${categories.filter(c => !c.parent).map(c => `<a class="category" href="${shop({category:c.id})}" style="--tint:${e(c.tint)}"><img src="${image(c.image)}" width="356" height="356" alt=""><strong>${e(c.label)}</strong></a>`).join('')}</div></section>
    <section class="wrap section" aria-labelledby="popular-title"><div class="section-head"><div><h2 id="popular-title">Pantry favourites</h2><p>The ingredients and treats we reach for most.</p></div>${link(shop({sort:'popular'}),'View all','textlink')}</div>${productGrid(products.filter(p=>p.featured).slice(0,5))}</section>
    ${bundle ? `<section class="wrap section"><div class="promo"><div><h2>Curry night, sorted.</h2><p>Four pantry essentials for a Sri Lankan curry, in one bundle.</p>${link(url('product',{id:bundle.id}),'Shop the curry bundle','btn yellow')}</div><img src="${image(bundle.image)}" width="356" height="356" loading="lazy" alt="Curry spices and coconut milk"></div></section>` : ''}`;
}
function descends(product, id) {
  if (!id) return true;
  let category = currentCategory(product.category);
  while (category) {
    if (category.id === id) return true;
    category = currentCategory(category.parent);
  }
  return false;
}
function listing(page) {
  const {category,q = '',sort = '',stock = ''} = filters();
  let filtered = state.products.filter(p => descends(p,category) && (page !== 'offers' || sale(p)) &&
    (page !== 'favorites' || favorites.includes(p.id)) && (!stock || p.stock > 0));
  const tokens = q.toLowerCase().trim().split(/\s+/);
  if (q) filtered = filtered.filter(p => {
    const text = [p.name,p.description,p.size,currentCategory(p.category)?.label].join(' ').toLowerCase();
    return tokens.every(t => text.includes(t));
  });
  if (sort === 'price-low') filtered.sort((a,b) => a.price - b.price);
  if (sort === 'price-high') filtered.sort((a,b) => b.price - a.price);
  if (sort === 'popular') filtered.sort((a,b) => b.best - a.best);
  const title = page === 'offers' ? 'Special offers' : page === 'favorites' ? 'Your favourites' : currentCategory(category)?.label ?? 'Shop groceries';
  const label = page === 'offers' ? 'Savings on pantry favourites and cooking bundles.' : page === 'favorites' ? 'Keep the groceries you buy most within easy reach.' : 'Browse Sri Lankan pantry staples and everyday essentials.';
  const nav = page === 'shop' ? `<nav class="chips" aria-label="Filter by category">
    <a href="${shop({q,sort,stock})}"${!category ? ' aria-current="page"' : ''}>All groceries</a>
    ${state.categories.map(c => `<a href="${shop({category:c.id,q,sort,stock})}"${c.id === category ? ' aria-current="page"' : ''}>${e(c.label)}</a>`).join('')}</nav>` : '';
  const contents = `${nav}<div class="results"><p>${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}${q ? ' for “'+e(q)+'”' : ''}</p>
    <div class="actions"><label><input type="checkbox" id="stock-only"${stock ? ' checked' : ''}> In stock</label>
    <select id="sort" aria-label="Sort products">${[['','Featured'],['popular','Best sellers'],['price-low','Price low to high'],['price-high','Price high to low']].map(([value,name])=>option(value,name,sort)).join('')}</select></div></div>
    ${filtered.length ? productGrid(filtered) : empty(page === 'favorites' ? 'No saved products yet' : 'No products found',page === 'favorites' ? 'Tap the heart on any product to save it here.' : 'Try another search or browse all groceries.')}`;
  return section(title,contents,label);
}
function detail() {
  const p = productById(filters().id);
  if (!p) return section('Product unavailable',empty('This product is unavailable','Browse the catalogue for more groceries.'));
  const v = p.variants.find(x=>x.stock>0) ?? p.variants[0];
  const related = state.products.filter(x => x.id !== p.id && (x.category === p.category || x.best)).slice(0,5);
  const reviews = state.reviews.filter(x => x.product === p.id);
  return `<section class="wrap section">${trail(p.name, `<a href="${shop({category:p.category})}">${e(currentCategory(p.category)?.label ?? 'Groceries')}</a><span>/</span>`)}
    <div class="detail-grid"><img class="detail-image" src="${image(p.image)}" width="356" height="356" alt="${e(p.name)}">
    <div class="product-summary"><h1>${e(p.name)}</h1><div id="detail-price">${cost(v)}</div><p>${e(p.description)}</p>
    <p id="stock-status" class="stock">${v.stock ? 'In stock' : 'Out of stock'}</p>
    <form data-form="product" data-id="${e(p.id)}"><label class="field">Size<select name="variant" id="variant">${p.variants.map(opt=>option(opt.id,opt.label + (opt.stock ? '' : ' · Out of stock'),v.id)).join('')}</select></label>
      ${field('qty','Quantity',`type="number" min="1" max="${v.stock || 1}" required`,1)}
      <button class="btn" id="detail-add"${v.stock ? '' : ' disabled'}>${icon('plus')} Add to basket</button>${favorite(p)}</form></div></div>
    <section class="section"><div class="section-head"><h2>Frequently bought together</h2></div>${productGrid(related)}</section>
    <section class="section narrow"><h2>Customer reviews</h2>${reviews.length ? reviews.map(r => `<article class="review"><strong>${e(r.name)}</strong> <span class="stars" aria-label="${r.rating} of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span><p>${e(r.body)}</p></article>`).join('') : '<p class="lede">No reviews yet. You can leave a review from a completed order.</p>'}</section></section>`;
}
const variantIndex = () => new Map(state.products.flatMap(p => p.variants.map(v => [v.id,{...v,product:p}])));
function cartItems() {
  const variants = variantIndex();
  return Object.entries(items).map(([id,qty])=> ({id,qty,v:variants.get(id)}));
}
function changeItem(id,qty) {
  const v = variantIndex().get(id);
  if (qty > 0 && (!v || qty > Math.min(v.stock,99))) {
    toast(v ? 'Only ' + v.stock + ' available.' : 'This item is unavailable.');
    return false;
  }
  if (qty <= 0) delete items[id]; else items[id] = qty;
  nonce = crypto.randomUUID();
  save('cart',items);
  const basket = document.querySelector('.basket');
  basket.querySelector('.count').textContent = amount();
  basket.setAttribute('aria-label','Basket, ' + amount() + ' items');
  return true;
}
function cartLines() {
  return cartItems().map(({id,v,qty})=> `<article class="line">${v ? `<img src="${image(v.product.image)}" alt="">` : '<span></span>'}
    <div><h3>${v ? `<a href="${url('product',{id:v.product.id})}">${e(v.product.name)}</a>` : 'Unavailable product'}</h3><p>${e(v?.label ?? 'Remove this item to continue')}</p>
    <div class="quantity"><button data-action="qty" data-id="${e(id)}" data-qty="${qty-1}" aria-label="Decrease quantity">${icon('minus')}</button><span>${qty}</span><button data-action="qty" data-id="${e(id)}" data-qty="${qty+1}" aria-label="Increase quantity"${v && qty < Math.min(v.stock,99) ? '' : ' disabled'}>${icon('plus')}</button></div></div>
    <div><strong>${v ? rs(qty*v.price) : '—'}</strong><button class="textlink remove" data-action="qty" data-id="${e(id)}" data-qty="0">Remove</button></div></article>`).join('');
}
const quoteBody = (data = {}) => ({items:Object.entries(items).map(([id,qty])=>({id,qty})),coupon,...data});
function fallbackTotals() {
  const subtotal = cartItems().reduce((sum,x)=>sum+x.qty*(x.v?.price ?? 0),0);
  return { subtotal, discount:0, fee:null, total:subtotal, coupon:'' };
}
function totals(q) {
  return `<div class="totals"><div><span>Subtotal</span><strong>${rs(q.subtotal)}</strong></div>${q.discount ? `<div><span>Discount ${e(q.coupon)}</span><strong>−${rs(q.discount)}</strong></div>` : ''}
    <div><span>Delivery</span><span>${q.fee == null ? 'Calculated at checkout' : q.fee ? rs(q.fee) : 'Free'}</span></div><div class="total"><span>Total</span><span>${rs(q.total)}</span></div></div>`;
}
let cartQuote;
function cartSummary() {
  return `<div data-quote>${totals(cartQuote ?? fallbackTotals())}</div><form class="coupon" data-form="coupon"><input name="coupon" aria-label="Promo code" placeholder="Promo code" value="${e(coupon)}"><button class="btn secondary">Apply</button></form>
    <p data-feedback role="status"></p>${state.settings.preview ? '<p class="notice">Preview offer code <strong>ISLAND10</strong></p>' : ''}
    ${link(url('checkout'),'Continue to checkout','btn block')}`;
}
function refreshCartQuote(container) {
  const totalsBox = container.querySelector('[data-quote]');
  if (!totalsBox || !amount()) return;
  api('quote',quoteBody()).then(q => { cartQuote=q; if (totalsBox.isConnected) totalsBox.innerHTML = totals(q); }).catch(error => {
    if (totalsBox.isConnected && coupon) totalsBox.innerHTML = totals(fallbackTotals()) + `<p class="error">${e(error.message)}</p>`;
  });
}
function cartPage() {
  return section('Your basket', !amount() ? empty('Your basket is empty','Add your favourite groceries and they’ll appear here.') :
    `<div class="cart-columns"><div class="card">${cartLines()}</div><aside class="card"><h3>Order summary</h3>${cartSummary()}</aside></div>`);
}
function openCart() {
  drawer.innerHTML = `<div class="drawer-head"><h2 class="drawer-title" id="drawer-title">Your basket</h2><button class="icon-link" data-action="close" aria-label="Close basket">${icon('close')}</button></div>
    ${amount() ? cartLines() + cartSummary() + `<p class="lede">${link(url('cart'),'View full basket','textlink')}</p>` : empty('Your basket is empty','Find something for your pantry.')}`;
  if (!drawer.open) drawer.showModal();
  refreshCartQuote(drawer);
}
function checkout() {
  if (!amount()) return section('Checkout',empty('Your basket is empty','Add groceries before checking out.'));
  const {settings,user} = state;
  const today = new Date(Date.now()+19800000).toISOString().slice(0,10);
  const last = new Date(Date.now()+15*86400000).toISOString().slice(0,10);
  return section('Checkout', `<div class="checkout-grid form-grid"><form data-form="checkout" class="card">
    ${settings.preview ? '<p class="notice">Test checkout. Use sample contact details. No money will be collected.</p>' : ''}
    <h3>Contact details</h3><div class="form-grid">
    ${!user ? `<p>Checking out as a guest. <a class="textlink" target="_top" href="/signin-with-chatgpt?return_to=%2F%3Fpage%3Dcheckout">Sign in</a> to save this order to your account.</p>` : '<label><input type="checkbox" name="asGuest"> Place this order as a guest</label>'}
    ${field('name','Full name','required autocomplete="name" maxlength="100"')}
    <div class="form-row">${field('email','Email','required type="email" autocomplete="email"',user?.email?.endsWith('.test') ? '' : user?.email)}${field('phone','Phone','required type="tel" autocomplete="tel"')}</div>
    <fieldset><legend>Fulfilment</legend><div class="radio-row"><label><input type="radio" name="method" value="delivery" checked> Delivery</label>
    ${settings.collection ? '<label><input type="radio" name="method" value="collection"> Local collection</label>' : ''}</div></fieldset>
    <div class="form-grid" id="delivery-fields" style="margin:0">${field('address','Delivery address','required autocomplete="street-address" maxlength="300"')}${field('postcode','Postcode','required autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="00100"')}</div>
    <div class="form-row">${field('date','Date',`required type="date" min="${today}" max="${last}"`,today)}
    <label class="field">Time slot<select name="slot" required>${settings.slots.map(slot=>option(slot)).join('')}</select></label></div>
    <label class="field">Delivery or collection notes <textarea name="notes" maxlength="500" placeholder="Optional"></textarea></label>
    <fieldset><legend>Payment</legend><p>Pay on delivery or collection${settings.preview ? ' (test only)' : ''}.</p></fieldset>
    </div><p data-feedback role="status"></p><button class="btn block" type="submit">Place ${settings.preview ? 'test ' : ''}order</button></form>
    <aside class="card"><h3>Order summary</h3>${cartItems().map(({v,qty})=>`<div class="line"><img src="${image(v?.product.image ?? 'rice')}" alt=""><span>${e(v?.product.name ?? 'Unavailable product')}<p>${qty} × ${e(v?.label ?? '')}</p></span><strong>${v ? rs(v.price*qty) : '—'}</strong></div>`).join('')}
    <div id="checkout-quote" aria-live="polite">${totals(fallbackTotals())}</div><p class="lede">Minimum order ${rs(settings.minimum)} after discounts.</p><p>${link(url('cart'),'Edit basket or promo code','textlink')}</p></aside></div>`);
}
function updateCheckoutQuote(form) {
  const data = Object.fromEntries(new FormData(form));
  const box = document.querySelector('#checkout-quote');
  const delivery = data.method === 'delivery';
  const version = ++quoteVersion;
  form.querySelector('#delivery-fields').hidden = !delivery;
  for (const input of form.querySelectorAll('#delivery-fields input')) input.required = delivery;
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(async () => {
    try {
      const q = await api('quote',quoteBody(data));
      if (box.isConnected && version === quoteVersion) box.innerHTML = totals(q) + (delivery && data.postcode?.length === 5 ? `<p class="${q.area ? 'success' : 'error'}">${q.area ? e(q.area) + ' delivery' : 'This postcode is outside our delivery areas.'}</p>` : '');
    } catch (error) {
      if (box.isConnected && version === quoteVersion) box.innerHTML = totals(fallbackTotals()) + `<p class="error">${e(error.message)}</p>`;
    }
  },150);
}

function accountView() {
  const user = state.user;
  const saved = new Map(guestOrders.map(x=>[x.id,x]));
  for (const order of account?.orders ?? []) saved.set(order.id,order);
  return section('My account',`<div class="card form-grid">
    ${browserDemo ? '<p>You’re using the demo account. Orders are saved in this tab.</p>' : user ? `<p>Signed in as <strong>${e(user.email)}</strong></p>${user.id !== 'local-preview-owner' ? '<p><a class="textlink" target="_top" href="/signout-with-chatgpt?return_to=%2F">Sign out</a></p>' : ''}` :
      '<p>Sign in to access registered orders across devices.</p><div><a class="btn" target="_top" href="/signin-with-chatgpt?return_to=%2F%3Fpage%3Daccount">Sign in with ChatGPT</a></div>'}
    <div class="actions">${link(url('favorites'),'Saved favourites','btn secondary')}${user?.admin ? link(url('admin'),'Store administration','btn secondary') : ''}</div>
    <h2>Order history</h2>${saved.size ? `<div class="account-list">${[...saved.values()].map(x=>`<div class="order-row"><div><strong>${e(x.id)}</strong><p>${x.created ? labelOrder(x) + ' · ' : ''}${x.status ? orderStatus(x.status) + ' · ' : ''}${rs(x.total)}</p></div>${link(url('order',{id:x.id}),'View order','btn secondary small')}</div>`).join('')}</div>` : '<p>Your orders will appear here.</p>'}
    </div><form class="card form-grid" data-form="track"><h2>Track a guest order</h2>
    ${field('id','Order number','placeholder="IP-XXXXXXXX" required')}${field('tracking','Tracking code','required')}
    <div><button class="btn">Find order</button></div><p data-feedback role="status"></p></form>`, '', true);
}
function orderView() {
  const order = activeOrder?.order ?? orderResult?.order;
  if (!order || order.id !== filters().id) return section('Order details', '<p class="lede">Loading order…</p>', '', true);
  const tracking = activeOrder?.tracking ?? orderResult?.tracking;
  const placed = orderResult?.order.id === order.id;
  const adminViewing = filters().from === 'admin' && state.user?.admin;
  return section(placed ? 'Order confirmed' : 'Order details', `<article class="card form-grid">
    ${placed ? `<p class="success">${icon('check')} Your ${state.settings.preview ? 'test ' : ''}order has been placed.</p>` : ''}
    <div class="order-row"><div><h2>${e(order.id)}</h2><p>${labelOrder(order)} · ${e(order.name)}</p></div><strong>${orderStatus(order.status)}</strong></div>
    <p>${order.method === 'delivery' ? 'Delivery' : 'Collection'} on ${e(order.date)} · ${e(order.slot)}</p>
    ${order.address ? `<p>${e(order.address)} · ${e(order.postcode)}</p>` : ''}${adminViewing ? `<p>${e(order.email)} · ${e(order.phone)}</p>` : ''}
    ${order.notes ? `<p>Order notes: ${e(order.notes)}</p>` : ''}
    ${order.items.map(x=>`<div class="order-row"><span>${x.qty} × ${e(x.name)} (${e(x.label)})</span><strong>${rs(x.qty*x.price)}</strong></div>`).join('')}
    ${totals(order)}<p>Payment ${order.paid ? 'received' : order.status === 'cancelled' ? 'cancelled' : 'due on delivery or collection'}.</p>
    ${tracking ? `<p class="notice">Guest tracking code <strong>${e(tracking)}</strong></p>` : ''}
    <div class="actions no-print"><button class="btn" data-action="reorder">Add items to basket again</button><button class="btn secondary" data-action="print">Print order record</button></div>
    ${adminViewing ? `<form class="form-grid no-print" data-form="order-status" data-id="${e(order.id)}"><h3>Update order</h3>
    <label class="field">Status<select name="status">${[order.status,...({pending:['processing','cancelled'],processing:['dispatched','completed','cancelled'],dispatched:['completed']}[order.status] ?? [])].map(x=>option(x,orderStatus(x))).join('')}</select></label>
    <label><input type="checkbox" name="paid"${order.paid ? ' checked' : ''}> Payment received</label><div><button class="btn">Save order</button></div><p data-feedback role="status"></p></form>` : ''}
    </article>${order.status === 'completed' && !adminViewing ? `<form class="card form-grid" data-form="review"><h2>Review your groceries</h2>
    <label class="field">Product<select name="product">${[...new Map(order.items.map(x=>[x.product,x.name]))].map(([id,name])=>option(id,name)).join('')}</select></label>
    <label class="field">Rating<select name="rating">${[5,4,3,2,1].map(x=>option(x,x+' out of 5')).join('')}</select></label>
    <label class="field">Review<textarea name="body" minlength="8" maxlength="650" required></textarea></label><div><button class="btn">Submit review</button></div><p data-feedback role="status"></p></form>` : ''}`, '', true);
}
function information(page) {
  const { settings } = state;
  if (page === 'about') return section('About Island Pantry', `<div class="detail-grid form-grid"><div class="prose"><p>Island Pantry is an online mini mart for the flavours and pantry staples of Sri Lanka. Find the rice, spices and coconut products that go into everyday curries, plus tea, biscuits and snacks for the table.</p><h2>Made for the everyday shop</h2><p>Choose your pack sizes, build a basket and check delivery or collection options at checkout.</p>${link(shop(),'Explore the pantry')}</div><img class="detail-image" src="${image('island-table')}" alt="A Sri Lankan rice and curry meal"></div>`);
  if (page === 'contact') return section('Contact us',`<form class="card form-grid" data-form="message">
    ${settings.preview ? '<p class="notice">Use sample details. Preview messages appear in the demo dashboard.</p>' : ''}
    ${field('name','Name','required autocomplete="name" maxlength="100"')}${field('email','Email','type="email" required autocomplete="email"')}
    <label class="field">How can we help?<textarea name="message" minlength="8" maxlength="1500" required></textarea></label><div><button class="btn">Send enquiry</button></div><p data-feedback role="status"></p></form>
    ${settings.email ? `<p class="lede"><a class="textlink" href="mailto:${e(settings.email)}">${e(settings.email)}</a></p>` : ''}${settings.whatsapp ? `<p class="lede"><a class="textlink" target="_blank" rel="noopener noreferrer" href="https://wa.me/${e(settings.whatsapp)}">Message us on WhatsApp</a></p>` : ''}`, 'Ask about products, delivery or an order.', true);
  if (page === 'faq') return section('Frequently asked questions', `<div class="faq">${[
    ['Where do you deliver?', 'Enter your five-digit postcode at checkout to see options and charges. Preview areas include ' + settings.deliveryAreas.map(x=>x.label).join(' and ') + '.'],
    ['What’s the minimum order?', 'The minimum is ' + rs(settings.minimum) + ' after discounts. Eligible delivery orders of ' + rs(settings.freeDelivery) + ' or more qualify for free delivery.'],
    ['Can I collect my order?', settings.collection ? 'Yes. Choose Local collection and an available date and time at checkout.' : 'Collection is currently unavailable.'],
    ['How can I pay?', 'The preview displays payment on delivery or collection. Test orders involve no payment.'],
    ['How can I track an order?', 'Open My account for registered orders. For a guest order, enter the order number and tracking code shown on your order confirmation.'],
    ['How do returns work?', 'Use the contact form with your order number. The store’s approved returns and refund policy will be added before launch.'],
  ].map(([a,b])=>`<details><summary>${e(a)}</summary><p>${e(b)}</p></details>`).join('')}</div>`, '', true);
  return section('Privacy & policies', `<div class="prose"><p class="notice">${browserDemo ? 'This is a public demonstration. Demo orders and messages stay in this tab.' : 'These notes describe the private preview. Final store policies are pending business approval.'}</p>
    <h2>Privacy</h2><p>Test checkout collects contact, fulfilment and order details in the store database. Basket and favourites are saved on this browser. Use fictional contact and address details when trying the preview.</p>
    <h2>Terms and payment</h2><p>Products, prices and availability are sample data. Orders placed in the preview are test orders. Payment on delivery or collection illustrates the checkout flow.</p>
    <h2>Delivery and collection</h2><p>The checkout calculates eligible delivery and service charges from the preview postcode rules and shows available dates and slots. Confirmed courier, store address and collection hours will be added before public launch.</p>
    <h2>Returns and refunds</h2><p>The store’s approved returns, refunds and cancellation terms will appear here before launch. The contact form can be used to test an order enquiry.</p></div>`, '', true);
}
function renderMain() {
  const page = route();
  const renders = {
    home, shop:()=>listing('shop'), offers:()=>listing('offers'), favorites:()=>listing('favorites'),
    product:detail, cart:cartPage, checkout, account:accountView, order:orderView,
    admin:()=>state.user?.admin ? (admin ? adminView(admin,filters().tab ?? 'orders',filters().edit ?? '',filters().parent ?? '') :
      section('Store administration','<p class="lede">Loading management dashboard…</p>')) :
      section('Store administration','<p class="lede">Owner sign-in is required.</p>'),
  };
  main.innerHTML = (renders[page] ?? (()=>['about','contact','faq','policies'].includes(page) ? information(page) : section('Page unavailable',empty('Page unavailable','Go back to the shop.'))))();
  if (failed && ['home','shop','checkout','admin'].includes(page)) main.insertAdjacentHTML('afterbegin','<div class="wrap"><p class="notice">The store service is unavailable. Refresh to reconnect.</p></div>');
  const form = main.querySelector('[data-form=checkout]');
  if (form) updateCheckoutQuote(form);
  if (page === 'cart') refreshCartQuote(main);
  const title = main.querySelector('h1')?.textContent;
  document.title = page === 'home' ? 'Island Pantry | Sri Lankan Groceries' : (title ?? 'Shop') + ' | Island Pantry';
}
async function loadPage() {
  const key = ++sectionRequest;
  if (!ready) return;
  const page = route();
  try {
    if (page === 'account' && state.user) {
      const data = await api('account');
      if (key === sectionRequest) { account = data; renderMain(); }
    }
    if (page === 'admin' && state.user?.admin) {
      const data = await api('admin');
      if (key === sectionRequest) { admin = data; renderMain(); }
    }
    if (page === 'order') {
      const id = filters().id;
      const tracking = guestOrders.find(x=>x.id === id)?.tracking;
      const result = await api('track',{id,tracking});
      if (key === sectionRequest) { activeOrder = {...result,tracking}; renderMain(); }
    }
  } catch (error) {
    if (key === sectionRequest) main.innerHTML = section('Unable to load', `<p class="error">${e(error.message)}</p><p>${link(url('account'),'Back to my account','textlink')}</p>`);
  }
}
function render() { header(); footer(); renderMain(); loadPage(); }
function feedback(form,message,type) {
  const box = form.closest('.card, aside, .newsletter, dialog')?.querySelector('[data-feedback]');
  if (box) { box.textContent = message; box.className = type; }
}
async function reloadCatalogue() {
  state = await api('catalogue');
  ready = true;
}
function storeOrder(order,tracking) {
  if (!tracking) return;
  guestOrders = [{id:order.id,tracking,created:order.created,total:order.total,status:order.status}, ...guestOrders.filter(x=>x.id!==order.id)].slice(0,30);
  save('orders',guestOrders);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest('a[href]');
  if (anchor && !anchor.target && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button===0 &&
    anchor.origin === location.origin && anchor.pathname === appRoot && !anchor.hash) {
    event.preventDefault(); go(anchor.pathname + anchor.search); return;
  }
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const {action,id,qty} = button.dataset;
  if (action === 'cart') openCart();
  if (action === 'close') drawer.close();
  if (action === 'add' && changeItem(id,(items[id] ?? 0)+1)) toast('Added to basket');
  if (action === 'qty' && changeItem(id,Number(qty))) {
    cartQuote = null;
    if (drawer.open) openCart();
    if (route() === 'cart') renderMain();
  }
  if (action === 'favorite') {
    favorites = favorites.includes(id) ? favorites.filter(x=>x!==id) : [...favorites,id];
    save('favorites',favorites);
    button.setAttribute('aria-pressed',String(favorites.includes(id)));
    if (route() === 'favorites') renderMain();
    toast(favorites.includes(id) ? 'Saved to favourites' : 'Removed from favourites');
  }
  if (action === 'print') window.print();
  if (action === 'reorder') {
    const order = activeOrder?.order ?? orderResult?.order;
    const variants = variantIndex();
    let count = 0;
    for (const item of order?.items ?? []) {
      const before = items[item.variant] ?? 0;
      const qty = Math.min(item.qty,Math.min(variants.get(item.variant)?.stock ?? 0,99)-before);
      if (qty > 0 && changeItem(item.variant,before+qty)) count += qty;
    }
    toast(count ? count + ' available items added to basket' : 'These items are currently unavailable');
    if (count) openCart();
  }
  if (action === 'variant-row') {
    const form = button.closest('form'), template = form.querySelector('template');
    button.before(template.content.cloneNode(true));
  }
});
drawer.addEventListener('click',event=>{ if(event.target===drawer) drawer.close(); });
document.addEventListener('change',event => {
  const input = event.target;
  if (input.id === 'sort' || input.id === 'stock-only') {
    const params = filters();
    if (input.id === 'sort') params.sort=input.value; else params.stock=input.checked?'yes':'';
    const {page,...rest}=params; go(url(page,rest));
  }
  if (input.id === 'variant') {
    const v = variantIndex().get(input.value);
    document.querySelector('#detail-price').innerHTML = cost(v);
    document.querySelector('#stock-status').textContent = v.stock ? 'In stock' : 'Out of stock';
    document.querySelector('#detail-add').disabled = !v.stock;
    const qty = input.form.elements.qty;
    qty.max = v.stock || 1;
    qty.value = Math.min(Number(qty.value) || 1,v.stock || 1);
  }
  if (input.name === 'method' && input.form?.dataset.form === 'checkout') updateCheckoutQuote(input.form);
});
document.addEventListener('input',event => {
  if (event.target.name === 'postcode' && event.target.form?.dataset.form === 'checkout') updateCheckoutQuote(event.target.form);
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const data = Object.fromEntries(new FormData(form));
  if (kind === 'search') { go(shop({q:data.q.trim()})); return; }
  if (kind === 'product') {
    if (changeItem(data.variant,(items[data.variant] ?? 0)+Number(data.qty))) toast('Added to basket');
    return;
  }
  const button = event.submitter;
  if (button) button.disabled = true;
  feedback(form,'','');
  try {
    if (kind === 'coupon') {
      const code = data.coupon.trim().toUpperCase();
      cartQuote = await api('quote',quoteBody({coupon:code}));
      coupon = code; save('coupon',coupon); nonce = crypto.randomUUID();
      const container = drawer.open ? drawer : main;
      container.querySelector('[data-quote]').innerHTML = totals(cartQuote);
      feedback(form,code ? 'Promo code applied.' : 'Promo code removed.','success');
    } else if (kind === 'checkout') {
      const attached = {...data,nonce,asGuest:!!data.asGuest};
      orderResult = await api('order',quoteBody(attached));
      activeOrder = orderResult;
      storeOrder(orderResult.order, orderResult.tracking);
      items={}; coupon=''; cartQuote=null; save('cart',items); save('coupon',coupon);
      nonce = crypto.randomUUID();
      go(url('order',{id:orderResult.order.id}));
      reloadCatalogue().catch(()=>{});
    } else if (kind === 'track') {
      const tracking = data.tracking.trim();
      const result = await api('track',{id:data.id.trim().toUpperCase(),tracking});
      storeOrder(result.order,tracking); activeOrder = {...result,tracking};
      go(url('order',{id:result.order.id}));
    } else if (kind === 'review') {
      const {order,tracking} = activeOrder ?? orderResult;
      await api('review',{...data,rating:Number(data.rating),id:order.id,tracking});
      form.reset();
      feedback(form,'Review submitted for moderation.','success');
    } else if (kind === 'newsletter' || kind === 'message') {
      await api(kind,data);
      form.reset();
      feedback(form,kind === 'newsletter' ? 'You’re on the list.' : 'Your enquiry was received.','success');
    } else if (kind === 'order-status') {
      await api('manage',{kind:'order',id:form.dataset.id,status:data.status,paid:Boolean(data.paid)});
      orderResult = null;
      await loadPage();
      toast('Order updated');
    } else if (kind.startsWith('admin-')) {
      await api('manage',adminData(form,data));
      await reloadCatalogue();
      admin = await api('admin');
      go(url('admin',{tab:filters().tab || 'orders'}));
      toast('Changes saved');
    }
  } catch (error) { feedback(form,error.message,'error'); }
  finally { if (button?.isConnected) button.disabled = false; }
});
window.addEventListener('popstate',()=>{ if(drawer.open) drawer.close(); render(); });
render();
reloadCatalogue().then(()=>{
  const input = document.activeElement;
  if (input?.matches('.search input')) {
    footer(); renderMain(); loadPage();
  } else if (route() === 'checkout' && document.querySelector('form[data-form=checkout]')?.contains(input)) {
    loadPage();
  } else render();
}).catch(()=>{ failed=true; render(); });
