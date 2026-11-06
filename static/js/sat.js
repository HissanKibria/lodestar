/* SAT prep dashboard */
const SAT_TABS = [['overview', 'Overview'], ['plan', 'Study plan'], ['practice', 'Practice'], ['scores', 'Scores'], ['calendar', 'Calendar'], ['resources', 'Resources']];

function scoreChart(scores, target) {
  if (!scores.length) return h`<p class="muted">Log a score to see your trend.</p>`;
  const W = 640, H = 220, P = { l: 44, r: 16, t: 14, b: 30 };
  const vals = scores.map(s => s.total).concat(target ? [+target] : []);
  const lo = Math.max(400, Math.floor((Math.min(...vals) - 60) / 100) * 100), hi = Math.min(1600, Math.ceil((Math.max(...vals) + 40) / 100) * 100);
  const x = i => P.l + (scores.length === 1 ? (W - P.l - P.r) / 2 : i * (W - P.l - P.r) / (scores.length - 1)), y = v => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  const ticks = []; for (let v = lo; v <= hi; v += 100) ticks.push(v);
  const line = scores.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.total)}`).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="SAT score trend">${ticks.map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="grid-l"/><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('')}
    ${target ? `<line x1="${P.l}" x2="${W - P.r}" y1="${y(+target)}" y2="${y(+target)}" class="tgt"/><text x="${W - P.r}" y="${y(+target) - 6}" text-anchor="end" class="ax tgt-t">Target ${target}</text>` : ''}
    <path d="${line}" class="ln"/>${scores.map((s, i) => `<g><circle cx="${x(i)}" cy="${y(s.total)}" r="${s.kind === 'official' ? 6 : 4}" class="pt ${s.kind}"><title>${esc(s.kind)} ${s.total} on ${esc(s.date)}</title></circle><text x="${x(i)}" y="${y(s.total) - 11}" text-anchor="middle" class="ax">${s.total}</text><text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ax">${fmtDate(s.date, false)}</text></g>`).join('')}</svg>
    <div class="legend"><span><i class="lg official"></i> Official</span><span><i class="lg practice"></i> Practice</span><span><i class="lg t"></i> Target</span></div>`);
}

routes.sat = async (root, args, stale) => {
  const tab = SAT_TABS.some(t => t[0] === args[0]) ? args[0] : 'overview';
  const [st, v, cl] = await Promise.all([GET('/api/sat/static'), GET(sp('/sat')), GET(sp('/colleges'))]); if (stale()) return;
  const edit = can('student', 'counsellor'), isStudent = can('student');
  const plan = st.plans.find(p => p.id === v.plan);
  const keyOf = (w, i) => `${plan.id}:${w}:${i}`;
  const planStats = () => { if (!plan) return { done: 0, total: 0, week: 0 }; let done = 0, total = 0, week = 0; plan.schedule.forEach(w => { let wd = 0; w.items.forEach((_, i) => { total++; if (v.progress[keyOf(w.week, i)]) { done++; wd++; } }); if (!week && wd < w.items.length) week = w.week; }); return { done, total, week: week || plan.weeks }; };
  const saveState = patch => guard(async () => { const r = await PUT(sp('/sat/state'), patch); Object.assign(v, r); });
  const t0 = todayISO(), upcoming = st.dates.filter(d => d.date >= t0);
  const best = v.scores.filter(s => s.kind === 'official').reduce((a, s) => Math.max(a, s.total), 0) || v.scores.reduce((a, s) => Math.max(a, s.total), 0);
  const header = h`${pageHead('SAT prep', 'Plan, practice, track and register, all in one place.')}<nav class="subtabs" aria-label="SAT sections">${SAT_TABS.map(([k, l]) => h`<a href="#/sat/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`)}</nav>`;
  const out = body => { root.innerHTML = h`${header}${body}`.s; };

  if (tab === 'overview') {
    const ps = planStats(), nd = upcoming[0], gap = v.target && best ? +v.target - best : null;
    const wk = plan ? plan.schedule.find(w => w.week === ps.week) : null;
    out(h`<section class="grid stats">
      <div class="card stat"><h3>Best score</h3><p class="big">${best || '—'}</p><p class="muted">${v.scores.length} score${v.scores.length === 1 ? '' : 's'} logged</p></div>
      <div class="card stat"><h3>Target</h3><p class="big">${v.target || '—'}</p><p class="muted">${gap == null ? 'Set a target on the Scores tab' : gap > 0 ? gap + ' points to go' : 'Target reached'}</p></div>
      <div class="card stat"><h3>Next test date</h3><p class="big">${nd ? fmtDate(nd.date, false) : '—'}</p><p class="muted">${nd ? `${daysUntil(nd.date)} days · register by ${fmtDate(nd.register_by, false)}` : 'No upcoming dates'}</p></div>
      <div class="card stat"><h3>Plan progress</h3><p class="big">${plan ? pct(ps.done / ps.total) + '%' : '—'}</p><p class="muted">${plan ? plan.name : 'No plan chosen'}</p></div></section>
    <section class="grid two"><div class="card"><div class="card-head"><h2>Score trend</h2><a href="#/sat/scores">Scores</a></div>${scoreChart(v.scores, v.target)}</div>
      <div class="card"><div class="card-head"><h2>${plan ? `This week: week ${ps.week}` : 'Choose a study plan'}</h2><a href="#/sat/plan">${plan ? 'Full plan' : 'Choose'}</a></div>
        ${wk ? h`<p class="muted">${wk.focus}</p><ul class="check-list">${wk.items.map((it, i) => h`<li class="${v.progress[keyOf(wk.week, i)] ? 'done' : ''}">${v.progress[keyOf(wk.week, i)] ? icon('check', 14) : h`<span class="bullet"></span>`} ${it}</li>`)}</ul>` : empty('No plan yet', 'Pick a 4, 8 or 12-week plan to get weekly checklists.')}</div></section>
    <section class="card"><div class="card-head"><h2>Recent practice sets</h2><a href="#/sat/practice">Practice</a></div>${v.attempts.length ? h`<ul class="rows">${v.attempts.slice(0, 5).map(a => h`<li class="row between"><span>${st.sections[a.section].title}</span><span>${a.correct}/${a.total}</span><small class="muted">${fmtDate(a.date)}</small></li>`)}</ul>` : h`<p class="muted">No practice sets completed yet.</p>`}</section>`);
  }

  if (tab === 'plan') {
    const ps = planStats();
    out(h`<section class="grid three">${st.plans.map(p => h`<article class="card plan ${p.id === v.plan ? 'sel' : ''}"><h3>${p.name}</h3><p class="muted">${p.blurb}</p><p class="small">${p.weeks} weeks · ${p.hours_per_week} hrs/week</p>${edit ? h`<button class="btn ${p.id === v.plan ? '' : 'primary'}" data-plan="${p.id}" ${p.id === v.plan ? 'disabled' : ''}>${p.id === v.plan ? 'Current plan' : 'Use this plan'}</button>` : ''}</article>`)}</section>
    ${plan ? h`<section class="card"><div class="card-head"><h2>${plan.name}</h2><span class="muted">${ps.done}/${ps.total} tasks · ${pct(ps.done / ps.total)}%</span></div>${bar(ps.done / ps.total)}
      <div class="weeks">${plan.schedule.map(w => { const dn = w.items.filter((_, i) => v.progress[keyOf(w.week, i)]).length; return h`<details class="week" ${w.week === ps.week ? 'open' : ''}><summary><strong>Week ${w.week}</strong> <span class="grow">${w.focus}</span><small class="muted">${dn}/${w.items.length}</small></summary><ul class="check-list">${w.items.map((it, i) => h`<li><label class="check-inline"><input type="checkbox" data-pk="${keyOf(w.week, i)}" ${v.progress[keyOf(w.week, i)] ? 'checked' : ''} ${edit ? '' : 'disabled'}> ${it}</label></li>`)}</ul></details>`; })}</div></section>` : ''}`);
    on(root, 'click', '[data-plan]', (e, t) => guard(async () => { await saveState({ plan: t.dataset.plan }); render(); }));
    on(root, 'change', '[data-pk]', (e, t) => { v.progress[t.dataset.pk] = t.checked; if (!t.checked) delete v.progress[t.dataset.pk]; saveState({ progress: v.progress }).then(() => { const s = planStats(); const c = $('.card-head .muted', root); if (c) c.textContent = `${s.done}/${s.total} tasks · ${pct(s.done / s.total)}%`; $('.bar i', root).style.width = pct(s.done / s.total) + '%'; const d = t.closest('details'); $('small', $('summary', d)).textContent = $$('input:checked', d).length + '/' + $$('input', d).length; }); });
  }

  if (tab === 'practice') {
    out(h`<section class="grid two">${Object.entries(st.sections).map(([k, s]) => { const last = v.attempts.find(a => a.section === k); return h`<article class="card"><h3>${s.title}</h3><p class="muted">${s.questions.length} original questions · suggested time ${s.minutes} minutes</p><p class="small">${last ? `Last attempt: ${last.correct}/${last.total} on ${fmtDate(last.date)}` : 'Not attempted yet'}</p>${isStudent ? h`<button class="btn primary" data-start="${k}">Start section</button>` : h`<p class="muted small">Students take practice sets from their own account.</p>`}</article>`; })}</section>
      <p class="muted small">These short sets are for warming up. For full-length adaptive tests with official scoring, use Bluebook (see Resources).</p><div id="quiz"></div>`);
    on(root, 'click', '[data-start]', (e, t) => {
      const k = t.dataset.start, s = st.sections[k]; let left = s.minutes * 60, timer;
      const q = $('#quiz');
      q.innerHTML = h`<form class="card quiz" id="qf"><div class="row between"><h2>${s.title}</h2><span class="timer" id="tm" role="timer"></span></div>
        ${s.questions.map((x, n) => h`<fieldset class="q"><legend><span class="qn">${n + 1}</span> <small class="muted">${x.skill}</small></legend><p>${x.text}</p>${x.type === 'free' ? h`<input name="${x.id}" inputmode="decimal" autocomplete="off" aria-label="Answer">` : h`<div class="choices">${x.choices.map((c, i) => h`<label class="choice"><input type="radio" name="${x.id}" value="${i}"><span class="ltr">${'ABCD'[i]}</span><span>${c}</span></label>`)}</div>`}</fieldset>`)}
        <div class="row end gap"><button type="button" class="btn" id="qc">Cancel</button><button class="btn primary">Submit answers</button></div></form>`.s;
      q.scrollIntoView({ behavior: 'smooth' });
      const tick = () => { const m = Math.floor(left / 60), sec = String(left % 60).padStart(2, '0'); const tm = $('#tm'); if (!tm) return clearInterval(timer); tm.textContent = `${m}:${sec}`; tm.classList.toggle('low', left < 60); if (left-- <= 0) { clearInterval(timer); toast("Time's up. Submitting.", ''); $('#qf').requestSubmit(); } };
      tick(); timer = setInterval(tick, 1000); S.cleanup = () => clearInterval(timer);
      $('#qc').onclick = () => { clearInterval(timer); q.innerHTML = ''; };
      $('#qf').onsubmit = ev => { ev.preventDefault(); clearInterval(timer); const f = new FormData(ev.target), ans = {}; s.questions.forEach(x => { if (f.get(x.id) != null && f.get(x.id) !== '') ans[x.id] = f.get(x.id); });
        guard(async () => { const r = await POST(sp('/sat/practice'), { section: k, answers: ans });
          q.innerHTML = h`<section class="card quiz"><h2>${r.correct} of ${r.total} correct</h2>${bar(r.correct / r.total)}${s.questions.map((x, n) => { const rv = r.review[n]; return h`<div class="q ${rv.ok ? 'ok' : 'bad'}"><p><span class="qn">${n + 1}</span> ${x.text}</p><p class="small">${rv.ok ? icon('check', 14) : icon('x', 14)} Your answer: <strong>${rv.given == null ? 'blank' : (x.type === 'free' ? rv.given : x.choices[+rv.given])}</strong>${rv.ok ? '' : h` · Correct: <strong>${rv.right}</strong>`}</p><p class="muted small">${rv.why}</p></div>`; })}<div class="row end gap"><button class="btn" id="again">Close</button><a class="btn primary" href="#/sat/scores">Log a score</a></div></section>`.s;
          $('#again').onclick = () => render(); }); };
    });
  }

  if (tab === 'scores') {
    out(h`<section class="grid two"><div class="card"><div class="card-head"><h2>Trend</h2>${edit ? h`<form id="tg" class="row gap"><label class="small">Target <input type="number" name="target" min="400" max="1600" step="10" value="${v.target || ''}" style="width:90px"></label><button class="btn small">Set</button></form>` : ''}</div>${scoreChart(v.scores, v.target)}</div>
      ${edit ? h`<div class="card"><h2>Log a score</h2><form id="sf" class="form two-col"><label>Type<select name="kind"><option value="practice">Practice test</option><option value="official">Official SAT</option></select></label><label>Date<input type="date" name="date" value="${t0}" required></label>
        <label>Reading & Writing (200–800)<input type="number" name="rw" min="200" max="800" step="10" required></label><label>Math (200–800)<input type="number" name="math" min="200" max="800" step="10" required></label><label class="span2">Note<input name="note" maxlength="300" placeholder="e.g. Bluebook Test 4"></label><div class="span2"><button class="btn primary">Add score</button></div></form></div>` : ''}</section>
      <section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>R&W</th><th>Math</th><th>Total</th><th>Note</th><th></th></tr></thead><tbody>${v.scores.slice().reverse().map(s => h`<tr><td>${fmtDate(s.date)}</td><td><span class="pill ${s.kind === 'official' ? 'ok' : ''}">${s.kind}</span></td><td>${s.rw}</td><td>${s.math}</td><td><strong>${s.total}</strong></td><td class="muted">${s.note}</td><td>${edit ? h`<button class="icon-btn" data-ds="${s.id}" aria-label="Delete score">${icon('trash', 16)}</button>` : ''}</td></tr>`)}</tbody></table></div>${v.scores.length ? '' : empty('No scores yet', 'Add your first practice or official score.')}</section>`);
    const tg = $('#tg'); if (tg) tg.onsubmit = e => { e.preventDefault(); saveState({ target: new FormData(tg).get('target') }).then(render); };
    const sf = $('#sf'); if (sf) sf.onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(sf)); guard(async () => { await POST(sp('/sat/scores'), f); toast('Score added', 'ok'); render(); }); };
    on(root, 'click', '[data-ds]', (e, t) => confirmDlg('Delete this score?').then(ok => ok && guard(async () => { await DEL(`/api/sat/scores/${t.dataset.ds}`); render(); })));
  }

  if (tab === 'calendar') {
    let ym = (() => { const n = new Date(); return [n.getFullYear(), n.getMonth()]; })();
    const evs = {}; const add = (d, e) => (evs[d] ||= []).push(e);
    st.dates.forEach(d => { add(d.date, { t: 'sat', l: 'SAT' }); add(d.register_by, { t: 'reg', l: 'SAT registration' }); });
    cl.colleges.forEach(c => c.deadline && add(c.deadline, { t: 'app', l: `${c.name.replace('University of ', 'U. of ')} (${c.round})` }));
    if (v.test_date) add(v.test_date, { t: 'mine', l: 'Your planned test' });
    const draw = () => {
      const [y, m] = ym, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), off = first.getDay(); const cells = [];
      for (let i = 0; i < off; i++) cells.push('<div class="cell empty"></div>');
      for (let d = 1; d <= days; d++) { const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; cells.push(`<div class="cell ${iso === t0 ? 'today' : ''}"><span class="dn">${d}</span>${(evs[iso] || []).map(e => `<span class="ev ev-${e.t}" title="${esc(e.l)}">${esc(e.l)}</span>`).join('')}</div>`); }
      $('#cal').innerHTML = `<div class="row between"><button class="icon-btn" id="pm" aria-label="Previous month">${icon('up').s.replace('M12 19V5M6 11l6-6 6 6', 'M15 5l-7 7 7 7')}</button><h2>${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m]} ${y}</h2><button class="icon-btn" id="nm" aria-label="Next month">${icon('up').s.replace('M12 19V5M6 11l6-6 6 6', 'M9 5l7 7-7 7')}</button></div><div class="cal-grid">${'Sun Mon Tue Wed Thu Fri Sat'.split(' ').map(x => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div>`;
      $('#pm').onclick = () => { ym = m === 0 ? [y - 1, 11] : [y, m - 1]; draw(); }; $('#nm').onclick = () => { ym = m === 11 ? [y + 1, 0] : [y, m + 1]; draw(); };
    };
    out(h`<section class="grid two cal-wrap"><div class="card" id="cal"></div><div class="card"><h2>Test dates</h2><p class="muted small">Typical digital SAT dates for 2026–27. Always confirm on collegeboard.org before registering.</p>
      <ul class="rows">${upcoming.map(d => h`<li class="row between wrap gap"><div><strong>${fmtDate(d.date)}</strong><br><small class="muted">Register by ${fmtDate(d.register_by)} (${daysUntil(d.register_by) < 0 ? 'passed' : daysUntil(d.register_by) + ' days'})</small></div>${edit ? h`<button class="btn small ${v.test_date === d.date ? '' : 'primary'}" data-plan-date="${v.test_date === d.date ? '' : d.date}">${v.test_date === d.date ? 'Planned ✓' : 'Plan to take'}</button>` : ''}</li>`)}</ul>
      <div class="legend stack"><span><i class="lg sat"></i> SAT</span><span><i class="lg reg"></i> Registration</span><span><i class="lg app"></i> College deadline</span><span><i class="lg mine"></i> Your plan</span></div></div></section>`);
    draw();
    on(root, 'click', '[data-plan-date]', (e, t) => saveState({ test_date: t.dataset.planDate }).then(render));
  }

  if (tab === 'resources') {
    const groups = {}; st.resources.forEach(r => (groups[r.group] ||= []).push(r));
    out(h`${Object.entries(groups).map(([g, rs]) => h`<h2 class="sect">${g}</h2><div class="grid cards">${rs.map(r => h`<a class="card res" href="${r.url}" target="_blank" rel="noopener noreferrer"><div class="row between"><h3>${r.title}</h3>${icon('link', 16)}</div><p class="muted">${r.desc}</p><small class="muted">${r.url.replace(/^https?:\/\//, '').split('/')[0]}</small></a>`)}</div>`)}`);
  }
};
