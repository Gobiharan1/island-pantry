import { env } from 'cloudflare:workers';
import { market } from '../../../../api/commerce.mjs';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return market(request, env);
}

export const POST = GET;
