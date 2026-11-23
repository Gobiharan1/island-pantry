import { appRoot, browserDemo, escape as e, field, option, rs, url } from './ui.mjs';

const tabs = {
  orders:'Orders', inventory:'Products & stock', categories:'Categories', coupons:'Coupons',
  customers:'Customers', inbox:'Inbox', reviews:'Reviews', settings:'Store settings',
};
const thumbs = 'rice curry coconut biscuits tea onions lentils sambol hoppers limes household bundle'.split(' ');
const route = (tab,edit) => url('admin',{tab,edit});
const edit = (tab,id,label='Edit') => `<a class="textlink" href="${route(tab,id)}">${label}</a>`;
const check = (name,label,value) => `<label><input type="checkbox" name="${name}"${value?' checked':''}> ${label}</label>`;
const select = (name,label,choices,value) => `<label class="field">${label}<select name="${name}">${choices.map(([x,y])=>option(x,y,value)).join('')}</select></label>`;
const textarea = (name,label,value,attrs='') => `<label class="field">${label}<textarea name="${name}" ${attrs}>${e(value)}</textarea></label>`;
const submit = `<div><button class="btn">Save changes</button></div><p data-feedback role="status"></p>`;
const table = (headings,rows) => rows.length ? `<div class="table-scroll"><table><thead><tr>${headings.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="lede">No records yet.</p>';
const date = date => new Date(date).toLocaleDateString('en-LK',{timeZone:'Asia/Colombo'});
const imageSelect = value => select('image','Product image',thumbs.map(x=>[x,x]),value);
const idAttrs = 'required pattern="[a-z0-9][a-z0-9\\-]{0,79}" maxlength="80"';
const numeric = 'required type="number" min="0" step="1"';

function variant(v = {}) {
  return `<fieldset data-variant><legend>Size or packaging</legend><div class="form-grid">
    <div class="form-row">${field('variantID','Variant ID',`placeholder="product-standard" ${v.id ? 'readonly' : ''}`,v.id)}
    ${field('variantLabel','Size or pack label','maxlength="50" placeholder="500 g"',v.label)}</div>
    <div class="form-row">${field('variantPrice','Selling price (Rs.)','type="number" min="1" step="1"',v.price)}
    ${field('variantWas','Regular price (optional)','type="number" min="1" step="1"',v.was)}</div>
    ${field('variantStock','Stock quantity','type="number" min="0" step="1"',v.stock)}
    ${check('variantActive','Available in catalogue',v.active ?? true)}</div></fieldset>`;
}

function inventory(data,id) {
  const p = data.products.find(x=>x.id===id);
  const form = id ? `<form class="card form-grid" data-form="admin-product"><h2>${p ? 'Edit product' : 'New product'}</h2>
    <div class="form-row">${field('id','Product ID',p?'readonly':idAttrs,p?.id)}
    ${field('name','Product name','required maxlength="100"',p?.name)}</div>
    ${textarea('description','Description',p?.description,'required maxlength="1200"')}
    <div class="form-row">${select('category','Category',data.categories.map(x=>[x.id,x.label]),p?.category)}${imageSelect(p?.image)}</div>
    <div class="actions">${check('active','Show in shop',p?.active ?? true)}${check('featured','Featured',p?.featured)}${check('best','Best seller',p?.best)}</div>
    ${(p?.variants ?? [{}]).map(variant).join('')}
    <template>${variant()}</template><div><button type="button" class="btn secondary" data-action="variant-row">Add variation</button></div>${submit}</form>` : '';
  const rows = data.products.map(x=>[e(x.name),e(data.categories.find(c=>c.id===x.category)?.label),
    x.variants.map(v=>e(v.label)+': '+v.stock+(!v.active?' (hidden)':v.stock<=5?' (low)':'')).join('<br>'),
    x.active ? 'Visible' : 'Hidden', edit('inventory',x.id)]);
  return `<div class="actions admin-form">${edit('inventory','new','New product')}</div>${form}${table(['Product','Category','Stock','Visibility','Manage'],rows)}`;
}
function categories(data,id) {
  const c=data.categories.find(x=>x.id===id);
  return `<div class="actions admin-form">${edit('categories','new','New category')}</div>
    ${id ? `<form class="card form-grid" data-form="admin-category"><h2>${c?'Edit category':'New category'}</h2>
    ${field('id','Category ID',c?'readonly':idAttrs,c?.id)}${field('label','Category label','required maxlength="60"',c?.label)}
    ${select('parent','Parent category',[['','Top-level category'],...data.categories.filter(x=>x.id!==id).map(x=>[x.id,x.label])],c?.parent ?? '')}
    <div class="form-row">${imageSelect(c?.image)}${field('tint','Tile colour','type="color"',c?.tint ?? '#f4edda')}</div>${submit}</form>` : ''}
    ${table(['Category','Parent','Manage'],data.categories.map(x=>[e(x.label),e(data.categories.find(y=>y.id===x.parent)?.label ?? '—'),edit('categories',x.id)]))}`;
}
function coupons(data,id) {
  const c=data.coupons.find(x=>x.code===id);
  return `<div class="actions admin-form">${edit('coupons','new','New coupon')}</div>
    ${id ? `<form class="card form-grid" data-form="admin-coupon"><h2>${c?'Edit coupon':'New coupon'}</h2>
    ${field('code','Promo code',c?'readonly':'required maxlength="30"',c?.code)}
    ${field('percent','Percentage off','required type="number" min="1" max="90"',c?.percent)}
    ${check('active','Active',c?.active ?? true)}${submit}</form>` : ''}
    ${table(['Code','Discount','Status','Manage'],data.coupons.map(x=>[e(x.code),x.percent+'%',x.active?'Active':'Inactive',edit('coupons',x.code)]))}`;
}
function settings(data) {
  const s=data.settings;
  return `<form class="card form-grid" data-form="admin-settings"><h2>Storefront and fulfilment</h2>
    ${field('banner','Top banner','maxlength="150"',s.banner)}${field('heroHeading','Homepage heading','required maxlength="70"',s.heroHeading)}
    ${textarea('heroCopy','Homepage description',s.heroCopy,'required maxlength="220"')}
    <div class="form-row">${field('email','Support email','type="email"',s.email)}${field('whatsapp','WhatsApp number (country code included)','type="tel"',s.whatsapp)}</div>
    <div class="form-row">${field('minimum','Minimum order (Rs.)',numeric,s.minimum)}${field('freeDelivery','Free delivery threshold (Rs.)',numeric,s.freeDelivery)}</div>
    ${check('collection','Allow local collection',s.collection)}
    ${textarea('deliveryAreas','Delivery areas (one per line: label | first postcode | last postcode | fee)',s.deliveryAreas.map(x=>[x.label,x.from,x.to,x.fee].join(' | ')).join('\n'))}
    ${textarea('slots','Available time slots (one per line)',s.slots.join('\n'),'required')}
    ${submit}</form>`;
}
const orders = data => table(['Order','Customer','Total','Status','Placed','Manage'],data.orders.map(x=>[
  e(x.id),e(x.name),rs(x.total),e(x.status)+(x.paid?' · paid':''),date(x.created),
  `<a class="textlink" href="${url('order',{id:x.id,from:'admin'})}">View</a>`,
]));
const customers = data => table(['Email','Orders','Most recent'],data.customers.map(x=>[e(x.email),x.orders,date(x.latest)]));
const inbox = data => `<div class="form-grid"><h2>Enquiries</h2>${table(['From','Message','Received'],data.messages.map(x=>[e(x.name)+'<br>'+e(x.email),e(x.body),date(x.created)]))}
  <h2>Newsletter subscribers</h2>${table(['Email','Subscribed'],data.subscribers.map(x=>[e(x.email),date(x.created)]))}</div>`;
const reviews = data => data.reviews.length ? `<div class="account-list">${data.reviews.map(x=>`<form class="card form-grid" data-form="admin-review" data-id="${e(x.id)}">
  <div class="order-row"><strong>${e(data.products.find(p=>p.id===x.product)?.name ?? x.product)}</strong><span>${x.rating} / 5</span></div>
  <p>${e(x.name)} · ${date(x.created)}</p><p>${e(x.body)}</p>${check('approved','Visible on product page',x.approved)}${submit}</form>`).join('')}</div>` : '<p>No reviews yet.</p>';

export function adminView(data,tab,id) {
  const name = tabs[tab] ? tab : 'orders';
  const pages = {orders,inventory,categories,coupons,customers,inbox,reviews,settings};
  return `<section class="wrap section"><nav class="crumb" aria-label="Breadcrumb"><a href="${appRoot}">Home</a><span>/</span><span>Store administration</span></nav>
    <h1>Store administration</h1>${browserDemo ? '<p class="notice">Demo dashboard. Changes only affect this tab.</p>' : ''}<div class="benefits">
      <div class="benefit"><span><strong>${data.report.orders} orders</strong><small>All orders</small></span></div>
      <div class="benefit"><span><strong>${rs(data.report.revenue)}</strong><small>Payments recorded</small></span></div>
      <div class="benefit"><span><strong>${data.report.low} low-stock variations</strong><small>Five or fewer in stock</small></span></div></div>
    <nav class="admin-tabs" aria-label="Administration tabs">${Object.entries(tabs).map(([key,label])=>`<a class="btn ${key===name?'':'secondary'} small" href="${route(key)}"${key===name?' aria-current="page"':''}>${label}</a>`).join('')}</nav>
    <div class="card"><h2>${tabs[name]}</h2>${pages[name](data,id)}</div></section>`;
}
const lines = value => String(value ?? '').split('\n').map(x=>x.trim()).filter(Boolean);
export function adminData(form,data) {
  const kind=form.dataset.form.slice(6);
  if (kind === 'product') {
    const variants = [...form.querySelectorAll('[data-variant]')].map((row,index) => {
      const value = name => row.querySelector(`[name="variant${name}"]`).value.trim();
      const label = value('Label');
      return { id:value('ID') || data.id + '-' + (index+1),label,price:Number(value('Price')),
        was:value('Was') ? Number(value('Was')) : null,stock:Number(value('Stock')),
        active:row.querySelector('[name="variantActive"]').checked };
    }).filter(v=>v.label || v.price);
    return {...data,kind,variants,active:!!data.active,best:!!data.best,featured:!!data.featured};
  }
  if (kind === 'coupon') return {...data,kind,percent:Number(data.percent),active:!!data.active};
  if (kind === 'settings') return {...data,kind,minimum:Number(data.minimum),freeDelivery:Number(data.freeDelivery),collection:!!data.collection,
    slots:lines(data.slots),deliveryAreas:lines(data.deliveryAreas).map(line=>{
      const [label,from,to,fee]=line.split('|').map(s=>s.trim());
      return {label,from,to,fee:fee ? Number(fee) : null};
    })};
  if (kind === 'review') return {kind,id:form.dataset.id,approved:!!data.approved};
  return {...data,kind};
}
