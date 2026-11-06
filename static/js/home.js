/* Home dashboard + counsellor caseload */
const SEC_LABELS = { profile: 'Profile', family: 'Family', education: 'Education', testing: 'Testing', activities: 'Activities', honors: 'Honors', writing: 'Writing', additional: 'Additional information', courses: 'Courses & grades' };
const SEC_ORDER = ['profile', 'family', 'education', 'testing', 'activities', 'honors', 'writing', 'additional', 'courses'];

routes.home = async (root, args, stale) => {
  if (!S.sid) { root.innerHTML = empty('No students yet', 'Students assigned to you will appear here.').s; return; }
  const d = await GET(sp('/summary')); if (stale()) return;
  const m = d.metrics, st = d.student, mine = S.user.id === st.id;
  const nd = m.next_deadline, dn = nd ? daysUntil(nd.date) : null;
  root.innerHTML = h`
  ${pageHead(mine ? `Welcome back, ${st.name.split(' ')[0]}` : st.name, mine ? 'Here is where your application stands today.' : `Class of ${st.grad_year} · ${m.colleges} colleges · last active ${relTime(m.last_activity)}`,
    can('student', 'counsellor') ? h`<a class="btn" href="#/tasks">${icon('plus')} Add task</a>` : '')}
  ${m.flags.length && !mine ? h`<div class="callout warn">${icon('alert')}<div><strong>Needs attention</strong><ul>${m.flags.map(f => h`<li>${f}</li>`)}</ul></div></div>` : ''}
  <section class="grid stats">
    <div class="card stat"><div class="row gap">${ring(m.overall, 84)}<div><h3>Application readiness</h3><p class="muted">Average across Common App sections</p></div></div></div>
    <div class="card stat"><h3>Next deadline</h3>${nd ? h`<p class="big ${dn <= 7 ? 'danger-t' : ''}">${dn === 0 ? 'Today' : dn + ' days'}</p><p class="muted">${nd.college} · ${nd.round} · ${fmtDate(nd.date)}</p>` : h`<p class="muted">No upcoming deadlines. Add colleges to your list.</p>`}</div>
    <div class="card stat"><h3>Tasks</h3><p class="big">${m.tasks.done}<span class="of">/${m.tasks.total}</span></p><p class="muted ${m.tasks.overdue ? 'danger-t' : ''}">${m.tasks.overdue ? m.tasks.overdue + ' overdue' : 'Nothing overdue'}</p></div>
    <div class="card stat"><h3>SAT</h3><p class="big">${m.sat_best || '—'}<span class="of">${m.sat_target ? ' → ' + m.sat_target : ''}</span></p><p class="muted">${m.sat_best && m.sat_target ? (m.sat_target - m.sat_best > 0 ? m.sat_target - m.sat_best + ' points to goal' : 'Goal reached') : 'Best score vs. target'}</p></div>
  </section>
  <section class="grid two">
    <div class="card"><div class="card-head"><h2>Common App sections</h2><a href="#/profile">Open</a></div>
      <ul class="sec-list">${SEC_ORDER.map(k => { const p = m.progress[k]; return h`<li><a href="#/${k === 'writing' ? 'essays' : 'profile/' + k}"><span class="dot ${p == null ? 'opt' : p >= 1 ? 'done' : p > 0 ? 'part' : ''}"></span><span class="grow">${SEC_LABELS[k]}</span>${p == null ? h`<span class="muted small">Optional</span>` : h`<span class="small muted">${pct(p)}%</span>${bar(p)}`}</a></li>`; })}</ul></div>
    <div class="card"><div class="card-head"><h2>Up next</h2><a href="#/tasks">All tasks</a></div>
      ${d.tasks.length ? h`<ul class="task-mini">${d.tasks.map(t => h`<li><label class="check"><input type="checkbox" data-task="${t.id}"><span></span></label><div class="grow"><div>${t.title}</div><small class="muted">${t.category}</small></div><span class="due ${daysUntil(t.due) < 0 ? 'late' : ''}">${dueLabel(t.due)}</span></li>`)}</ul>` : empty('All caught up', 'No open tasks.')}</div>
    <div class="card"><div class="card-head"><h2>Essays</h2><a href="#/essays">Open workspace</a></div>
      <ul class="rows">${d.essays.map(e => h`<li><a href="#/essay/${e.id}" class="row gap between"><span class="grow">${e.title}</span><small class="muted">${e.words}/${e.word_limit}w</small><span class="pill st-${e.status.replace(/\s/g, '').toLowerCase()}">${e.status}</span></a></li>`)}</ul></div>
    <div class="card"><div class="card-head"><h2>Upcoming deadlines</h2><a href="#/colleges">College list</a></div>
      ${d.deadlines.length ? h`<ul class="rows">${d.deadlines.map(x => h`<li class="row gap between"><span class="grow">${x.name}<br><small class="muted">${x.round} · ${x.status}</small></span>${catPill(x.category)}<span class="due ${daysUntil(x.date) <= 7 ? 'late' : ''}">${fmtDate(x.date, false)}</span></li>`)}</ul>` : empty('No deadlines', 'Add colleges to see dates here.')}</div>
    <div class="card wide"><div class="card-head"><h2>Recent activity</h2></div>
      <ul class="feed">${d.events.map(e => h`<li>${avatar({ id: e.actor_id || 0, name: e.actor || '?' }, 26)}<span><strong>${e.actor || 'Someone'}</strong> ${e.text}<br><small class="muted">${relTime(e.created)}</small></span></li>`)}</ul></div>
  </section>`.s;
  on(root, 'change', '[data-task]', (e, t) => guard(async () => { await PUT(`/api/tasks/${t.dataset.task}`, { done: true }); toast('Task completed', 'ok'); render(); }));
};

routes.caseload = async (root, args, stale) => {
  await loadCaseload(); if (stale()) return;
  const all = S.students;
  const q = { text: '', attn: false, sort: 'name' };
  const tot = {
    n: all.length, avg: all.length ? all.reduce((a, s) => a + s.metrics.overall, 0) / all.length : 0,
    overdue: all.reduce((a, s) => a + s.metrics.tasks.overdue, 0), review: all.reduce((a, s) => a + (s.metrics.essays['In review'] || 0), 0),
    soon: all.filter(s => s.metrics.next_deadline && daysUntil(s.metrics.next_deadline.date) <= 14).length,
  };
  const paint = () => {
    let rows = all.filter(s => s.name.toLowerCase().includes(q.text.toLowerCase()) && (!q.attn || s.metrics.flags.length));
    const key = { name: (a, b) => a.name.localeCompare(b.name), progress: (a, b) => a.metrics.overall - b.metrics.overall, deadline: (a, b) => (a.metrics.next_deadline?.date || '9') .localeCompare(b.metrics.next_deadline?.date || '9'), flags: (a, b) => b.metrics.flags.length - a.metrics.flags.length }[q.sort];
    rows.sort(key);
    $('#cl-body').innerHTML = rows.length ? rows.map(s => { const m = s.metrics, nd = m.next_deadline; const recDone = m.recs.Submitted || 0, recAll = Object.values(m.recs).reduce((a, b) => a + b, 0);
      return h`<tr data-open="${s.id}" tabindex="0" class="${s.id === S.sid ? 'sel' : ''}">
        <td><div class="row gap">${avatar(s, 34)}<div><strong>${s.name}</strong><br><small class="muted">Class of ${s.grad_year} · ${s.team.filter(t => t.role !== 'counsellor').map(t => t.name).join(', ') || 'No editor'}</small></div></div></td>
        <td class="prog"><div class="row gap">${bar(m.overall, m.overall < .5 ? 'low' : '')}<span class="small">${pct(m.overall)}%</span></div></td>
        <td>${m.colleges}<br><small class="muted"><span class="t-reach">${m.categories.Reach}R</span> <span class="t-target">${m.categories.Target}T</span> <span class="t-safety">${m.categories.Safety}S</span></small></td>
        <td>${m.essay_total ? (m.essays.Final || 0) + '/' + m.essay_total + ' final' : '—'}<br><small class="muted">${m.essays['In review'] ? m.essays['In review'] + ' in review' : ''}${m.open_comments ? ' · ' + m.open_comments + ' open comments' : ''}</small></td>
        <td>${m.tasks.done}/${m.tasks.total}<br>${m.tasks.overdue ? h`<small class="danger-t">${m.tasks.overdue} overdue</small>` : h`<small class="muted">on track</small>`}</td>
        <td>${recAll ? recDone + '/' + recAll : '—'}</td>
        <td>${m.sat_best || '—'}<br><small class="muted">${m.sat_target ? 'goal ' + m.sat_target : ''}</small></td>
        <td>${nd ? h`${fmtDate(nd.date, false)}<br><small class="muted">${nd.college.replace('University of ', 'U. ').slice(0, 24)}</small>` : '—'}</td>
        <td>${m.flags.length ? h`<span class="pill warn" title="${m.flags.join('; ')}">${icon('flag', 13)} ${m.flags.length}</span>` : h`<span class="pill ok">Clear</span>`}</td>
        <td><small class="muted">${relTime(m.last_activity)}</small></td></tr>`; }) .map(x => x.s).join('') : `<tr><td colspan="10">${empty('No matching students', 'Try clearing the filters.').s}</td></tr>`;
  };
  root.innerHTML = h`
  ${pageHead('Caseload', `${tot.n} student${tot.n === 1 ? '' : 's'} assigned to you`, S.user.role === 'counsellor' ? h`<button class="btn" id="added">${icon('plus')} Add editor</button><button class="btn primary" id="addst">${icon('plus')} Add student</button>` : '')}
  <section class="grid stats">
    <div class="card stat"><h3>Average readiness</h3><p class="big">${pct(tot.avg)}%</p>${bar(tot.avg)}</div>
    <div class="card stat"><h3>Deadlines within 14 days</h3><p class="big">${tot.soon}</p><p class="muted">students</p></div>
    <div class="card stat"><h3>Essays in review</h3><p class="big">${tot.review}</p><p class="muted">waiting on feedback or revision</p></div>
    <div class="card stat"><h3>Overdue tasks</h3><p class="big ${tot.overdue ? 'danger-t' : ''}">${tot.overdue}</p><p class="muted">across caseload</p></div>
  </section>
  <div class="card flush">
    <div class="toolbar"><input id="cl-q" type="search" placeholder="Search students" aria-label="Search students"><label class="check-inline"><input type="checkbox" id="cl-a"> Needs attention only</label>
      <label>Sort <select id="cl-s"><option value="name">Name</option><option value="progress">Least ready first</option><option value="deadline">Nearest deadline</option><option value="flags">Most flags</option></select></label></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Readiness</th><th>List</th><th>Essays</th><th>Tasks</th><th>Recs</th><th>SAT</th><th>Next due</th><th>Status</th><th>Active</th></tr></thead><tbody id="cl-body"></tbody></table></div>
  </div>`.s;
  paint();
  $('#cl-q').oninput = e => { q.text = e.target.value; paint(); };
  $('#cl-a').onchange = e => { q.attn = e.target.checked; paint(); };
  $('#cl-s').onchange = e => { q.sort = e.target.value; paint(); };
  const open = t => { S.sid = +t.dataset.open; localStorage.setItem('ls_sid', S.sid); loadPeople().then(() => { const sw = $('#sw'); if (sw) sw.value = S.sid; go('/home'); }); };
  on(root, 'click', '[data-open]', (e, t) => open(t));
  on(root, 'keydown', '[data-open]', (e, t) => { if (e.key === 'Enter') open(t); });
  const add = $('#addst');
  if (add) add.onclick = async () => {
    const staff = (await GET('/api/staff')).staff.filter(s => s.role === 'editor');
    const m = modal('Add student', h`<form class="form"><label>Full name<input name="name" required maxlength="100"></label><label>Email<input name="email" type="email" required></label>
      <label>Temporary password (8+ characters)<input name="password" type="text" minlength="8" required></label>
      <div class="two-col"><label>Graduation year<input name="grad_year" type="number" value="2027" min="2024" max="2040"></label>
      <label>Editor<select name="editor_id"><option value="">None yet</option>${staff.map(s => h`<option value="${s.id}">${s.name}</option>`)}</select></label></div>
      <div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Create student</button></div></form>`);
    $('form', m).onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); guard(async () => { await POST('/api/students', f); toast('Student added', 'ok'); m.close(); render(); }); };
  };
};

(() => {
  const prev = routes.caseload;
  routes.caseload = async (root, args, stale) => {
    await prev(root, args, stale);
    const b = $('#added'); if (!b) return;
    b.onclick = () => {
      const m = modal('Add editor', h`<form class="form"><label>Full name<input name="name" required maxlength="100"></label><label>Email<input name="email" type="email" required></label>
        <label>Temporary password (8+ characters)<input name="password" type="text" minlength="8" required></label>
        <fieldset><legend>Assign to students</legend>${S.students.map(s => h`<label class="check-inline"><input type="checkbox" name="sid" value="${s.id}"> ${s.name}</label>`)}</fieldset>
        <div class="row end gap"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Create editor</button></div></form>`);
      $('form', m).onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); const body = { name: fd.get('name'), email: fd.get('email'), password: fd.get('password'), student_ids: fd.getAll('sid').map(Number) }; guard(async () => { await POST('/api/editors', body); toast('Editor added', 'ok'); m.close(); render(); }); };
    };
  };
})();
