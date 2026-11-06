/* College list, tasks & deadlines, recommendations */
const ROUNDS = ['ED', 'ED II', 'EA', 'REA', 'RD', 'Rolling'];
const COL_STATUS = ['Researching', 'Planned', 'In progress', 'Submitted', 'Admitted', 'Waitlisted', 'Denied', 'Withdrawn'];
const TASK_CATS = ['General', 'Application', 'Essay', 'Profile', 'Testing', 'Recommendations', 'College list', 'Financial aid'];
const REC_STATUS = ['Not asked', 'Requested', 'In progress', 'Submitted', 'Declined'];

function satRange(c, sat) {
  if (!c.sat25) return h`<small class="muted">Test-blind or not reported</small>`;
  const lo = 1000, hi = 1600, p = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  return h`<div class="satbar" title="Middle 50%: ${c.sat25}–${c.sat75}${sat ? '; your score ' + sat : ''}"><i style="left:${p(c.sat25)}%;width:${p(c.sat75) - p(c.sat25)}%"></i>${sat ? h`<b style="left:${p(sat)}%"></b>` : ''}</div><small class="muted">SAT mid-50%: ${c.sat25}–${c.sat75}</small>`;
}

routes.colleges = async (root, args, stale) => {
  const [d, es] = await Promise.all([GET(sp('/colleges')), GET(sp('/essays'))]); if (stale()) return;
  const edit = can('student', 'counsellor'), cols = d.colleges, sat = d.sat;
  const cnt = { Reach: 0, Target: 0, Safety: 0 }; cols.forEach(c => cnt[c.effective_category]++);
  const advice = [];
  if (cols.length < 6) advice.push(`A balanced list usually has 6–12 schools. You have ${cols.length}.`);
  if (cols.length && !cnt.Safety) advice.push('Add at least 1–2 safety schools where you are very likely to be admitted and can afford to attend.');
  if (cnt.Reach > 4) advice.push('That is a lot of reach schools. Consider trimming to 3–4.');
  if (cols.length >= 4 && !cnt.Target) advice.push('Add several target schools where your profile sits in the middle of admitted students.');
  const ranges = { Reach: '2–4', Target: '3–5', Safety: '2–3' };
  const card = c => h`<article class="card col-card" data-col="${c.id}">
    <header><div class="grow"><h3>${c.name}</h3><small class="muted">${[c.city, c.state].filter(Boolean).join(', ')}${c.type ? ' · ' + c.type : ''}${c.accept != null ? ' · ' + c.accept + '% admit' : ''}</small></div>
      ${edit ? h`<button class="icon-btn" data-rm="${c.id}" aria-label="Remove ${c.name}">${icon('trash', 16)}</button>` : ''}</header>
    ${satRange(c, sat)}
    <div class="form two-col compact">
      <label>Round<select data-f="round" ${edit ? '' : 'disabled'}>${ROUNDS.map(r => h`<option ${r === c.round ? 'selected' : ''}>${r}</option>`)}</select></label>
      <label>Deadline<input type="date" data-f="deadline" value="${c.deadline || ''}" ${edit ? '' : 'disabled'}></label>
      <label>Status<select data-f="status" ${edit ? '' : 'disabled'}>${COL_STATUS.map(r => h`<option ${r === c.status ? 'selected' : ''}>${r}</option>`)}</select></label>
      <label>Category<select data-f="category" ${edit ? '' : 'disabled'}><option value="" ${!c.category ? 'selected' : ''}>Auto (${c.auto_category})</option>${['Reach', 'Target', 'Safety'].map(r => h`<option ${r === c.category ? 'selected' : ''}>${r}</option>`)}</select></label></div>
    <label>Notes<textarea data-f="notes" rows="2" maxlength="3000" ${edit ? '' : 'disabled'}>${c.notes}</textarea></label>
    <footer class="row between"><span class="due ${c.deadline && daysUntil(c.deadline) <= 14 && daysUntil(c.deadline) >= 0 && c.status !== 'Submitted' ? 'late' : ''}">${c.deadline ? dueLabel(c.deadline) : 'No deadline'}</span>
      <a href="#/essays" class="small">${es.essays.filter(e => e.college_id === c.id).length} supplemental essay(s)</a></footer></article>`;
  root.innerHTML = h`${pageHead('College list', sat ? `Categories are estimated from your best SAT (${sat}) and each school's admit rate. You can override any of them.` : 'Add test scores to improve the reach / target / safety estimates.', edit ? h`<button class="btn primary" id="addcol">${icon('plus')} Add college</button>` : '')}
    <section class="card balance"><div class="grid three">${['Reach', 'Target', 'Safety'].map(k => h`<div class="bal bal-${k.toLowerCase()}"><strong>${cnt[k]}</strong><span>${k}</span><small class="muted">typical ${ranges[k]}</small></div>`)}</div>
      ${advice.length ? h`<ul class="advice">${advice.map(a => h`<li>${icon('alert', 14)} ${a}</li>`)}</ul>` : cols.length ? h`<p class="ok-t">${icon('check', 14)} Your list looks well balanced.</p>` : ''}</section>
    ${cols.length ? ['Reach', 'Target', 'Safety'].map(k => cols.filter(c => c.effective_category === k).length ? h`<h2 class="sect cat-h-${k.toLowerCase()}">${k} <small class="muted">${cnt[k]}</small></h2><div class="grid cards wide-cards">${cols.filter(c => c.effective_category === k).map(card)}</div>` : '') : empty('Build your college list', 'Search the catalog of Common App colleges and add the ones you are considering.', edit ? h`<button class="btn primary" data-open-add>Add your first college</button>` : '')}
    <p class="muted small foot-note">Admit rates and SAT ranges are approximate figures from public data and change every year. Confirm deadlines and requirements on each college's admissions site.</p>`.s;
  const openAdd = () => {
    const m = modal('Add a college', h`<div class="form"><input type="search" id="cq" placeholder="Search by name, city or state" aria-label="Search colleges"><div id="cres" class="cat-res"></div>
      <details><summary>College not in the catalog?</summary><form id="custom" class="form"><label>Name<input name="name" required maxlength="150"></label><div class="two-col"><label>Round<select name="round">${ROUNDS.map(r => h`<option ${r === 'RD' ? 'selected' : ''}>${r}</option>`)}</select></label><label>Deadline<input type="date" name="deadline"></label></div><button class="btn">Add custom college</button></form></details></div>`, { wide: true });
    const have = new Set(cols.map(c => c.catalog_id));
    const run = async () => {
      const r = (await GET('/api/catalog?q=' + encodeURIComponent($('#cq', m).value))).colleges;
      $('#cres', m).innerHTML = r.map(c => h`<div class="cat-row"><div class="grow"><strong>${c.name}</strong><br><small class="muted">${c.city}, ${c.state} · ${c.type} · ${c.accept}% admit${c.sat25 ? ' · SAT ' + c.sat25 + '–' + c.sat75 : ''}</small></div>
        ${have.has(c.id) ? h`<span class="pill">Added</span>` : h`<button class="btn small" data-add-cat="${c.id}">Add</button>`}</div>`).map(x => x.s).join('') || '<p class="muted">No matches.</p>';
    };
    run(); $('#cq', m).oninput = debounce(run, 200);
    on(m, 'click', '[data-add-cat]', (e, t) => guard(async () => { await POST(sp('/colleges'), { catalog_id: +t.dataset.addCat }); have.add(+t.dataset.addCat); t.replaceWith(Object.assign(document.createElement('span'), { className: 'pill', textContent: 'Added' })); toast('Added. A submission task was created.', 'ok'); m.dirty = true; }));
    $('#custom', m).onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); guard(async () => { await POST(sp('/colleges'), f); m.close(); render(); }); };
    new MutationObserver(() => { if (!document.body.contains(m) && m.dirty) { m.dirty = false; render(); } }).observe(document.body, { childList: true });
  };
  const ab = $('#addcol'); if (ab) ab.onclick = openAdd; const ab2 = $('[data-open-add]'); if (ab2) ab2.onclick = openAdd;
  on(root, 'change', '[data-f]', (e, t) => { const id = t.closest('[data-col]').dataset.col; guard(async () => { await PUT(`/api/colleges/${id}`, { [t.dataset.f]: t.value }); if (['category', 'round', 'deadline', 'status'].includes(t.dataset.f)) render(); else toast('Saved', 'ok'); }); });
  on(root, 'click', '[data-rm]', async (e, t) => { if (await confirmDlg('Remove this college and its open tasks from the list? Essays tied to it are kept.', 'Remove')) guard(async () => { await DEL(`/api/colleges/${t.dataset.rm}`); render(); }); });
};

routes.tasks = async (root, args, stale) => {
  const [d, c] = await Promise.all([GET(sp('/tasks')), GET(sp('/colleges'))]); if (stale()) return;
  const tasks = d.tasks; let filter = 'All', showDone = false;
  const t0 = todayISO(), wk = daysUntil;
  const paint = () => {
    const f = tasks.filter(t => filter === 'All' || t.category === filter);
    const open = f.filter(t => !t.done), done = f.filter(t => t.done);
    const g = { Overdue: open.filter(t => t.due && t.due < t0), 'This week': open.filter(t => t.due && t.due >= t0 && wk(t.due) <= 7), Later: open.filter(t => t.due && wk(t.due) > 7), 'No date': open.filter(t => !t.due) };
    const row = t => h`<li class="task ${t.done ? 'done' : ''}" data-id="${t.id}"><label class="check"><input type="checkbox" data-done ${t.done ? 'checked' : ''} aria-label="Complete ${t.title}"><span></span></label>
      <div class="grow"><button class="link-btn title" data-edit>${t.title}</button><div class="muted small">${t.category}${t.college ? ' · ' + t.college : ''}${t.creator && t.creator !== S.user.name ? ' · added by ' + t.creator : ''}</div></div>
      <span class="due ${!t.done && t.due && t.due < t0 ? 'late' : ''}">${t.due ? (t.done ? fmtDate(t.due, false) : dueLabel(t.due)) : ''}</span><button class="icon-btn" data-del aria-label="Delete task">${icon('trash', 16)}</button></li>`;
    $('#tl').innerHTML = h`${Object.entries(g).map(([k, v]) => v.length ? h`<section class="card tgroup ${k === 'Overdue' ? 'od' : ''}"><h3>${k} <small class="muted">${v.length}</small></h3><ul>${v.map(row)}</ul></section>` : '')}
      ${!open.length ? empty('Nothing to do here', 'No open tasks in this view.') : ''}
      ${done.length ? h`<button class="link-btn" id="sd">${showDone ? 'Hide' : 'Show'} ${done.length} completed</button>${showDone ? h`<section class="card tgroup"><ul>${done.map(row)}</ul></section>` : ''}` : ''}`.s;
    const sd = $('#sd'); if (sd) sd.onclick = () => { showDone = !showDone; paint(); };
    $$('.fchip').forEach(x => x.classList.toggle('on', x.dataset.cat === filter));
  };
  const upcoming = c.colleges.filter(x => x.deadline && x.deadline >= t0 && !['Submitted', 'Admitted', 'Denied', 'Withdrawn', 'Waitlisted'].includes(x.status)).slice(0, 5);
  root.innerHTML = h`${pageHead('Tasks & deadlines', 'Application deadlines create tasks automatically. Add your own for everything else.')}
  ${upcoming.length ? h`<section class="deadline-strip">${upcoming.map(x => h`<div class="dl"><strong>${fmtDate(x.deadline, false)}</strong><span>${x.name.replace('University of ', 'U. of ')}</span><small class="muted">${x.round} · ${dueLabel(x.deadline)}</small></div>`)}</section>` : ''}
  <form id="tf" class="card quick-add"><input name="title" placeholder="Add a task…" required maxlength="200" aria-label="Task title"><input type="date" name="due" aria-label="Due date"><select name="category" aria-label="Category">${TASK_CATS.map(x => h`<option>${x}</option>`)}</select><select name="college_id" aria-label="College"><option value="">Any college</option>${c.colleges.map(x => h`<option value="${x.id}">${x.name}</option>`)}</select><button class="btn primary">Add</button></form>
  <div class="chips">${['All', ...TASK_CATS].map(x => h`<button class="fchip" data-cat="${x}">${x}</button>`)}</div><div id="tl"></div>`.s;
  paint();
  on(root, 'click', '.fchip', (e, t) => { filter = t.dataset.cat; paint(); });
  $('#tf').onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (!f.college_id) delete f.college_id; guard(async () => { await POST(sp('/tasks'), f); render(); }); };
  const tid = t => +t.closest('[data-id]').dataset.id;
  on(root, 'change', '[data-done]', (e, t) => guard(async () => { await PUT(`/api/tasks/${tid(t)}`, { done: t.checked }); const x = tasks.find(z => z.id === tid(t)); x.done = t.checked ? 1 : 0; paint(); }));
  on(root, 'click', '[data-del]', (e, t) => confirmDlg('Delete this task?').then(ok => ok && guard(async () => { await DEL(`/api/tasks/${tid(t)}`); render(); })));
  on(root, 'click', '[data-edit]', (e, t) => {
    const x = tasks.find(z => z.id === tid(t));
    const m = modal('Edit task', h`<form class="form"><label>Title<input name="title" value="${x.title}" required maxlength="200"></label><div class="two-col"><label>Due<input type="date" name="due" value="${x.due || ''}"></label><label>Category<select name="category">${TASK_CATS.map(k => h`<option ${k === x.category ? 'selected' : ''}>${k}</option>`)}</select></label></div><div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`);
    $('form', m).onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); guard(async () => { await PUT(`/api/tasks/${x.id}`, f); m.close(); render(); }); };
  });
};

routes.recs = async (root, args, stale) => {
  const d = await GET(sp('/recs')); if (stale()) return;
  const edit = can('student', 'counsellor'), recs = d.recs;
  const done = recs.filter(r => r.status === 'Submitted').length;
  const form = (r = {}) => h`<form class="form"><label>Name<input name="name" required maxlength="120" value="${r.name || ''}"></label>
    <div class="two-col"><label>Role<select name="kind">${['Counsellor', 'Teacher', 'Coach / Other', 'Employer / Mentor'].map(k => h`<option ${k === r.kind ? 'selected' : ''}>${k}</option>`)}</select></label><label>Subject / relationship<input name="subject" maxlength="120" value="${r.subject || ''}" placeholder="e.g. AP Chemistry"></label>
    <label>Email<input type="email" name="email" maxlength="200" value="${r.email || ''}"></label><label>Status<select name="status">${REC_STATUS.map(k => h`<option ${k === (r.status || 'Not asked') ? 'selected' : ''}>${k}</option>`)}</select></label>
    <label>Requested on<input type="date" name="requested" value="${r.requested || ''}"></label><label>Due<input type="date" name="due" value="${r.due || ''}"></label></div>
    <label>Colleges receiving this letter<input name="colleges" maxlength="500" value="${r.colleges || ''}" placeholder="All, or list schools"></label><label>Notes<textarea name="notes" rows="3" maxlength="2000">${r.notes || ''}</textarea></label>
    <div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`;
  root.innerHTML = h`${pageHead('Recommendations', `${done} of ${recs.length} letters submitted`, edit ? h`<button class="btn primary" id="addrec">${icon('plus')} Add recommender</button>` : '')}
  <section class="callout">${icon('star')}<div><strong>Tips</strong><ul><li>Ask at least four weeks before your earliest deadline, in person if you can.</li><li>Give each recommender a short brag sheet: your activities, goals, and a moment from their class.</li><li>Send a thank-you note after the letter is submitted.</li></ul></div></section>
  ${recs.length ? h`<div class="grid cards">${recs.map(r => { const i = REC_STATUS.indexOf(r.status); const late = r.due && r.status !== 'Submitted' && daysUntil(r.due) < 0;
    return h`<article class="card rec" data-id="${r.id}"><div class="row between"><h3>${r.name}</h3><span class="pill rs-${r.status.replace(/\s/g, '').toLowerCase()}">${r.status}</span></div>
      <p class="muted">${r.kind}${r.subject ? ' · ' + r.subject : ''}</p>
      <ol class="pipe">${REC_STATUS.slice(0, 4).map((s, k) => h`<li class="${k <= i ? 'on' : ''}">${s}</li>`)}</ol>
      <dl class="kv"><dt>Requested</dt><dd>${r.requested ? fmtDate(r.requested) : '—'}</dd><dt>Due</dt><dd class="${late ? 'danger-t' : ''}">${r.due ? fmtDate(r.due) + (late ? ' (late)' : '') : '—'}</dd>${r.colleges ? h`<dt>Schools</dt><dd>${r.colleges}</dd>` : ''}</dl>
      ${r.notes ? h`<p class="small">${r.notes}</p>` : ''}${edit ? h`<div class="row gap"><button class="btn small" data-edit>Edit</button>${r.status === 'Not asked' ? h`<button class="btn small primary" data-ask>Mark as asked</button>` : ''}<button class="icon-btn" data-del aria-label="Remove">${icon('trash', 16)}</button></div>` : ''}</article>`; })}</div>` : empty('No recommenders yet', 'Most colleges want a counsellor letter and one or two teacher letters.')}`.s;
  const ar = $('#addrec');
  if (ar) ar.onclick = () => { const m = modal('Add recommender', form(), { wide: true }); $('form', m).onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); guard(async () => { await POST(sp('/recs'), f); m.close(); render(); }); }; };
  const rid = t => +t.closest('[data-id]').dataset.id;
  on(root, 'click', '[data-edit]', (e, t) => { const r = recs.find(x => x.id === rid(t)); const m = modal('Edit recommender', form(r), { wide: true }); $('form', m).onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); guard(async () => { await PUT(`/api/recs/${r.id}`, f); m.close(); render(); }); }; });
  on(root, 'click', '[data-ask]', (e, t) => guard(async () => { await PUT(`/api/recs/${rid(t)}`, { status: 'Requested' }); render(); }));
  on(root, 'click', '[data-del]', (e, t) => confirmDlg('Remove this recommender?', 'Remove').then(ok => ok && guard(async () => { await DEL(`/api/recs/${rid(t)}`); render(); })));
};
