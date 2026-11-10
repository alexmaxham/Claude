/**
 * AH alt text server (a Cloudflare Worker).
 *
 * The AH Image Resizer sends one shrunken image here; this server checks the sender is signed in with an
 * approved Google account, asks Claude for alt text using AH's shared Anthropic key, and sends the text back.
 * The key lives only here, as a secret. Images are passed through and never stored.
 *
 * Settings (see README.md):
 *   ANTHROPIC_API_KEY  secret  AH's Anthropic API key
 *   ALLOWED_EMAILS     secret  who may use it: comma-separated emails and/or "@domain.com" entries
 *   GOOGLE_CLIENT_ID   var     the Google sign-in client ID the resizer page uses
 *   ALLOWED_ORIGIN     var     the web address the resizer is served from
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const MAX_IMAGE_BASE64 = 2_000_000; // about 1.5 MB of JPEG; the resizer sends far less
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const SYSTEM = [
  'You write alt text for images published by AndroidHeadlines, a technology news site.',
  'Alt text is read aloud by screen readers to people who cannot see the image.',
  'Write one plain sentence, at most 125 characters, that says what is actually visible in the image.',
  'The file name and topic the editor gives you are hints about which product or story this is: use them to name the product when the image is consistent with them, and ignore them when they are generic (camera names like IMG_4821) or clearly do not match the picture.',
  'Do not start with "Image of" or "Picture of". Do not mention watermarks or logos added by the publisher. Do not guess at things you cannot see, and do not name real people.',
  'Reply with the alt text only: no quotes, no label, no explanation.',
].join(' ');

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- Google sign-in ----------

let certCache = { keys: null, expires: 0 };

async function googleKeys(env) {
  if (certCache.keys && Date.now() < certCache.expires) return certCache.keys;
  const res = await fetch(env.GOOGLE_CERTS_URL || GOOGLE_CERTS_URL);
  if (!res.ok) throw new HttpError(502, 'sign_in_check_failed', 'Could not check the Google sign-in. Try again.');
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  certCache = { keys: (await res.json()).keys || [], expires: Date.now() + (maxAge ? Number(maxAge[1]) : 3600) * 1000 };
  return certCache.keys;
}

function base64UrlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function decodePart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

/** Checks a Google ID token properly (signature, who it was issued for, expiry) and returns its claims. */
async function verifyGoogleToken(token, env) {
  const bad = new HttpError(401, 'not_signed_in', 'Sign in with Google to use this.');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw bad;
  let header, claims;
  try {
    header = decodePart(parts[0]);
    claims = decodePart(parts[1]);
  } catch {
    throw bad;
  }
  if (header.alg !== 'RS256') throw bad;
  const jwk = (await googleKeys(env)).find((k) => k.kid === header.kid);
  if (!jwk) throw bad;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]), signed);
  if (!valid) throw bad;
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw bad;
  if (claims.aud !== env.GOOGLE_CLIENT_ID) throw bad;
  if (!claims.exp || claims.exp * 1000 < Date.now()) {
    throw new HttpError(401, 'sign_in_expired', 'Your sign-in has expired. Sign in again.');
  }
  if (!claims.email || claims.email_verified !== true) throw bad;
  return claims;
}

export function isAllowed(email, allowList) {
  const address = String(email).toLowerCase();
  return String(allowList || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith('@') ? address.endsWith(entry) : address === entry));
}

// ---------- Claude ----------

function tidy(text) {
  return String(text).replace(/\s+/g, ' ').trim().replace(/^["'“”]+|["'“”]+$/g, '').replace(/^alt text:\s*/i, '');
}

async function writeAltText(env, { image, fileName, topic }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2 });
  const hint = `Original file name: ${fileName}\n${topic ? `Topic: ${topic}\n` : ''}Write the alt text for this image.`;
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: hint },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new HttpError(502, 'server_key_problem', "The alt text server's Anthropic key is not working. Tell whoever looks after the tool.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError(429, 'busy', 'Claude is busy or the shared key has hit its limit. Wait a minute and try again.');
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new HttpError(400, 'bad_image', 'Claude could not read this image.');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new HttpError(502, 'claude_unreachable', 'The alt text server could not reach Claude. Try again.');
    }
    if (err instanceof Anthropic.APIError) {
      throw new HttpError(502, 'claude_error', `Claude returned an error (${err.status || 'unknown'}).`);
    }
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'declined', 'Claude declined to describe this image.');
  const text = tidy(response.content.filter((block) => block.type === 'text').map((block) => block.text).join(' '));
  if (!text) throw new HttpError(502, 'empty', 'Claude sent back no text for this image.');
  return text;
}

// ---------- The server ----------

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const headers = { vary: 'Origin' };
  if (origin && origin === env.ALLOWED_ORIGIN) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-allow-headers'] = 'authorization, content-type';
    headers['access-control-max-age'] = '86400';
  }
  return headers;
}

function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(request, env) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      if (request.method === 'GET' && url.pathname === '/') return json(request, env, 200, { ok: true, service: 'AH alt text' });
      if (request.method !== 'POST' || url.pathname !== '/alt') throw new HttpError(404, 'not_found', 'Not found.');

      if (!env.ANTHROPIC_API_KEY || !env.GOOGLE_CLIENT_ID || !env.ALLOWED_EMAILS || !env.ALLOWED_ORIGIN) {
        throw new HttpError(503, 'not_set_up', 'The alt text server is not fully set up yet.');
      }
      // Browsers always send Origin on these requests; refusing others keeps casual misuse out. The real gate is the sign-in.
      if (request.headers.get('origin') !== env.ALLOWED_ORIGIN) throw new HttpError(403, 'wrong_site', 'This server only works from the AH Image Resizer.');

      const auth = request.headers.get('authorization') || '';
      const claims = await verifyGoogleToken(auth.replace(/^Bearer\s+/i, ''), env);
      if (!isAllowed(claims.email, env.ALLOWED_EMAILS)) {
        throw new HttpError(403, 'not_allowed', `${claims.email} is not on the list of people who can use this. Ask whoever looks after the tool to add you.`);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        throw new HttpError(400, 'bad_request', 'The request was not understood.');
      }
      const image = typeof body.image === 'string' ? body.image : '';
      if (!image || !/^[A-Za-z0-9+/]+=*$/.test(image)) throw new HttpError(400, 'bad_request', 'No image was sent.');
      if (image.length > MAX_IMAGE_BASE64) throw new HttpError(413, 'too_big', 'That image is too large to describe.');
      const fileName = String(body.fileName || 'image').slice(0, 200);
      const topic = String(body.topic || '').slice(0, 200);

      const alt = await writeAltText(env, { image, fileName, topic });
      return json(request, env, 200, { alt });
    } catch (err) {
      if (err instanceof HttpError) return json(request, env, err.status, { error: err.message, code: err.code });
      console.error(err);
      return json(request, env, 500, { error: 'The alt text server hit a problem. Try again.', code: 'server_error' });
    }
  },
};
