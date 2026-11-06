/* Essays: list + collaborative workspace (comments, suggestions, versions) */
const PERSONAL_PROMPTS = [
  'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.',
  'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?',
  'Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?',
  'Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?',
  'Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.',
  'Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?',
  'Share an essay on any topic of your choice. It can be one you\'ve already written, one that responds to a different prompt, or one of your own design.',
];
const ESSAY_STATUS = ['Not started', 'Drafting', 'In review', 'Revising', 'Final'];
const stCls = s => 'st-' + s.replace(/\s/g, '').toLowerCase();

routes.essays = async (root, args, stale) => {
  const [d, c] = await Promise.all([GET(sp('/essays')), GET(sp('/colleges'))]); if (stale()) return;
  const card = e => h`<a class="card essay-card" href="#/essay/${e.id}"><div class="row between"><span class="pill ${stCls(e.status)}">${e.status}</span>${e.open_comments ? h`<span class="pill warn">${icon('msg', 12)} ${e.open_comments}</span>` : ''}</div>
    <h3>${e.title}</h3><p class="muted clamp">${e.prompt || 'No prompt set'}</p>
    <div class="row between"><small class="${e.words > e.word_limit ? 'danger-t' : 'muted'}">${e.words} / ${e.word_limit} words</small>${e.pending ? h`<small class="muted">${e.pending} suggested edit${e.pending > 1 ? 's' : ''}</small>` : ''}</div>${bar(Math.min(1, e.words / e.word_limit), e.words > e.word_limit ? 'low' : '')}</a>`;
  const per = d.essays.filter(e => e.kind === 'personal'), sup = d.essays.filter(e => e.kind !== 'personal');
  const groups = {}; sup.forEach(e => (groups[e.college || 'Other essays'] ||= []).push(e));
  root.innerHTML = h`${pageHead('Essays', 'Your personal essay and every college supplement, in one place.', can('student', 'counsellor') ? h`<button class="btn primary" id="newessay">${icon('plus')} Add supplemental essay</button>` : '')}
    <h2 class="sect">Common App personal essay <small class="muted">250–650 words · sent to every college</small></h2><div class="grid cards">${per.map(card)}</div>
    <h2 class="sect">Supplemental essays <small class="muted">${sup.length} total</small></h2>
    ${sup.length ? Object.entries(groups).map(([k, v]) => h`<h3 class="grp">${k}</h3><div class="grid cards">${v.map(card)}</div>`) : empty('No supplements yet', 'Add one for each college that asks for extra writing.')}`.s;
  const b = $('#newessay');
  if (b) b.onclick = () => {
    const m = modal('Add supplemental essay', h`<form class="form"><label>Title<input name="title" required maxlength="200" placeholder="e.g. Why Tufts?"></label>
      <label>College<select name="college_id"><option value="">Not tied to a college</option>${c.colleges.map(x => h`<option value="${x.id}">${x.name}</option>`)}</select></label>
      <label>Prompt<textarea name="prompt" rows="3" maxlength="2000"></textarea></label><label>Word limit<input name="word_limit" type="number" value="250" min="1" max="5000"></label>
      <div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Create</button></div></form>`);
    $('form', m).onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); guard(async () => { const r = await POST(sp('/essays'), { kind: 'supplemental', ...f }); m.close(); go('/essay/' + r.id); }); };
  };
};

/* ---- word diff */
function diffHtml(a, b) {
  const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean), n = A.length, m = B.length;
  if (n * m > 6e6) return h`<del>${a}</del> <ins>${b}</ins>`;
  const W = m + 1, L = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  let i = 0, j = 0, out = '';
  const flush = (t, s) => s ? (out += `<${t}>${esc(s)}</${t}>`) : 0;
  let dl = '', ins = '';
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { flush('del', dl); flush('ins', ins); dl = ins = ''; out += esc(A[i]); i++; j++; }
    else if (j < m && (i >= n || L[i * W + j + 1] >= L[(i + 1) * W + j])) ins += B[j++];
    else dl += A[i++];
  }
  flush('del', dl); flush('ins', ins);
  return raw(out);
}

function locate(content, quote, start) {
  if (!quote) return null;
  let best = -1, bd = 1e12, i = content.indexOf(quote);
  while (i >= 0) { const d = Math.abs(i - (start || 0)); if (d < bd) { bd = d; best = i; } i = content.indexOf(quote, i + 1); }
  return best < 0 ? null : [best, best + quote.length];
}

routes.essay = async (root, args, stale) => {
  const id = +args[0];
  const load = async () => { const d = await GET(`/api/essays/${id}`); return d; };
  const d0 = await load(); if (stale()) return;
  if (d0.essay.student_id !== S.sid) { S.sid = d0.essay.student_id; localStorage.setItem('ls_sid', S.sid); await loadPeople(); }
  const role = S.user.role, canEdit = role === 'student', canSuggest = role !== 'student', canMeta = role !== 'editor';
  const E = { ...d0, mode: canEdit ? 'write' : 'review', tab: 'feedback', showResolved: false, dirty: false, reply: new Set(), serverContent: d0.essay.content };
  const who = id => S.people[id] || { id, name: 'Former member', role: '' };
  const limit = () => E.essay.word_limit;

  root.innerHTML = h`<div class="essay-page">
    <header class="essay-head">
      <a href="#/essays" class="back">${icon('down', 14)} Essays</a>
      <div class="row between wrap gap"><div><h1 id="e-title"></h1><p class="sub" id="e-sub"></p></div>
        <div class="row gap wrap">
          ${canEdit ? h`<div class="seg" role="tablist"><button data-mode="write" role="tab">${icon('pen', 14)} Write</button><button data-mode="review" role="tab">${icon('eye', 14)} Review</button></div>` : ''}
          <select id="e-status" aria-label="Essay status">${ESSAY_STATUS.map(s => h`<option>${s}</option>`)}</select>
          <button class="btn" id="e-ver">${icon('history', 14)} Save version</button>
          <button class="btn" id="e-dl" title="Download as text">Download</button>
          ${canMeta ? h`<button class="btn" id="e-meta">${icon('edit', 14)} Details</button>` : ''}
        </div></div>
      <details class="prompt" id="e-prompt"><summary>Prompt</summary><div id="e-prompt-body"></div></details>
    </header>
    <div class="essay-grid">
      <section class="doc-col"><div class="doc-bar"><span id="e-wc"></span><span class="save-state" id="ss"></span></div>
        <div id="doc-wrap"></div></section>
      <aside class="fb-panel"><div class="tabs"><button data-tab="feedback">Feedback <b id="fb-n"></b></button><button data-tab="history">History</button></div><div id="fb-body"></div></aside>
    </div>
    <div id="seltool" class="seltool" hidden></div></div>`.s;

  const setHead = () => {
    const e = E.essay;
    $('#e-title').textContent = e.title;
    $('#e-sub').textContent = e.kind === 'personal' ? 'Common App personal essay · 250–650 words' : `Supplemental essay · ${limit()} words`;
    $('#e-status').value = e.status;
    const pb = $('#e-prompt-body');
    if (e.kind === 'personal' && canMeta) {
      pb.innerHTML = `<select id="e-ps" aria-label="Choose a prompt"><option value="">Choose a prompt…</option>${PERSONAL_PROMPTS.map((p, i) => `<option value="${i}" ${p === e.prompt ? 'selected' : ''}>${i + 1}. ${esc(p.slice(0, 90))}…</option>`).join('')}</select><p>${esc(e.prompt || 'No prompt selected yet.')}</p>`;
      $('#e-ps').onchange = ev => { if (ev.target.value === '') return; guard(async () => { const r = await PUT(`/api/essays/${id}`, { prompt: PERSONAL_PROMPTS[+ev.target.value] }); E.essay = r.essay; setHead(); }); };
    } else pb.textContent = e.prompt || 'No prompt set.';
    $('#e-prompt').open = !!e.prompt;
    $$('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === E.mode));
    wc();
  };
  const wc = () => {
    const n = wordCount(E.essay.content), el = $('#e-wc'), max = limit();
    const note = E.essay.kind === 'personal' && n < 250 && n > 0 ? ' · minimum 250' : '';
    el.textContent = `${n} / ${max} words${n > max ? ' (over limit)' : ''}${note}`; el.className = n > max ? 'over' : '';
  };

  const docHtml = () => {
    const c = E.essay.content, items = [];
    E.comments.filter(x => !x.parent_id && x.quote && (!x.resolved || E.showResolved)).forEach(cm => { const r = locate(c, cm.quote, cm.start); if (r) items.push({ t: 'c', id: cm.id, s: r[0], e: r[1], res: cm.resolved }); });
    E.suggestions.filter(x => x.status === 'pending').forEach(sg => { const r = locate(c, sg.original, sg.start); if (r) items.push({ t: 's', id: sg.id, s: r[0], e: r[1], sg }); });
    items.sort((a, b) => a.s - b.s || b.e - a.e);
    let pos = 0, out = '';
    const seg = (s, e, cls, at = '') => `<span class="${cls}" data-s="${s}" ${at}>${esc(c.slice(s, e))}</span>`;
    for (const it of items) {
      if (it.s < pos) continue;
      if (it.s > pos) out += seg(pos, it.s, 't');
      out += it.t === 'c' ? seg(it.s, it.e, 'hl' + (it.res ? ' res' : ''), `data-cid="${it.id}"`) : seg(it.s, it.e, 'sg-del', `data-sid="${it.id}"`) + `<ins class="sg-ins" data-sid="${it.id}">${esc(it.sg.replacement)}</ins>`;
      pos = it.e;
    }
    if (pos < c.length) out += seg(pos, c.length, 't');
    return out;
  };
  const drawDoc = () => {
    const w = $('#doc-wrap');
    if (E.mode === 'write' && canEdit) {
      w.innerHTML = `<textarea id="ta" class="paper" spellcheck="true" placeholder="Start writing here. Your work saves automatically." aria-label="Essay text"></textarea>`;
      const ta = $('#ta'); ta.value = E.essay.content; ta.oninput = () => { E.essay.content = ta.value; E.dirty = true; wc(); ss('Unsaved changes…'); autosave(); };
    } else {
      const hasText = E.essay.content.trim();
      w.innerHTML = `<div id="doc" class="paper review" tabindex="0">${hasText ? docHtml() : `<p class="muted">${canEdit ? 'Nothing written yet. Switch to Write to start.' : 'The student has not written anything yet.'}</p>`}</div>${canEdit || canSuggest ? '<p class="hint">Select any text to leave a comment' + (canSuggest ? ' or suggest an edit' : '') + '.</p>' : ''}`;
    }
  };
  const ss = (t, c = '') => { const e = $('#ss'); if (e) { e.textContent = t; e.className = 'save-state ' + c; } };
  const save = async () => {
    if (!E.dirty) return;
    ss('Saving…');
    try {
      const r = await PUT(`/api/essays/${id}`, { content: E.essay.content, base_updated: E.essay.updated, base_content: E.serverContent });
      E.dirty = false; E.essay.updated = r.essay.updated; E.serverContent = r.essay.content; E.versions = r.versions; E.comments = r.comments; E.suggestions = r.suggestions; ss('Saved', 'ok'); drawFeedback();
    } catch (e) { ss(e.message, 'err'); toast(e.message, 'err'); }
  };
  const autosave = debounce(save, 1200);
  S.cleanup = () => { clearInterval(poll); autosave.flush(); document.removeEventListener('selectionchange', onSel); };

  /* ---- feedback panel */
  const fbItems = () => {
    const c = E.essay.content, items = [];
    E.comments.filter(x => !x.parent_id).forEach(cm => { const r = cm.quote ? locate(c, cm.quote, cm.start) : null; items.push({ t: 'c', cm, pos: r ? r[0] : cm.quote ? 1e9 : -1, orphan: cm.quote && !r }); });
    E.suggestions.forEach(sg => { const r = locate(c, sg.original, sg.start); items.push({ t: 's', sg, pos: r ? r[0] : 1e9, orphan: !r }); });
    items.sort((a, b) => a.pos - b.pos);
    return items;
  };
  const meta = (uid, t) => { const u = who(uid); return h`<div class="fb-meta">${avatar(u, 24)}<strong>${u.name}</strong>${roleBadge(u.role)}<small class="muted">${relTime(t)}</small></div>`; };
  const commentCard = ({ cm, orphan }) => {
    const replies = E.comments.filter(r => r.parent_id === cm.id);
    return h`<article class="fb ${cm.resolved ? 'resolved' : ''}" data-fc="${cm.id}">${meta(cm.author_id, cm.created)}
      ${cm.quote ? h`<blockquote class="${orphan ? 'orphan' : ''}">${cm.quote.length > 140 ? cm.quote.slice(0, 140) + '…' : cm.quote}${orphan ? h`<em> (text has changed)</em>` : ''}</blockquote>` : h`<small class="muted">General comment</small>`}
      <p class="body">${cm.body}</p>
      ${replies.map(r => h`<div class="reply">${meta(r.author_id, r.created)}<p class="body">${r.body}</p>${r.author_id === S.user.id ? h`<button class="link-btn" data-act="delc" data-id="${r.id}">Delete</button>` : ''}</div>`)}
      ${E.reply.has(cm.id) ? h`<form class="reply-form" data-reply="${cm.id}"><textarea rows="2" placeholder="Write a reply" required maxlength="3000"></textarea><div class="row end gap"><button type="button" class="btn small" data-act="cancelreply" data-id="${cm.id}">Cancel</button><button class="btn small primary">Reply</button></div></form>` : ''}
      <div class="fb-actions"><button class="link-btn" data-act="reply" data-id="${cm.id}">Reply</button><button class="link-btn" data-act="${cm.resolved ? 'reopen' : 'resolve'}" data-id="${cm.id}">${cm.resolved ? 'Reopen' : 'Resolve'}</button>${cm.author_id === S.user.id || role === 'counsellor' ? h`<button class="link-btn" data-act="delc" data-id="${cm.id}">Delete</button>` : ''}</div></article>`;
  };
  const sugCard = ({ sg, orphan }) => h`<article class="fb sug ${sg.status !== 'pending' ? 'resolved' : ''}" data-fs="${sg.id}">${meta(sg.author_id, sg.created)}
    <div class="sug-diff"><small class="muted">Suggested edit${sg.status !== 'pending' ? ' · ' + sg.status : ''}</small><p><del>${sg.original}</del>${sg.replacement ? h` <ins>${sg.replacement}</ins>` : h` <em class="muted">(delete)</em>`}</p></div>
    ${sg.note ? h`<p class="body">${sg.note}</p>` : ''}${orphan && sg.status === 'pending' ? h`<small class="warn-t">The original text has changed; this edit can no longer be applied.</small>` : ''}
    ${sg.status === 'pending' ? h`<div class="fb-actions">${canEdit ? h`<button class="btn small primary" data-act="accept" data-id="${sg.id}" ${orphan ? 'disabled' : ''}>Accept</button><button class="btn small" data-act="reject" data-id="${sg.id}">Reject</button>` : ''}${sg.author_id === S.user.id ? h`<button class="link-btn" data-act="withdraw" data-id="${sg.id}">Withdraw</button>` : ''}</div>` : ''}</article>`;
  const drawFeedback = () => {
    const b = $('#fb-body'); if (!b) return;
    $$('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === E.tab));
    const open = E.comments.filter(c => !c.parent_id && !c.resolved).length + E.suggestions.filter(s => s.status === 'pending').length;
    $('#fb-n').textContent = open || '';
    if (E.tab === 'history') {
      b.innerHTML = h`<ul class="versions">${E.versions.map((v, i) => h`<li><button data-ver="${v.id}"><strong>${v.note || 'Version'}</strong><small class="muted">${who(v.author_id).name} · ${fmtDT(v.created)} · ${v.words} words</small></button>${i === 0 ? h`<span class="pill">Latest</span>` : ''}</li>`)}</ul>${E.versions.length ? '' : empty('No versions yet', 'Save a version to keep a snapshot.')}`.s;
      return;
    }
    const items = fbItems().filter(it => E.showResolved || (it.t === 'c' ? !it.cm.resolved : it.sg.status === 'pending'));
    b.innerHTML = h`<form id="gen" class="gen-form"><textarea rows="2" placeholder="Add a general comment" maxlength="3000" required></textarea><button class="btn small primary">Comment</button></form>
      <label class="check-inline small"><input type="checkbox" id="showres" ${E.showResolved ? 'checked' : ''}> Show resolved and closed</label>
      ${items.length ? items.map(it => it.t === 'c' ? commentCard(it) : sugCard(it)) : empty('No open feedback', canSuggest ? 'Select text in the essay to comment or suggest.' : 'Your editor and counsellor feedback will appear here.')}`.s;
    $('#showres').onchange = ev => { E.showResolved = ev.target.checked; drawFeedback(); if (E.mode === 'review') drawDoc(); };
    $('#gen').onsubmit = ev => { ev.preventDefault(); const t = $('textarea', ev.target).value; apply(() => POST(`/api/essays/${id}/comments`, { body: t })); };
  };
  const apply = fn => guard(async () => { await (E.dirty && save()); const r = await fn(); Object.assign(E, { comments: r.comments, suggestions: r.suggestions, versions: r.versions }); if (!E.dirty) { E.essay.content = r.essay.content; E.serverContent = r.essay.content; } E.essay = { ...E.essay, ...r.essay }; setHead(); drawDoc(); drawFeedback(); });

  setHead(); drawDoc(); drawFeedback();

  /* ---- events */
  on(root, 'click', '[data-mode]', async (e, t) => { await save(); E.mode = t.dataset.mode; setHead(); drawDoc(); });
  on(root, 'click', '[data-tab]', (e, t) => { E.tab = t.dataset.tab; drawFeedback(); });
  $('#e-status').onchange = ev => apply(() => PUT(`/api/essays/${id}`, { status: ev.target.value }));
  $('#e-ver').onclick = () => {
    const m = modal('Save a version', h`<form class="form"><label>Note (optional)<input name="note" maxlength="200" placeholder="e.g. After Daniel's feedback"></label><div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save version</button></div></form>`);
    $('form', m).onsubmit = ev => { ev.preventDefault(); const note = new FormData(ev.target).get('note'); m.close(); apply(() => POST(`/api/essays/${id}/versions`, { note })).then(() => toast('Version saved', 'ok')); };
  };
  $('#e-dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([E.essay.title + '\n\n' + E.essay.content], { type: 'text/plain' })); a.download = E.essay.title.replace(/[^\w]+/g, '_') + '.txt'; a.click(); URL.revokeObjectURL(a.href); };
  const md = $('#e-meta');
  if (md) md.onclick = () => {
    const m = modal('Essay details', h`<form class="form"><label>Title<input name="title" required maxlength="200" value="${E.essay.title}"></label><label>Prompt<textarea name="prompt" rows="4" maxlength="2000">${E.essay.prompt}</textarea></label><label>Word limit<input name="word_limit" type="number" min="1" max="5000" value="${E.essay.word_limit}"></label>
      <div class="row between"><button type="button" class="btn danger" id="delE" ${E.essay.kind === 'personal' ? 'hidden' : ''}>Delete essay</button><span class="row gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></span></div></form>`);
    $('form', m).onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); m.close(); apply(() => PUT(`/api/essays/${id}`, f)); };
    $('#delE', m).onclick = async () => { if (await confirmDlg('Delete this essay, its comments and its history?')) guard(async () => { await DEL(`/api/essays/${id}`); toast('Essay deleted'); go('/essays'); }); };
  };
  on(root, 'click', '[data-ver]', (e, t) => guard(async () => {
    const vid = +t.dataset.ver, idx = E.versions.findIndex(v => v.id === vid), v = (await GET(`/api/essays/${id}/versions/${vid}`)).version;
    const prev = E.versions[idx + 1] ? (await GET(`/api/essays/${id}/versions/${E.versions[idx + 1].id}`)).version : null;
    let base = prev ? 'prev' : 'cur';
    const paint = m => { $('#vdiff', m).innerHTML = (base === 'prev' ? diffHtml(prev ? prev.content : '', v.content) : diffHtml(v.content, E.essay.content)).s; };
    const m = modal(`${v.note || 'Version'} · ${fmtDT(v.created)}`, h`<div class="row between wrap gap"><div class="seg">${prev ? h`<button data-base="prev">Changes in this version</button>` : ''}<button data-base="cur">Compare with current</button></div>
      ${canEdit && idx !== 0 ? h`<button class="btn" id="restore">Restore this version</button>` : ''}</div><div class="legend"><ins>added</ins> <del>removed</del></div><div id="vdiff" class="paper diff"></div>`, { wide: true });
    const setBase = b => { base = b; $$('[data-base]', m).forEach(x => x.classList.toggle('on', x.dataset.base === b)); paint(m); }; on(m, 'click', '[data-base]', (ev, x) => setBase(x.dataset.base)); setBase(base);
    const r = $('#restore', m); if (r) r.onclick = async () => { if (await confirmDlg('Replace the current text with this version? The current text is saved as a version first.', 'Restore')) { m.close(); apply(async () => { const res = await POST(`/api/essays/${id}/restore/${vid}`); E.essay.content = res.essay.content; return res; }); } };
  }));
  on(root, 'click', '[data-act]', (e, t) => {
    const act = t.dataset.act, cid = +t.dataset.id;
    if (act === 'reply') { E.reply.add(cid); drawFeedback(); $(`[data-reply="${cid}"] textarea`)?.focus(); }
    else if (act === 'cancelreply') { E.reply.delete(cid); drawFeedback(); }
    else if (act === 'resolve' || act === 'reopen') apply(() => PATCH(`/api/comments/${cid}`, { resolved: act === 'resolve' }));
    else if (act === 'delc') confirmDlg('Delete this comment?').then(ok => ok && apply(() => DEL(`/api/comments/${cid}`)));
    else if (['accept', 'reject', 'withdraw'].includes(act)) apply(() => POST(`/api/suggestions/${cid}/${act}`)).then(() => act === 'accept' && toast('Edit applied. A snapshot of the earlier text was saved.', 'ok'));
  });
  on(root, 'submit', '[data-reply]', (e, t) => { e.preventDefault(); const pid = +t.dataset.reply, body = $('textarea', t).value; E.reply.delete(pid); apply(() => POST(`/api/essays/${id}/comments`, { parent_id: pid, body })); });
  // focus linking between document and cards
  const flash = el => { if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); };
  on(root, 'click', '#doc [data-cid]', (e, t) => { if (getSelection().isCollapsed) { E.tab = 'feedback'; drawFeedback(); flash($(`[data-fc="${t.dataset.cid}"]`)); } });
  on(root, 'click', '#doc [data-sid]', (e, t) => { if (getSelection().isCollapsed) { E.tab = 'feedback'; drawFeedback(); flash($(`[data-fs="${t.dataset.sid}"]`)); } });
  on(root, 'click', '.fb[data-fc]', (e, t) => { if (e.target.closest('button,textarea,form')) return; flash($(`#doc [data-cid="${t.dataset.fc}"]`)); });
  on(root, 'click', '.fb[data-fs]', (e, t) => { if (e.target.closest('button')) return; flash($(`#doc [data-sid="${t.dataset.fs}"]`)); });

  /* ---- selection toolbar */
  const tool = $('#seltool'); let cur = null;
  const selRange = () => {
    const sel = getSelection(); const doc = $('#doc');
    if (!doc || !sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0); if (!doc.contains(r.startContainer) || !doc.contains(r.endContainer)) return null;
    const off = (n, o) => { const el = (n.nodeType === 3 ? n.parentElement : n).closest('[data-s]'); if (!el) return null; return +el.dataset.s + (n.nodeType === 3 ? o : (o > 0 ? el.textContent.length : 0)); };
    const s = off(r.startContainer, r.startOffset), e = off(r.endContainer, r.endOffset);
    if (s == null || e == null || e <= s) return null;
    const quote = E.essay.content.slice(s, e); if (!quote.trim()) return null;
    return { start: s, end: e, quote, rect: r.getBoundingClientRect() };
  };
  const onSel = () => {
    cur = selRange();
    if (!cur) { tool.hidden = true; return; }
    tool.hidden = false; tool.innerHTML = `<button data-sel="comment">${icon('msg', 14).s} Comment</button>${canSuggest ? `<button data-sel="suggest">${icon('edit', 14).s} Suggest edit</button>` : ''}`;
    tool.style.top = Math.max(8, cur.rect.top - 46) + 'px'; tool.style.left = Math.max(8, Math.min(innerWidth - 240, cur.rect.left + cur.rect.width / 2 - 100)) + 'px';
  };
  document.addEventListener('selectionchange', onSel);
  tool.addEventListener('mousedown', e => e.preventDefault());
  on(tool, 'click', '[data-sel]', (e, t) => {
    const s = cur; if (!s) return; tool.hidden = true;
    const q = s.quote.length > 300 ? s.quote.slice(0, 300) + '…' : s.quote;
    if (t.dataset.sel === 'comment') {
      const m = modal('Add comment', h`<form class="form"><blockquote>${q}</blockquote><label>Comment<textarea name="body" rows="4" required maxlength="3000" placeholder="What should the writer know?"></textarea></label><div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Comment</button></div></form>`);
      $('form', m).onsubmit = ev => { ev.preventDefault(); const body = new FormData(ev.target).get('body'); m.close(); apply(() => POST(`/api/essays/${id}/comments`, { body, start: s.start, end: s.end, quote: s.quote })); };
    } else {
      const m = modal('Suggest an edit', h`<form class="form"><label>Replace this text with<textarea name="rep" rows="5" maxlength="5000">${s.quote}</textarea></label><label>Why? (optional)<input name="note" maxlength="500"></label><p class="muted small">The student chooses whether to accept. Leave the box empty to suggest deleting the text.</p><div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Suggest</button></div></form>`);
      $('form', m).onsubmit = ev => { ev.preventDefault(); const f = new FormData(ev.target); if (f.get('rep') === s.quote) return toast('Change the text first', 'err'); m.close(); apply(() => POST(`/api/essays/${id}/suggestions`, { original: s.quote, replacement: f.get('rep'), start: s.start, note: f.get('note') })); };
    }
  });

  /* ---- live collaboration polling */
  const poll = setInterval(async () => {
    if (document.hidden || $('.modal-back')) return;
    const a = document.activeElement; if (a && a.closest && a.closest('.fb-panel') && a.tagName === 'TEXTAREA' && a.value) return;
    try {
      const d = await load(); if (!$('#doc-wrap')) return;
      const sig = x => JSON.stringify([x.comments, x.suggestions, x.versions.length, x.essay.status, x.essay.updated]);
      if (sig(d) === sig(E)) return;
      const contentChanged = d.essay.content !== E.serverContent;
      if (contentChanged && E.dirty) return;
      Object.assign(E, { comments: d.comments, suggestions: d.suggestions, versions: d.versions });
      E.essay = { ...d.essay }; E.serverContent = d.essay.content;
      if (E.mode === 'review' || contentChanged) { const ta = $('#ta'); if (ta && contentChanged) ta.value = E.essay.content; else if (E.mode === 'review') drawDoc(); }
      setHead(); drawFeedback();
    } catch { }
  }, 5000);
};
