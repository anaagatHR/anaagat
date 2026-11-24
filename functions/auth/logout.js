import { sessionCookie } from '../../lib/session.js';

export const onRequestGet = ({ env }) => new Response(null, { status: 302, headers: { location: '/admin/login?signed_out=1', 'set-cookie': sessionCookie('', 0, env.COOKIE_DOMAIN) } });
