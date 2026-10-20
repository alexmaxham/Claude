#!/usr/bin/env node
// Moves changes saved on the admin page (Firestore) into the repo. Run by the SpecAtlas deploy workflow.
//
//   node scripts/admin-sync.mjs check            prints count=<n> (pending changes) for $GITHUB_OUTPUT
//   node scripts/admin-sync.mjs import           writes device JSON and photos, records what it took
//   node scripts/admin-sync.mjs finish ok        deletes the imported changes and records the publish
//   node scripts/admin-sync.mjs finish failed    marks the imported changes with the error instead
//
// Needs ACCESS_TOKEN: a Google access token for a service account with Firestore access.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';

const PROJECT = process.env.FIREBASE_PROJECT ?? 'specdeck-db';
const TOKEN = process.env.ACCESS_TOKEN;
// FIRESTORE_URL points at the local emulator when testing, e.g. http://localhost:8080
const API = `${process.env.FIRESTORE_URL ?? 'https://firestore.googleapis.com'}/v1`;
const BASE = `${API}/projects/${PROJECT}/databases/(default)/documents`;
const STATE = new URL('../.admin-import.json', import.meta.url);
const dataFile = (slug) => new URL(`../src/data/devices/${slug}.json`, import.meta.url);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

if (!TOKEN) {
  console.error('ACCESS_TOKEN is not set.');
  process.exit(1);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.status === 404 ? null : res.json();
}

async function list(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const r = await api('GET', `${BASE}/${collection}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`);
    docs.push(...(r?.documents ?? []));
    pageToken = r?.nextPageToken ?? '';
  } while (pageToken);
  return docs.map((d) => ({
    id: d.name.split('/').pop(),
    name: d.name,
    updateTime: d.updateTime,
    fields: Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, v.stringValue ?? v.nullValue ?? null])),
    hasError: 'error' in (d.fields ?? {}),
  }));
}

const KEY_ORDER = ['name', 'brand', 'category', 'formFactor', 'announced', 'released', 'status', 'markets', 'price', 'art', 'image',
  'body', 'display', 'platform', 'memory', 'camera', 'selfie', 'battery', 'connectivity', 'features', 'sources', 'checked', 'verified', 'notes'];

/** Writes a device file with its keys in the same order as hand-written ones. */
function writeDevice(slug, device) {
  const { slug: _s, thumb: _t, ...rest } = device;
  const ordered = Object.fromEntries([
    ...KEY_ORDER.filter((k) => k in rest).map((k) => [k, rest[k]]),
    ...Object.entries(rest).filter(([k]) => !KEY_ORDER.includes(k)),
  ]);
  writeFileSync(dataFile(slug), JSON.stringify(ordered, null, 2) + '\n');
}

/** Changes that have not been tried yet, or were edited after a failed try. */
const isNew = (d) => !d.hasError;

function output(line) {
  console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line + '\n');
}

const [, , command, result] = process.argv;

if (command === 'check') {
  const pending = [...(await list('devices')), ...(await list('photos'))].filter(isNew);
  output(`count=${pending.length}`);
} else if (command === 'import') {
  const sharp = (await import('sharp')).default;
  const devices = (await list('devices')).filter(isNew);
  const photos = (await list('photos')).filter(isNew);
  const taken = [];
  const failed = [];
  const names = [];

  for (const d of devices) {
    try {
      if (!SLUG.test(d.id)) throw new Error(`"${d.id}" is not a valid file name`);
      const incoming = JSON.parse(d.fields.json);
      // Keep a photo that was published after this edit was started.
      if (!incoming.image && existsSync(dataFile(d.id))) {
        const existing = JSON.parse(readFileSync(dataFile(d.id), 'utf8'));
        if (existing.image) incoming.image = existing.image;
      }
      writeDevice(d.id, incoming);
      taken.push({ name: d.name, updateTime: d.updateTime });
      names.push(`${incoming.brand} ${incoming.name}`);
    } catch (e) {
      failed.push({ name: d.name, error: e.message });
    }
  }

  for (const p of photos) {
    try {
      if (!existsSync(dataFile(p.id))) throw new Error('No device with this name has been published yet');
      const file = `${p.id}.webp`;
      await sharp(Buffer.from(p.fields.data, 'base64'))
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(new URL(`../src/assets/devices/${file}`, import.meta.url).pathname);
      const device = JSON.parse(readFileSync(dataFile(p.id), 'utf8'));
      device.image = { file, ...(p.fields.alt ? { alt: p.fields.alt } : {}), credit: p.fields.credit, source: p.fields.source };
      writeDevice(p.id, device);
      taken.push({ name: p.name, updateTime: p.updateTime });
      names.push(`photo for ${device.brand} ${device.name}`);
    } catch (e) {
      failed.push({ name: p.name, error: e.message });
    }
  }

  // Changes that can't even be written are reported back right away.
  for (const f of failed) await markError(f.name, f.error);
  writeFileSync(STATE, JSON.stringify({ taken, names }, null, 2));
  output(`count=${taken.length}`);
  output(`summary=${names.join(', ').slice(0, 200)}`);
} else if (command === 'finish') {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { taken: [], names: [] };
  const log = process.env.BUILD_LOG && existsSync(process.env.BUILD_LOG) ? readFileSync(process.env.BUILD_LOG, 'utf8') : '';
  // The schema error names the file ("devices → <slug> data does not match") and the fields below it.
  const detail = log.match(/does not match collection schema\.[\s\S]*?(?=\n\s*Error reference|\n\s*Hint|$)/)?.[0]
    .replace(/\*\*/g, '').replace(/\s+/g, ' ').replace('does not match collection schema.', '').trim();
  const message = `The site build rejected this change${detail ? `: ${detail}` : '. See the SpecAtlas deploy run on GitHub.'}`;
  const blamed = state.taken.filter((t) => log.includes(`devices → ${t.name.split('/').pop()} `));

  for (const t of state.taken) {
    if (result === 'ok') {
      // Only clear the change if nobody saved a newer version while this run was building.
      const now = await api('GET', `${API}/${t.name}`);
      if (now && now.updateTime === t.updateTime) await api('DELETE', `${API}/${t.name}`);
      else if (now) console.log(`Kept ${t.name}: it was edited again during this run.`);
    } else if (blamed.length === 0 || blamed.includes(t)) {
      // When the log names the broken device, only that one is marked; the rest go out next run.
      await markError(t.name, message);
    }
  }
  await api('PATCH', `${BASE}/config/publish`, {
    fields: {
      at: { timestampValue: new Date().toISOString() },
      ok: { booleanValue: result === 'ok' },
      message: { stringValue: result === 'ok' ? `Published ${state.names.join(', ') || 'site'}` : message.slice(0, 500) },
    },
  });
  console.log(result === 'ok' ? `Published ${state.taken.length} change(s).` : `Marked ${blamed.length || state.taken.length} change(s) as failed.`);
} else {
  console.error('Usage: admin-sync.mjs check | import | finish ok|failed');
  process.exit(1);
}

async function markError(name, error) {
  await api('PATCH', `${API}/${name}?updateMask.fieldPaths=error`, {
    fields: { error: { stringValue: error.slice(0, 500) } },
  });
}
