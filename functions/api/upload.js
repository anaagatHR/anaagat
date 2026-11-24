// Image upload for the inline editor, stored in R2 and served from /media/.
import { json, sameOrigin } from '../../lib/session.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Bad origin.' }, 403);
  if (!env.MEDIA) return json({ error: 'Image storage (R2 binding MEDIA) is not set up yet.' }, 503);
  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'Choose an image first.' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return json({ error: 'Use a JPG, PNG, WebP, GIF or AVIF image.' }, 415);
  if (file.size > 5 * 1024 * 1024) return json({ error: 'That image is over 5 MB. Please use a smaller one.' }, 413);
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return json({ url: `/media/${key}` });
}
