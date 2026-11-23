import page from '../public/market/index.html?raw';

export function GET() {
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
