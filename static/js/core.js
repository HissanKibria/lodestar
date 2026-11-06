/* Lodestar core: templating, API, router, shell, shared widgets */
'use strict';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = s => new Raw(s);
const val = v => v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : (v == null || v === false) ? '' : esc(v);
const h = (strs, ...vals) => new Raw(strs.reduce((a, s, i) => a + s + (i < vals.length ? val(vals[i]) : ''), ''));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const on = (root, evt, sel, fn) => root.addEventListener(evt, e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
const debounce = (fn, ms) => { let t = null, args; const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); }; d.flush = () => { if (t) { clearTimeout(t); t = null; fn(...args); } }; return d; };
const wordCount = t => (t.trim().match(/\S+/g) || []).length;

const S = { user: null, token: localStorage.getItem('ls_token'), sid: null, students: [], people: {}, unread: {}, cleanup: null };
const routes = {};

/* ------------------------------------------------------------ icons */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  check: 'M5 12l5 5 9-10',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  chat: 'M4 5h16v11H9l-5 4z',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20a7 7 0 0114 0M16 4a3.5 3.5 0 010 7M18 14a7 7 0 014 6',
  book: 'M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  moon: 'M20 14A8 8 0 0110 4a8 8 0 1010 10z',
  logout: 'M9 4H4v16h5M16 8l4 4-4 4M20 12H9',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7 3M3 4v4h4M12 8v5l3 2',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  link: 'M10 14a4 4 0 005.6 0l3-3a4 4 0 00-5.6-5.6l-1 1M14 10a4 4 0 00-5.6 0l-3 3A4 4 0 0011 18.6l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  star: 'M12 3l2.7 6 6.3.6-4.8 4.3 1.4 6.4L12 17l-5.6 3.3 1.4-6.4L3 9.6 9.3 9z',
  msg: 'M21 12a8 8 0 01-11.5 7.2L4 20l1-4.7A8 8 0 1121 12z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
};
const icon = (n, s = 18) => raw(`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`);

/* ------------------------------------------------------------ dates */
const dparse = s => s ? new Date(s.length === 10 ? s + 'T00:00:00' : s) : null;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (s, y = true) => { const d = dparse(s); return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}${y ? ', ' + d.getFullYear() : ''}` : '—'; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysUntil = s => s ? Math.round((dparse(s) - dparse(todayISO())) / 864e5) : null;
const dueLabel = s => { const n = daysUntil(s); if (n == null) return 'No date'; if (n < 0) return `${-n}d overdue`; if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n < 14) return `In ${n} days`; return fmtDate(s, false); };
const relTime = s => { if (!s) return 'never'; const m = (Date.now() - new Date(s).getTime()) / 6e4; if (m < 1) return 'just now'; if (m < 60) return `${Math.floor(m)}m ago`; if (m < 1440) return `${Math.floor(m / 60)}h ago`; if (m < 43200) return `${Math.floor(m / 1440)}d ago`; return fmtDate(s.slice(0, 10)); };
const fmtDT = s => { const d = new Date(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };

/* ------------------------------------------------------------ API */
async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch { }
  if (r.status === 401 && S.user) { signOut(true); throw new Error('Session expired'); }
  if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
  return d;
}
const GET = p => api('GET', p), POST = (p, b) => api('POST', p, b || {}), PUT = (p, b) => api('PUT', p, b || {}), PATCH = (p, b) => api('PATCH', p, b || {}), DEL = p => api('DELETE', p);
const sp = p => `/api/s/${S.sid}${p}`;
const can = (...roles) => roles.includes(S.user.role);

function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3600);
}
const guard = async (fn) => { try { return await fn(); } catch (e) { toast(e.message, 'err'); } };

/* ------------------------------------------------------------ modal */
function modal(title, body, { wide = false, onMount } = {}) {
  const prev = document.activeElement;
  const el = document.createElement('div'); el.className = 'modal-back';
  el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x').s}</button></header><div class="modal-body">${val(body)}</div></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); prev && prev.focus && prev.focus(); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  el.addEventListener('mousedown', e => { if (e.target === el) close(); });
  on(el, 'click', '[data-close]', close);
  el.close = close;
  const f = $('input,textarea,select', el); f && f.focus();
  onMount && onMount(el, close);
  return el;
}
const confirmDlg = (msg, okLabel = 'Delete') => new Promise(res => {
  let done = false;
  const m = modal('Please confirm', h`<p>${msg}</p><div class="row end gap"><button class="btn" data-close>Cancel</button><button class="btn danger" data-ok>${okLabel}</button></div>`);
  on(m, 'click', '[data-ok]', () => { done = true; m.close(); res(true); });
  new MutationObserver(() => { if (!document.body.contains(m) && !done) { done = true; res(false); } }).observe(document.body, { childList: true });
});

/* ------------------------------------------------------------ widgets */
const hue = id => (id * 67 + 200) % 360;
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const avatar = (u, size = 32) => h`<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size * .38}px;background:hsl(${hue(u.id)} 45% 42%)" title="${u.name}">${initials(u.name)}</span>`;
const roleBadge = r => h`<span class="role role-${r}">${r}</span>`;
const pct = f => Math.round((f || 0) * 100);
function ring(f, size = 72, label = true) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, f || 0));
  return raw(`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct(p)} percent"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${label ? `<text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring-t">${pct(p)}%</text>` : ''}</svg>`);
}
const bar = (f, cls = '') => h`<div class="bar ${cls}" role="progressbar" aria-valuenow="${pct(f)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct(f)}%"></i></div>`;
const pageHead = (title, sub, actions) => h`<header class="page-head"><div><h1>${title}</h1>${sub ? h`<p class="sub">${sub}</p>` : ''}</div><div class="row gap">${actions || ''}</div></header>`;
const empty = (title, body, action) => h`<div class="empty"><div class="empty-ic">${icon('star', 28)}</div><h3>${title}</h3><p>${body}</p>${action || ''}</div>`;
const catClass = c => (c || '').toLowerCase();
const catPill = c => h`<span class="pill cat-${catClass(c)}">${c}</span>`;

/* ------------------------------------------------------------ router */
let navSeq = 0;
function go(path) { if (location.hash === '#' + path) render(); else location.hash = path; }
const currentStudent = () => S.students.find(s => s.id === S.sid);
async function render() {
  if (!S.user) return renderLogin();
  const parts = (location.hash.slice(2) || (S.user.role === 'student' ? 'home' : 'caseload')).split('/');
  const name = parts[0], args = parts.slice(1).map(decodeURIComponent);
  if (S.cleanup) { try { S.cleanup(); } catch { } S.cleanup = null; }
  if (!$('#view')) renderShell();
  paintNav(name);
  const old = $('#view'); const view = old.cloneNode(false); old.replaceWith(view); const my = ++navSeq;
  view.innerHTML = '<div class="loading"><span class="spin"></span></div>';
  $('.sidebar').classList.remove('open');
  try {
    const fn = routes[name] || routes.home;
    await fn(view, args, () => my !== navSeq);
    view.focus({ preventScroll: true });
  } catch (e) { if (my === navSeq) view.innerHTML = `<div class="empty"><h3>Something went wrong</h3><p>${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div>`; const rb = $('#retry'); if (rb) rb.onclick = render; }
}
window.addEventListener('hashchange', render);

const NAV = [
  ['home', 'home', 'Home'], ['profile', 'user', 'Common App profile'], ['essays', 'pen', 'Essays'], ['colleges', 'school', 'College list'],
  ['recs', 'mail', 'Recommendations'], ['tasks', 'check', 'Tasks & deadlines'], ['sat', 'chart', 'SAT prep'], ['messages', 'chat', 'Messages'],
];
function renderShell() {
  const u = S.user, staff = u.role !== 'student';
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="sidebar" aria-label="Main navigation">
      <div class="brand"><span class="logo">${icon('star', 16).s}</span><span>Lodestar</span></div>
      ${staff ? `<a class="nav-item" data-nav="caseload" href="#/caseload">${icon('users').s}<span>Caseload</span></a>
      <div class="student-switch"><label for="sw">Working on</label><select id="sw"></select></div>` : `<div class="student-pill" id="stpill"></div>`}
      <nav id="nav">${NAV.map(([k, i, l]) => `<a class="nav-item" data-nav="${k}" href="#/${k}">${icon(i).s}<span>${l}</span><b class="badge" id="b-${k}" hidden></b></a>`).join('')}</nav>
      <div class="side-foot">
        <div class="me">${avatar(u, 34).s}<div><strong>${esc(u.name)}</strong><br>${roleBadge(u.role).s}</div></div>
        <div class="row gap"><button class="icon-btn" id="theme" aria-label="Toggle dark mode">${icon('moon').s}</button><button class="icon-btn" id="pw" aria-label="Change password">${icon('edit').s}</button><button class="icon-btn" id="out" aria-label="Sign out">${icon('logout').s}</button></div>
      </div>
    </aside>
    <div class="main">
      <div class="topbar"><button class="icon-btn" id="burger" aria-label="Menu">${icon('menu').s}</button><strong>Lodestar</strong></div>
      <main id="view" tabindex="-1"></main>
    </div>
  </div>`;
  const sw = $('#sw');
  if (sw) { sw.innerHTML = S.students.map(s => `<option value="${s.id}" ${s.id === S.sid ? 'selected' : ''}>${esc(s.name)}</option>`).join(''); sw.onchange = () => { S.sid = +sw.value; localStorage.setItem('ls_sid', S.sid); loadPeople().then(render); }; }
  if ($('#stpill')) $('#stpill').innerHTML = `<small>Class of ${S.user.grad_year || ''}</small><strong>Your application</strong>`;
  $('#out').onclick = () => signOut();
  $('#burger').onclick = () => $('.sidebar').classList.toggle('open');
  $('#theme').onclick = toggleTheme;
  $('#pw').onclick = passwordDialog;
}
function paintNav(name) {
  $$('.nav-item').forEach(a => { const on = a.dataset.nav === name; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
}
function applyTheme() { document.documentElement.dataset.theme = localStorage.getItem('ls_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function toggleTheme() { localStorage.setItem('ls_theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); }
function passwordDialog() {
  const m = modal('Change password', h`<form class="form"><label>Current password<input type="password" name="old" required autocomplete="current-password"></label><label>New password (8+ characters)<input type="password" name="new" minlength="8" required autocomplete="new-password"></label><div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Update</button></div></form>`);
  $('form', m).onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); guard(async () => { await POST('/api/password', { old: f.get('old'), new: f.get('new') }); toast('Password updated', 'ok'); m.close(); }); };
}

async function loadPeople() { if (S.sid) S.people = (await GET(sp('/people'))).people; }
async function loadCaseload() { S.students = (await GET('/api/caseload')).students; }
async function pollUnread() {
  if (!S.user) return;
  try {
    S.unread = (await GET('/api/unread')).unread;
    const n = S.unread[S.sid] || 0, b = $('#b-messages');
    if (b) { b.hidden = !n; b.textContent = n; }
  } catch { }
}

/* ------------------------------------------------------------ auth */
function renderLogin() {
  $('#app').innerHTML = `
  <div class="login">
    <section class="login-hero">
      <div class="brand big"><span class="logo">${icon('star', 20).s}</span><span>Lodestar</span></div>
      <h1>Every application, <em>one clear path</em>.</h1>
      <p>Counselling workspace for Common App season: profile, essays with real editorial feedback, college list, recommendations, SAT prep and deadlines. Students, editors and counsellors in one place.</p>
      <ul><li>${icon('check').s} Common App sections with real character limits</li><li>${icon('check').s} Comments, suggested edits and version history</li><li>${icon('check').s} Caseload view for counsellors</li></ul>
    </section>
    <section class="login-card">
      <form id="lf" class="form"><h2>Sign in</h2>
        <label>Email<input name="email" type="email" required autocomplete="username" autofocus></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
        <p class="err" id="lerr" role="alert"></p>
        <button class="btn primary block">Sign in</button>
      </form>
      <div class="demo"><p>Demo accounts (password <code>demo1234</code>)</p>
        <div class="row wrap gap">${[['Priya (student)', 'priya@demo.edu'], ['Marcus (student)', 'marcus@demo.edu'], ['Daniel (editor)', 'editor@demo.edu'], ['Dr. Okafor (counsellor)', 'counsellor@demo.edu']].map(([l, e]) => `<button type="button" class="chip" data-email="${e}">${l}</button>`).join('')}</div></div>
    </section>
  </div>`;
  $$('[data-email]').forEach(b => b.onclick = () => { $('[name=email]').value = b.dataset.email; $('[name=password]').value = 'demo1234'; $('#lf').requestSubmit(); });
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target); $('#lerr').textContent = '';
    try {
      const r = await POST('/api/login', { email: f.get('email'), password: f.get('password') });
      S.token = r.token; S.user = r.user; localStorage.setItem('ls_token', r.token);
      await startSession(); location.hash = S.user.role === 'student' ? '#/home' : '#/caseload'; render();
    } catch (err) { $('#lerr').textContent = err.message; }
  };
}
async function startSession() {
  await loadCaseload();
  const saved = +localStorage.getItem('ls_sid');
  S.sid = S.user.role === 'student' ? S.user.id : (S.students.find(s => s.id === saved) ? saved : (S.students[0] || {}).id);
  await loadPeople();
  pollUnread(); clearInterval(S.unreadTimer); S.unreadTimer = setInterval(pollUnread, 6000);
}
function signOut(silent) {
  if (!silent && S.token) api('POST', '/api/logout').catch(() => { });
  S.user = null; S.token = null; localStorage.removeItem('ls_token'); clearInterval(S.unreadTimer); location.hash = ''; renderLogin();
}
async function boot() {
  applyTheme();
  if (S.token) { try { S.user = (await GET('/api/me')).user; await startSession(); } catch { S.user = null; S.token = null; } }
  render();
}
