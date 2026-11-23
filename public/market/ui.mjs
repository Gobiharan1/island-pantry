export const appRoot = new URL('../', import.meta.url).pathname;
export const asset = name => new URL(name, import.meta.url).pathname;
export const image = key => asset(encodeURIComponent(key) + '.webp');
export const browserDemo = typeof document !== 'undefined' && document.documentElement.dataset.demo === 'pages';
export const rs = value => 'Rs. ' + Number(value).toLocaleString('en-LK',{maximumFractionDigits:0});
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
})[char]);
export const url = (page, params = {}) => {
  const query = new URLSearchParams({page});
  for (const [key,value] of Object.entries(params)) if (value) query.set(key,value);
  return page === 'home' ? appRoot : appRoot + '?' + query;
};
export const field = (name, label, attrs = '', value = '') =>
  `<label class="field">${escape(label)}<input name="${name}" ${attrs} value="${escape(value)}"></label>`;
export const option = (value, label = value, current) => `<option value="${escape(value)}"${current === value ? ' selected' : ''}>${escape(label)}</option>`;
const icons = {
  truck:'<path d="M3 5h12v12H3zM15 9h4l3 4v4h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  user:'<circle cx="12" cy="7.5" r="3.4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  heart:'<path d="M20.7 9c0 4.4-8.7 9.3-8.7 9.3S3.3 13.4 3.3 9c0-4.2 5.6-6 8.7-2.5C15.1 3 20.7 4.8 20.7 9Z"/>',
  bag:'<path d="M5 7h14l1 13H4L5 7Z"/><path d="M9 9V6a3 3 0 1 1 6 0v3"/>',
  grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  tag:'<path d="M20.5 13 12 21l-9-9V4h8l9.5 9Z"/><circle cx="7.5" cy="8.5" r="1"/>',
  leaf:'<path d="M20 4c-8 0-13 4-13 10 0 2 1.6 3 3.2 3.2C16 18 20 12 20 4ZM4 21c2.7-4.6 6-7.7 10-10"/>',
  box:'<path d="M3 7 12 3l9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10M7.5 5l9 4"/>',
  pin:'<path d="M19 10c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
};
export const icon = key => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[key] ?? ''}</svg>`;

export async function api(action, data) {
  const options = data === undefined ? {} : {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),
  };
  const endpoint = '/api/market/' + action;
  const request = browserDemo
    ? await (await import('./demo.mjs')).previewRequest(new Request(new URL(endpoint, location.origin),options))
    : await fetch(endpoint,options);
  const result = await request.json().catch(() => ({}));
  if (!request.ok) throw new Error(result.error ?? 'The store service is temporarily unavailable.');
  return result;
}
