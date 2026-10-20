// The admin page: Google sign-in, a list of devices, a form to add or edit one, and photo upload.
// Saves go to Firestore as pending changes. A GitHub Actions job (.github/workflows/specdeck-deploy.yml)
// picks them up every 10 minutes, writes them into the repo, rebuilds and deploys the site.
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithCredential, signOut, connectAuthEmulator, type User,
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, getDocs, collection, setDoc, deleteDoc, serverTimestamp, connectFirestoreEmulator, type Timestamp,
} from 'firebase/firestore';
import { firebaseConfig } from '../lib/firebase-config';
import { deviceSchema, type Device } from '../lib/schema';
import { slugFor, fullName } from '../lib/names';

const root = document.querySelector<HTMLElement>('[data-admin]');
if (root) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  // Local testing against the Firebase emulators: open /admin/?emulator=you@example.com on localhost.
  const emulatorEmail = location.hostname === 'localhost' ? new URLSearchParams(location.search).get('emulator') : null;
  if (emulatorEmail !== null) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  }

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const form = $<HTMLFormElement>('[data-form]');
  const photoForm = $<HTMLFormElement>('[data-photo-form]');

  type Pending = { json: string; error?: string; updatedAt?: Timestamp; updatedBy?: string };
  type PendingPhoto = { credit: string; error?: string; updatedAt?: Timestamp };
  type Row = { slug: string; live: Device | null; pending: Pending | null; photo: PendingPhoto | null };

  let user: User | null = null;
  let rows: Row[] = [];
  let editing: string | null = null; // slug being edited; null when adding
  let photoSlug = '';
  let photoData: { data: string; mime: string } | null = null;

  function show(view: string) {
    root!.querySelectorAll<HTMLElement>('[data-view]').forEach((el) => (el.hidden = el.dataset.view !== view));
    window.scrollTo({ top: 0 });
  }

  // ---------- Sign-in ----------
  onAuthStateChanged(auth, async (u) => {
    user = u;
    if (!u) return show('signin');
    root.querySelectorAll('[data-email]').forEach((el) => (el.textContent = u.email ?? ''));
    show('loading');
    try {
      await getDoc(doc(db, 'config', 'editors'));
    } catch {
      return show('denied');
    }
    await load();
    show('list');
  });

  // ---------- Loading ----------
  async function load() {
    const [published, pendingSnap, photoSnap, publishSnap] = await Promise.all([
      fetch(`/devices.json?t=${Date.now()}`).then((r) => r.json() as Promise<Device[]>),
      getDocs(collection(db, 'devices')),
      getDocs(collection(db, 'photos')),
      getDoc(doc(db, 'config', 'publish')),
    ]);
    const map = new Map<string, Row>();
    for (const d of published) map.set(d.slug, { slug: d.slug, live: d, pending: null, photo: null });
    pendingSnap.forEach((s) => {
      const row = map.get(s.id) ?? { slug: s.id, live: null, pending: null, photo: null };
      row.pending = s.data() as Pending;
      map.set(s.id, row);
    });
    photoSnap.forEach((s) => {
      const row = map.get(s.id);
      if (row) row.photo = s.data() as PendingPhoto;
    });
    rows = [...map.values()].sort((a, b) => current(b).announced.localeCompare(current(a).announced));

    const waiting = rows.filter((r) => (r.pending && !r.pending.error) || (r.photo && !r.photo.error)).length;
    const pub = publishSnap.data() as { at?: Timestamp; ok?: boolean; message?: string } | undefined;
    const parts: string[] = [];
    if (waiting) parts.push(`${waiting} change${waiting === 1 ? '' : 's'} waiting to publish. The site updates within about 15 minutes.`);
    if (pub?.at) parts.push(`Last publish: ${pub.at.toDate().toLocaleString()}${pub.ok === false ? ` (failed: ${pub.message})` : ''}.`);
    $('[data-publish-status]').textContent = parts.join(' ');
    renderRows();
  }

  /** The newest version of a device: the pending edit if there is one, otherwise what is live. */
  function current(r: Row): Device {
    if (r.pending) {
      try {
        return { ...JSON.parse(r.pending.json), slug: r.slug };
      } catch {}
    }
    return r.live!;
  }

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

  function renderRows() {
    const q = $<HTMLInputElement>('[data-filter]').value.trim().toLowerCase();
    $('[data-rows]').innerHTML = rows
      .filter((r) => !q || fullName(current(r)).toLowerCase().includes(q))
      .map((r) => {
        const d = current(r);
        const status = r.pending?.error
          ? `<span class="pill failed">Not published</span><span class="why">${esc(r.pending.error)}</span>`
          : r.pending
            ? `<span class="pill pending">${r.live ? 'Edit waiting' : 'New, waiting'}</span>`
            : '<span class="pill live">Live</span>';
        const photo = r.photo?.error
          ? `<span class="pill failed">Photo not published</span><span class="why">${esc(r.photo.error)}</span>`
          : r.photo
            ? '<span class="pill pending">Photo waiting</span>'
            : d.image
              ? '<span class="pill live">Has photo</span>'
              : '<span class="pill none">No photo</span>';
        const discard = r.pending || r.photo ? `<button type="button" data-discard="${r.slug}">Discard changes</button>` : '';
        return `<tr>
          <td><span class="dname">${esc(fullName(d))}</span><span class="dmeta">${d.category === 'phone' ? 'Phone' : 'Tablet'} · ${esc(d.announced)}</span></td>
          <td>${status}</td>
          <td>${photo}</td>
          <td class="acts-cell"><div class="acts">
            <button type="button" data-edit="${r.slug}">Edit specs</button>
            <button type="button" data-photo="${r.slug}">${d.image || r.photo ? 'Replace photo' : 'Add photo'}</button>
            ${discard}
          </div></td>
        </tr>`;
      })
      .join('');
  }

  // ---------- Form helpers ----------
  const inputs = () => [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-path]')];

  function getPath(obj: any, path: string) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj: any, path: string, value: unknown) {
    const keys = path.split('.');
    let o = obj;
    keys.slice(0, -1).forEach((k, i) => {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    });
    o[keys.at(-1)!] = value;
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const BLANK = {
    category: 'phone', formFactor: 'bar', status: 'available', art: ['#c9d3d8', '#56636b'],
    price: { currency: 'USD' }, checked: today(), verified: false,
  };

  function fillForm(data: any) {
    for (const el of inputs()) {
      const v = getPath(data, el.dataset.path!);
      switch (el.dataset.type) {
        case 'checkbox':
          (el as HTMLInputElement).checked = !!v;
          break;
        case 'bool':
          el.value = v === true ? 'true' : v === false ? 'false' : '';
          break;
        case 'numbers':
        case 'texts':
          el.value = Array.isArray(v) ? v.join(', ') : '';
          break;
        case 'lines':
          el.value = Array.isArray(v) ? v.join('\n') : '';
          break;
        default:
          el.value = v == null ? '' : String(v);
      }
    }
    clearErrors();
  }

  function readForm(base: any) {
    const data: any = structuredClone(base);
    for (const el of inputs()) {
      const raw = el.value.trim();
      let v: unknown;
      switch (el.dataset.type) {
        case 'checkbox':
          v = (el as HTMLInputElement).checked;
          break;
        case 'bool':
          v = raw === '' ? null : raw === 'true';
          break;
        case 'number':
          v = raw === '' ? null : Number(raw.replace(/,/g, ''));
          break;
        case 'numbers':
          v = raw ? raw.split(/[,\s]+/).filter(Boolean).map(Number) : [];
          break;
        case 'texts':
          v = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
          break;
        case 'lines':
          v = raw ? raw.split(/\n+/).map((s) => s.trim()).filter(Boolean) : [];
          break;
        case 'select':
        case 'color':
          v = raw;
          break;
        default:
          v = raw === '' ? null : raw;
      }
      setPath(data, el.dataset.path!, v);
    }
    // A price needs an amount; without one the whole price is unknown.
    if (data.price?.amount == null || Number.isNaN(data.price.amount)) data.price = null;
    else {
      data.price.currency = (data.price.currency || 'USD').toUpperCase();
      if (!data.price.config) delete data.price.config;
    }
    if (!data.notes) delete data.notes;
    delete data.slug;
    delete data.thumb;
    return data;
  }

  function clearErrors() {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((e) => (e.hidden = true));
    form.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    $('[data-form-errors]').hidden = true;
    $('[data-save-status]').textContent = '';
  }

  function showErrors(list: { path: string; message: string }[]) {
    const labels = new Map(inputs().map((el) => [el.dataset.path!, el.closest('.field')!.querySelector('label')!.textContent!.replace(' *', '')]));
    const general: string[] = [];
    let first: HTMLElement | null = null;
    for (const { path, message } of list) {
      // Errors on a whole group (e.g. "price") attach to its first field.
      const key = [...labels.keys()].find((p) => p === path || p.startsWith(path + '.')) ?? null;
      const slot = key ? form.querySelector<HTMLElement>(`[data-error-for="${key}"]`) : null;
      if (slot) {
        slot.textContent = message;
        slot.hidden = false;
        slot.closest('.field')!.classList.add('invalid');
        first ??= slot.closest('.field');
      }
      general.push(`${key ? labels.get(key) : path || 'Form'}: ${message}`);
    }
    const box = $('[data-form-errors]');
    box.innerHTML = `<strong>Fix ${list.length} thing${list.length === 1 ? '' : 's'} before saving:</strong><ul>${general.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`;
    box.hidden = false;
    (first ?? box).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Turns validation messages into plain words. */
  function plain(message: string) {
    if (/received (null|undefined)/.test(message)) return 'Required';
    if (/received nan/i.test(message)) return 'Enter a number';
    if (/at least 1 element/.test(message)) return 'Add at least one';
    if (/Invalid url/i.test(message)) return 'Enter a full link starting with https://';
    if (/Expected number/.test(message)) return 'Enter a number';
    return message;
  }

  // ---------- Editing ----------
  function openEditor(slug: string | null) {
    editing = slug;
    const row = slug ? rows.find((r) => r.slug === slug)! : null;
    fillForm(row ? current(row) : BLANK);
    $('[data-edit-title]').textContent = row ? `Edit ${fullName(current(row))}` : 'Add a device';
    // The brand and name decide the URL, so they can't change once a device exists.
    for (const p of ['brand', 'name']) form.querySelector<HTMLInputElement>(`[data-path="${p}"]`)!.readOnly = !!row?.live;
    show('edit');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const row = editing ? rows.find((r) => r.slug === editing)! : null;
    const data = readForm(row ? current(row) : BLANK);
    const errors: { path: string; message: string }[] = [];

    const parsed = deviceSchema.safeParse(data);
    if (!parsed.success) errors.push(...parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: plain(i.message) })));
    for (const [path, v] of [['body.weight_g', data.body?.weight_g], ['display.size_in', data.display?.size_in]] as const) {
      if (typeof v === 'number' && Number.isNaN(v)) errors.push({ path, message: 'Enter a number' });
    }
    if (data.memory?.ram_gb?.some(Number.isNaN)) errors.push({ path: 'memory.ram_gb', message: 'Use numbers separated by commas' });
    if (data.memory?.storage_gb?.some(Number.isNaN)) errors.push({ path: 'memory.storage_gb', message: 'Use numbers separated by commas' });

    const slug = editing ?? slugFor(data.brand ?? '', data.name ?? '');
    if (!editing && slug && rows.some((r) => r.slug === slug)) {
      errors.push({ path: 'name', message: `A device with this name already exists (${slug}). Edit it from the list instead.` });
    }
    if (!slug) errors.push({ path: 'name', message: 'Enter a brand and model name' });
    if (errors.length) return showErrors(errors);

    const status = $('[data-save-status]');
    status.textContent = 'Saving…';
    $<HTMLButtonElement>('[data-save]').disabled = true;
    try {
      await setDoc(doc(db, 'devices', slug), {
        json: JSON.stringify(data, null, 2),
        updatedAt: serverTimestamp(),
        updatedBy: user?.email ?? null,
      });
      await load();
      show('list');
    } catch (err) {
      status.textContent = `Couldn't save: ${(err as Error).message}`;
    } finally {
      $<HTMLButtonElement>('[data-save]').disabled = false;
    }
  });

  // ---------- Photos ----------
  /** Shrinks the photo in the browser so it fits in one Firestore document (under 1 MB). */
  async function prepare(file: File): Promise<{ data: string; mime: string; url: string }> {
    const bitmap = await createImageBitmap(file);
    for (const max of [1600, 1280, 1024]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d')!;
      for (const mime of ['image/webp', 'image/jpeg']) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.9, 0.8, 0.7]) {
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));
          if (!blob || blob.type !== mime) break; // this browser can't encode the format
          if (blob.size < 700_000) {
            const url = await new Promise<string>((res) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.readAsDataURL(blob);
            });
            return { data: url.split(',')[1], mime, url };
          }
        }
      }
    }
    throw new Error('This image is too large even after resizing. Try a smaller file.');
  }

  function openPhoto(slug: string) {
    photoSlug = slug;
    photoData = null;
    const row = rows.find((r) => r.slug === slug)!;
    const d = current(row);
    photoForm.reset();
    $<HTMLInputElement>('[data-photo-credit]').value = d.image?.credit ?? d.brand;
    $<HTMLInputElement>('[data-photo-source]').value = d.image?.source ?? '';
    $<HTMLInputElement>('[data-photo-alt]').value = d.image?.alt ?? '';
    $('[data-preview]').innerHTML = d.thumb
      ? `<img src="${d.thumb}" alt="Current photo">`
      : '<span class="muted">No photo chosen</span>';
    $('[data-photo-error]').hidden = true;
    $('[data-photo-status]').textContent = '';
    $('[data-photo-title]').textContent = `Photo for ${fullName(d)}`;
    show('photo');
  }

  $<HTMLInputElement>('[data-photo-file]').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    const err = $('[data-photo-error]');
    err.hidden = true;
    if (!file) return;
    try {
      $('[data-photo-status]').textContent = 'Preparing…';
      const p = await prepare(file);
      photoData = { data: p.data, mime: p.mime };
      $('[data-preview]').innerHTML = `<img src="${p.url}" alt="Preview of the new photo">`;
      $('[data-photo-status]').textContent = '';
    } catch (x) {
      photoData = null;
      err.textContent = (x as Error).message;
      err.hidden = false;
      $('[data-photo-status]').textContent = '';
    }
  });

  photoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('[data-photo-error]');
    const credit = $<HTMLInputElement>('[data-photo-credit]').value.trim();
    const source = $<HTMLInputElement>('[data-photo-source]').value.trim();
    const alt = $<HTMLInputElement>('[data-photo-alt]').value.trim();
    const problem = !photoData
      ? 'Choose an image file.'
      : !credit
        ? 'Enter who owns the photo.'
        : !/^https?:\/\/\S+\.\S+/.test(source)
          ? 'Enter the full link to the page the photo came from.'
          : '';
    if (problem) {
      err.textContent = problem;
      err.hidden = false;
      return;
    }
    $('[data-photo-status]').textContent = 'Saving…';
    try {
      await setDoc(doc(db, 'photos', photoSlug), {
        ...photoData,
        credit,
        source,
        alt: alt || null,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email ?? null,
      });
      await load();
      show('list');
    } catch (x) {
      $('[data-photo-status]').textContent = `Couldn't save: ${(x as Error).message}`;
    }
  });

  // ---------- Buttons ----------
  root.addEventListener('click', async (e) => {
    const t = (e.target as Element).closest<HTMLElement>('button');
    if (!t) return;
    const action = t.dataset.action;
    if (action === 'signin') {
      const err = $('[data-signin-error]');
      err.hidden = true;
      try {
        if (emulatorEmail) {
          // The emulator accepts an unsigned Google ID token, so tests can sign in without a popup.
          const token = JSON.stringify({ sub: emulatorEmail, email: emulatorEmail, email_verified: true });
          await signInWithCredential(auth, GoogleAuthProvider.credential(token));
        } else {
          await signInWithPopup(auth, new GoogleAuthProvider());
        }
      } catch (x) {
        err.textContent = `Sign-in didn't finish: ${(x as Error).message}`;
        err.hidden = false;
      }
    } else if (action === 'signout') await signOut(auth);
    else if (action === 'new') openEditor(null);
    else if (action === 'back') show('list');
    else if (t.dataset.edit) openEditor(t.dataset.edit);
    else if (t.dataset.photo) openPhoto(t.dataset.photo);
    else if (t.dataset.discard) {
      const slug = t.dataset.discard;
      if (t.dataset.confirming !== 'yes') {
        t.dataset.confirming = 'yes';
        t.textContent = 'Click again to discard';
        return;
      }
      await Promise.all([deleteDoc(doc(db, 'devices', slug)), deleteDoc(doc(db, 'photos', slug))]);
      await load();
    }
  });
  $<HTMLInputElement>('[data-filter]').addEventListener('input', renderRows);
}
