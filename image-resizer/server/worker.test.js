// Tests for the alt text server. Run with: npm test
// Google's key list and Anthropic's API are replaced by a local stand-in, so no real accounts are touched.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import worker, { isAllowed } from './worker.js';

const ORIGIN = 'https://resizer.example';
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

let server, env, anthropicRequests = [], anthropicReply;

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
function token(claims = {}, key = privateKey) {
  const body = { iss: 'https://accounts.google.com', aud: CLIENT_ID, email: 'alex@androidheadlines.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, ...claims };
  const signing = `${b64url({ alg: 'RS256', kid: 'k1', typ: 'JWT' })}.${b64url(body)}`;
  return `${signing}.${crypto.sign('RSA-SHA256', Buffer.from(signing), key).toString('base64url')}`;
}
function call({ method = 'POST', path = '/alt', origin = ORIGIN, auth = token(), body = { image: 'AAAA', fileName: 'IMG_1.jpg', topic: 'pixel 11a' } } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (origin) headers.origin = origin;
  if (auth) headers.authorization = `Bearer ${auth}`;
  return worker.fetch(new Request(`https://alt.example${path}`, { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined }), env);
}

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/certs') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=3600' });
      return res.end(JSON.stringify({ keys: [jwk] }));
    }
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      anthropicRequests.push({ url: req.url, headers: req.headers, body: JSON.parse(data) });
      res.writeHead(anthropicReply.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(anthropicReply.body));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  env = { ANTHROPIC_API_KEY: 'sk-ant-shared', ANTHROPIC_BASE_URL: base, GOOGLE_CERTS_URL: `${base}/certs`, GOOGLE_CLIENT_ID: CLIENT_ID, ALLOWED_EMAILS: 'chris@example.com, @androidheadlines.com', ALLOWED_ORIGIN: ORIGIN };
});
after(() => server.close());

const ok = (text) => ({ status: 200, body: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text }] } });

test('writes alt text for an approved, signed-in person', async () => {
  anthropicRequests = []; anthropicReply = ok('"A blue phone on a desk."');
  const res = await call();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { alt: 'A blue phone on a desk.' });
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  const sent = anthropicRequests[0];
  assert.equal(sent.body.model, 'claude-opus-5-5');
  assert.equal(sent.body.fallbacks, 'default');
  assert.equal(sent.body.messages[0].content[0].source.data, 'AAAA');
  assert.match(sent.body.messages[0].content[1].text, /IMG_1\.jpg[\s\S]*pixel 11a/);
  assert.match(sent.headers.authorization || sent.headers['x-api-key'] || '', /sk-ant-shared/);
});

test('refuses people who are not signed in, not approved, or whose sign-in is wrong', async () => {
  anthropicRequests = []; anthropicReply = ok('x');
  const cases = [
    [{ auth: '' }, 401, 'not_signed_in'],
    [{ auth: 'not.a.token' }, 401, 'not_signed_in'],
    [{ auth: token({}, other.privateKey) }, 401, 'not_signed_in'],
    [{ auth: token({ aud: 'someone-else' }) }, 401, 'not_signed_in'],
    [{ auth: token({ iss: 'https://evil.example' }) }, 401, 'not_signed_in'],
    [{ auth: token({ email_verified: false }) }, 401, 'not_signed_in'],
    [{ auth: token({ exp: Math.floor(Date.now() / 1000) - 5 }) }, 401, 'sign_in_expired'],
    [{ auth: token({ email: 'stranger@gmail.com' }) }, 403, 'not_allowed'],
    [{ auth: token({ email: 'x@notandroidheadlines.com.evil.com' }) }, 403, 'not_allowed'],
    [{ origin: 'https://elsewhere.example' }, 403, 'wrong_site'],
    [{ origin: '' }, 403, 'wrong_site'],
    [{ body: { fileName: 'a.jpg' } }, 400, 'bad_request'],
    [{ body: { image: 'A'.repeat(2_000_001) } }, 413, 'too_big'],
    [{ path: '/other' }, 404, 'not_found'],
  ];
  for (const [options, status, code] of cases) {
    const res = await call(options);
    assert.equal(res.status, status, JSON.stringify(options).slice(0, 80));
    assert.equal((await res.json()).code, code);
  }
  assert.equal(anthropicRequests.length, 0, 'Claude must not be called for refused requests');
});

test('explains Claude problems in plain words and never leaks the key', async () => {
  anthropicReply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
  let res = await call();
  let text = await res.text();
  assert.equal(res.status, 502);
  assert.match(text, /server_key_problem/);
  assert.doesNotMatch(text, /sk-ant/);
  anthropicReply = { status: 200, body: { ...ok('').body, stop_reason: 'refusal', content: [] } };
  res = await call();
  assert.equal((await res.json()).code, 'declined');
});

test('answers the browser pre-check only for the resizer address, and reports unfinished setup', async () => {
  let res = await call({ method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  res = await call({ method: 'OPTIONS', origin: 'https://elsewhere.example' });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  res = await worker.fetch(new Request('https://alt.example/alt', { method: 'POST', headers: { origin: ORIGIN }, body: '{}' }), { ...env, ANTHROPIC_API_KEY: '' });
  assert.equal((await res.json()).code, 'not_set_up');
});

test('allow list matches whole addresses and @domain entries only', () => {
  assert.equal(isAllowed('Chris@Example.com', 'chris@example.com'), true);
  assert.equal(isAllowed('a@androidheadlines.com', '@androidheadlines.com'), true);
  assert.equal(isAllowed('a@fakeandroidheadlines.com', '@androidheadlines.com'), false);
  assert.equal(isAllowed('a@example.com', ''), false);
});
