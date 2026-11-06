/* Common App profile sections (schema-driven forms with autosave) */
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const EDU = ['Less than high school', 'High school', 'Some college', 'Associate degree', "Bachelor's degree", 'Graduate degree', 'Unknown'];
const ACT_TYPES = ['Academic', 'Art', 'Athletics: Club', 'Athletics: JV/Varsity', 'Career-Oriented', 'Community Service (Volunteer)', 'Computer/Technology', 'Cultural', 'Dance', 'Debate/Speech', 'Environmental', 'Family Responsibilities', 'Foreign Exchange', 'Journalism/Publication', 'Junior R.O.T.C.', 'LGBT', 'Music: Instrumental', 'Music: Vocal', 'Religious', 'Research', 'Robotics', 'School Spirit', 'Science/Math', 'Social Justice', 'Student Govt./Politics', 'Theater/Drama', 'Work (Paid)', 'Other Club/Activity'];
const GRADES = ['9', '10', '11', '12', 'PG'];
const LEVELS = ['School', 'State/Regional', 'National', 'International'];
const COURSE_LEVELS = ['Standard', 'Honors', 'AP', 'IB', 'Dual enrollment', 'Other'];
const LETTERS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP'];
const POINTS = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': .7, F: 0 };

const T = (k, label, o = {}) => ({ k, label, type: 'text', ...o });
const SEL = (k, label, opts, o = {}) => ({ k, label, type: 'select', opts, ...o });
const SCHEMA = {
  profile: {
    title: 'Profile', intro: 'Basic details as they should appear on your Common App.', groups: [
      { title: 'Name', cols: 2, fields: [T('first', 'Legal first name', { req: 1, max: 60 }), T('middle', 'Middle name', { max: 60 }), T('last', 'Legal last name', { req: 1, max: 60 }), T('suffix', 'Suffix', { max: 10 }), T('preferred', 'Preferred name', { max: 60 }), T('pronouns', 'Pronouns', { max: 30 })] },
      { title: 'About you', cols: 2, fields: [{ k: 'birthdate', label: 'Date of birth', type: 'date', req: 1 }, SEL('sex', 'Sex', ['Female', 'Male', 'Non-binary', 'Prefer not to say']), T('email', 'Email', { type: 'email', req: 1 }), T('phone', 'Phone', { type: 'tel', req: 1 })] },
      { title: 'Address', cols: 2, fields: [T('address1', 'Street address', { req: 1, wide: 1 }), T('address2', 'Apt / unit', { wide: 1 }), T('city', 'City', { req: 1 }), SEL('state', 'State', STATES, { req: 1 }), T('zip', 'ZIP code', { req: 1 }), T('country', 'Country', { req: 1 })] },
      { title: 'Citizenship & language', cols: 2, fields: [SEL('citizenship', 'Citizenship status', ['U.S. citizen', 'U.S. permanent resident', 'Citizen of another country', 'Other'], { req: 1 }), T('languages', 'Languages spoken'), SEL('hispanic', 'Hispanic or Latino?', ['Yes', 'No', 'Prefer not to say']), SEL('race', 'Race (optional)', ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Native Hawaiian or Pacific Islander', 'White', 'Two or more races', 'Prefer not to say']), { k: 'fee_waiver', label: 'I qualify for a Common App fee waiver', type: 'checkbox', wide: 1 }] },
    ]
  },
  family: {
    title: 'Family', intro: 'Household, parents or guardians, and siblings.', groups: [
      { title: 'Household', cols: 2, fields: [SEL('household', 'Parents’ marital status', ['Parents live together', 'Parents are divorced or separated', 'One parent is deceased', 'Both parents are deceased', 'Legal guardian'], { req: 1 }), SEL('first_gen', 'First in family to attend college?', ['Yes', 'No', 'Unsure'])] },
      { title: 'Parent / guardian 1', cols: 2, fields: [SEL('p1_relation', 'Relationship', ['Mother', 'Father', 'Guardian', 'Stepparent', 'Other']), SEL('p1_living', 'Living?', ['Living', 'Deceased']), T('p1_name', 'Full name', { req: 1 }), T('p1_occupation', 'Occupation', { req: 1 }), SEL('p1_education', 'Highest education', EDU, { req: 1 })] },
      { title: 'Parent / guardian 2 (if applicable)', cols: 2, fields: [SEL('p2_relation', 'Relationship', ['Mother', 'Father', 'Guardian', 'Stepparent', 'Other']), SEL('p2_living', 'Living?', ['Living', 'Deceased']), T('p2_name', 'Full name'), T('p2_occupation', 'Occupation'), SEL('p2_education', 'Highest education', EDU)] },
      { title: 'Siblings', cols: 1, fields: [T('siblings_count', 'Number of siblings', { type: 'number', min: 0, max: 20, req: 1 })], list: { key: 'siblings', label: 'sibling', max: 10, cols: [T('name', 'Name'), T('age', 'Age', { type: 'number', min: 0, max: 99 }), T('education', 'Education level')] } },
    ]
  },
  education: {
    title: 'Education', intro: 'Your current school, academic summary and counsellor.', groups: [
      { title: 'Current school', cols: 2, fields: [T('school_name', 'School name', { req: 1, wide: 1 }), T('school_city', 'City', { req: 1 }), SEL('school_state', 'State', STATES, { req: 1 }), SEL('school_type', 'School type', ['Public, non-charter', 'Public, charter', 'Public, magnet', 'Private', 'Religious', 'Home school']), { k: 'entry_date', label: 'Entry date (YYYY-MM)', type: 'text', max: 7 }, { k: 'grad_date', label: 'Graduation date (YYYY-MM)', type: 'text', max: 7, req: 1 }, T('class_size', 'Graduating class size', { type: 'number', min: 1 })] },
      { title: 'Academics', cols: 2, fields: [SEL('rank_type', 'Class rank reporting', ['None', 'Exact', 'Decile', 'Quintile', 'Quartile', 'Other'], { req: 1 }), T('rank', 'Class rank'), T('gpa', 'GPA', { type: 'number', step: '0.01', min: 0, req: 1 }), T('gpa_scale', 'GPA scale', { type: 'number', step: '0.1', min: 1, req: 1 }), SEL('gpa_weighted', 'GPA weighting', ['Weighted', 'Unweighted', 'Both / unsure']), T('intended_major', 'Intended major or area of study', { wide: 1 })] },
      { title: 'School counsellor', cols: 2, fields: [T('counselor_name', 'Name', { req: 1 }), T('counselor_email', 'Email', { type: 'email', req: 1 }), T('counselor_phone', 'Phone', { type: 'tel' })] },
    ]
  },
  testing: {
    title: 'Testing', intro: 'Self-reported scores. Official reports are sent from the testing agency.', groups: [
      { title: 'Testing plan', cols: 1, fields: [SEL('test_plan', 'How will you use test scores?', ['Submit scores where they help', 'Submit scores to all schools', 'Test-optional: will not submit', 'Not yet decided'], { req: 1 })] },
      { title: 'SAT', cols: 2, fields: [{ k: 'sat_date', label: 'Date taken', type: 'date' }, T('sat_ebrw', 'Evidence-based reading & writing (200–800)', { type: 'number', min: 200, max: 800, step: 10 }), T('sat_math', 'Math (200–800)', { type: 'number', min: 200, max: 800, step: 10 }), T('sat_total', 'Total (auto)', { type: 'number', readonly: 1 })] },
      { title: 'ACT', cols: 2, fields: [{ k: 'act_date', label: 'Date taken', type: 'date' }, T('act_composite', 'Composite (1–36)', { type: 'number', min: 1, max: 36 }), T('act_english', 'English', { type: 'number', min: 1, max: 36 }), T('act_math', 'Math', { type: 'number', min: 1, max: 36 }), T('act_reading', 'Reading', { type: 'number', min: 1, max: 36 }), T('act_science', 'Science', { type: 'number', min: 1, max: 36 })] },
      { title: 'AP, IB and other exams', cols: 1, fields: [], list: { key: 'ap', label: 'exam', max: 30, cols: [T('subject', 'Exam'), T('year', 'Year', { type: 'number', min: 2018, max: 2030 }), T('score', 'Score')] } },
    ]
  },
};
const SECTION_ROUTES = ['profile', 'family', 'education', 'testing', 'activities', 'honors', 'writing', 'additional', 'courses'];

function inputHtml(f, v, ctx, ro) {
  const attr = ctx ? `data-list="${ctx.list}" data-i="${ctx.i}" data-c="${f.k}"` : `data-k="${f.k}"`;
  const dis = ro ? 'disabled' : '';
  const id = ctx ? '' : `id="f_${f.k}"`;
  if (f.type === 'select') return raw(`<select ${attr} ${id} ${dis}><option value="">Select…</option>${f.opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`);
  if (f.type === 'checkbox') return raw(`<input type="checkbox" ${attr} ${id} ${v ? 'checked' : ''} ${dis}>`);
  if (f.type === 'textarea') return raw(`<textarea ${attr} ${id} rows="${f.rows || 3}" ${f.max ? `maxlength="${f.max}"` : ''} ${dis}>${esc(v)}</textarea>`);
  const extra = ['min', 'max', 'step'].filter(a => f[a] != null && f.type === 'number').map(a => `${a}="${f[a]}"`).join(' ');
  const ml = f.max && f.type !== 'number' ? `maxlength="${f.max}"` : '';
  return raw(`<input type="${f.type}" ${attr} ${id} value="${esc(v)}" ${extra} ${ml} ${f.readonly ? 'readonly' : ''} ${dis}>`);
}
function fieldHtml(f, v, ctx, ro) {
  const count = f.max && f.type !== 'number' && f.type !== 'date' ? h`<small class="count">${String(v || '').length}/${f.max}</small>` : '';
  if (f.type === 'checkbox') return h`<label class="check-inline ${f.wide ? 'span2' : ''}">${inputHtml(f, v, ctx, ro)} ${f.label}</label>`;
  return h`<label class="${f.wide ? 'span2' : ''}"><span class="lbl">${f.label}${f.req ? h`<i class="req" title="Required">*</i>` : ''}${count}</span>${inputHtml(f, v, ctx, ro)}</label>`;
}
function listHtml(L, items, ro) {
  return h`<div class="sublist" data-listwrap="${L.key}">${items.map((it, i) => h`<div class="sub-row">${L.cols.map(c => fieldHtml(c, it[c.k], { list: L.key, i }, ro))}${ro ? '' : h`<button class="icon-btn" data-del="${L.key}" data-i="${i}" aria-label="Remove ${L.label}">${icon('trash')}</button>`}</div>`)}
    ${ro || items.length >= L.max ? '' : h`<button class="btn small" data-add="${L.key}">${icon('plus', 14)} Add ${L.label}</button>`}</div>`;
}

function activityCard(a, i, n, ro) {
  const F = { type: SEL('type', 'Activity type', ACT_TYPES), pos: T('position', 'Position / leadership description', { max: 50 }), org: T('org', 'Organization name', { max: 100 }), desc: { k: 'desc', label: 'Description (what you accomplished, recognition earned)', type: 'textarea', max: 150, rows: 3 } };
  const ctx = { list: 'items', i };
  return h`<article class="slot card" data-slot="${i}">
    <header><span class="slot-n">${i + 1}</span><strong class="grow">${a.org || a.type || 'New activity'}</strong>
      ${ro ? '' : h`<button class="icon-btn" data-move="-1" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('up', 16)}</button><button class="icon-btn" data-move="1" data-i="${i}" aria-label="Move down" ${i === n - 1 ? 'disabled' : ''}>${icon('down', 16)}</button><button class="icon-btn" data-del="items" data-i="${i}" aria-label="Remove activity">${icon('trash', 16)}</button>`}</header>
    <div class="form two-col">${fieldHtml(F.type, a.type, ctx, ro)}${fieldHtml(F.pos, a.position, ctx, ro)}<div class="span2">${fieldHtml(F.org, a.org, ctx, ro)}</div><div class="span2">${fieldHtml(F.desc, a.desc, ctx, ro)}</div></div>
    <div class="form two-col">
      <fieldset><legend>Grade levels</legend><div class="row wrap gap">${GRADES.map(g => h`<label class="chip-check"><input type="checkbox" data-list="items" data-i="${i}" data-c="grades" data-multi value="${g}" ${(a.grades || []).includes(g) ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>${g === 'PG' ? 'Post-grad' : g}</span></label>`)}</div></fieldset>
      ${fieldHtml(SEL('timing', 'Timing of participation', ['School year', 'School break', 'All year']), a.timing, ctx, ro)}
      ${fieldHtml(T('hours', 'Hours per week', { type: 'number', min: 0, max: 168 }), a.hours, ctx, ro)}${fieldHtml(T('weeks', 'Weeks per year', { type: 'number', min: 0, max: 52 }), a.weeks, ctx, ro)}
      <label class="check-inline span2"><input type="checkbox" data-list="items" data-i="${i}" data-c="continue" ${a.continue ? 'checked' : ''} ${ro ? 'disabled' : ''}> I intend to participate in a similar activity in college</label></div>
  </article>`;
}
function honorCard(a, i, n, ro) {
  const ctx = { list: 'items', i };
  return h`<article class="slot card" data-slot="${i}"><header><span class="slot-n">${i + 1}</span><strong class="grow">${a.title || 'New honor'}</strong>
    ${ro ? '' : h`<button class="icon-btn" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 16)}</button><button class="icon-btn" data-move="1" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down', 16)}</button><button class="icon-btn" data-del="items" data-i="${i}" aria-label="Remove honor">${icon('trash', 16)}</button>`}</header>
    <div class="form">${fieldHtml(T('title', 'Honor title', { max: 100 }), a.title, ctx, ro)}
    <fieldset><legend>Grade levels</legend><div class="row wrap gap">${GRADES.slice(0, 4).concat('PG').map(g => h`<label class="chip-check"><input type="checkbox" data-list="items" data-i="${i}" data-c="grades" data-multi value="${g}" ${(a.grades || []).includes(g) ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>${g === 'PG' ? 'Post-grad' : g}</span></label>`)}</div></fieldset>
    <fieldset><legend>Level of recognition (select all that apply)</legend><div class="row wrap gap">${LEVELS.map(g => h`<label class="chip-check"><input type="checkbox" data-list="items" data-i="${i}" data-c="levels" data-multi value="${g}" ${(a.levels || []).includes(g) ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>${g}</span></label>`)}</div></fieldset></div></article>`;
}
function gpaCalc(rows) {
  let u = 0, w = 0, c = 0;
  for (const r of rows) { const p = POINTS[r.grade]; if (p == null) continue; const cr = parseFloat(r.credits) || 1; const bonus = ['AP', 'IB', 'Dual enrollment'].includes(r.level) ? 1 : r.level === 'Honors' ? .5 : 0; u += p * cr; w += (p + (p > 0 ? bonus : 0)) * cr; c += cr; }
  return c ? { u: (u / c).toFixed(2), w: (w / c).toFixed(2) } : null;
}
function coursesHtml(rows, ro) {
  const g = gpaCalc(rows);
  const cols = [{ k: 'year', label: 'Grade', type: 'select', opts: ['9', '10', '11', '12'] }, SEL('term', 'Term', ['Full year', 'Fall', 'Spring']), T('name', 'Course name', { max: 80 }), SEL('level', 'Level', COURSE_LEVELS), SEL('grade', 'Grade', LETTERS), T('credits', 'Credits', { type: 'number', step: '0.5', min: 0, max: 5 })];
  return h`<div class="gpa-box" id="gpa">${g ? h`<div><small>Unweighted GPA</small><strong>${g.u}</strong></div><div><small>Weighted GPA (AP/IB +1, Honors +0.5)</small><strong>${g.w}</strong></div><p class="muted small">Calculated from the courses below as a planning estimate. Your school's official GPA belongs in Education.</p>` : h`<p class="muted">Add courses with grades to see a GPA estimate.</p>`}</div>
  <div class="table-wrap"><table class="table courses"><thead><tr>${cols.map(c => h`<th>${c.label}</th>`)}<th></th></tr></thead><tbody>${rows.map((r, i) => h`<tr>${cols.map(c => h`<td>${inputHtml(c, r[c.k], { list: 'rows', i }, ro)}</td>`)}<td>${ro ? '' : h`<button class="icon-btn" data-del="rows" data-i="${i}" aria-label="Remove course">${icon('trash', 16)}</button>`}</td></tr>`)}</tbody></table></div>
  ${ro ? '' : h`<button class="btn" data-add="rows">${icon('plus', 14)} Add course</button>`}`;
}

routes.profile = async (root, args, stale) => {
  const sec = SECTION_ROUTES.includes(args[0]) ? args[0] : 'profile';
  if (sec === 'writing') return go('/essays');
  const [pr, sm] = await Promise.all([GET(sp('/profile')), GET(sp('/summary'))]); if (stale()) return;
  const ro = !can('student', 'counsellor');
  let data = pr.profile[sec] || {}; let progress = sm.metrics.progress;
  if (sec === 'activities' || sec === 'honors') data.items = data.items || [];
  if (sec === 'courses') data.rows = data.rows || [];
  const meta = { activities: ['Activities', 'List up to 10 activities in order of importance to you. Limits match the Common App: position 50 characters, organization 100, description 150.', 10], honors: ['Honors', 'List up to 5 honors, in order of importance to you. Title limit is 100 characters.', 5], additional: ['Additional information', 'Share anything not covered elsewhere that you want colleges to know (circumstances, context). Limit 650 words.'], courses: ['Courses & grades', 'Enter the courses you have taken or are taking. Many colleges ask for these to be self-reported.'] };
  const title = (SCHEMA[sec] || { title: meta[sec][0] }).title, intro = (SCHEMA[sec] || { intro: meta[sec][1] }).intro;

  const body = () => {
    if (SCHEMA[sec]) return h`<div class="form-sections">${SCHEMA[sec].groups.map(g => h`<section class="card"><h3>${g.title}</h3><div class="form ${g.cols === 2 ? 'two-col' : ''}">${g.fields.map(f => fieldHtml(f, data[f.k], null, ro))}</div>${g.list ? h`<div class="sub-head">${g.title === 'Siblings' ? 'Sibling details' : 'Entries'}</div>${listHtml(g.list, data[g.list.key] || [], ro)}` : ''}</section>`)}</div>`;
    if (sec === 'activities') return h`<div class="slot-meter">${data.items.length} of 10 slots used ${bar(data.items.length / 10)}</div>${data.items.map((a, i) => activityCard(a, i, data.items.length, ro))}${ro || data.items.length >= 10 ? '' : h`<button class="btn primary" data-add="items">${icon('plus', 14)} Add activity</button>`}`;
    if (sec === 'honors') return h`<div class="slot-meter">${data.items.length} of 5 slots used ${bar(data.items.length / 5)}</div>${data.items.map((a, i) => honorCard(a, i, data.items.length, ro))}${ro || data.items.length >= 5 ? '' : h`<button class="btn primary" data-add="items">${icon('plus', 14)} Add honor</button>`}`;
    if (sec === 'additional') return h`<section class="card"><label><span class="lbl">Additional information<small class="count" id="wc"></small></span><textarea data-k="text" rows="12" ${ro ? 'disabled' : ''}>${data.text || ''}</textarea></label><p class="muted small">Optional. Counts toward your progress only if filled in.</p></section>`;
    return h`<section class="card">${coursesHtml(data.rows, ro)}</section>`;
  };
  const newItem = { items: sec === 'honors' ? () => ({ title: '', grades: [], levels: [] }) : () => ({ type: '', position: '', org: '', desc: '', grades: [], timing: '', hours: '', weeks: '', continue: false }), siblings: () => ({ name: '', age: '', education: '' }), ap: () => ({ subject: '', year: '', score: '' }), rows: () => ({ year: '12', term: 'Full year', name: '', level: 'Standard', grade: '', credits: '1' }) };

  const draw = () => {
    root.innerHTML = h`${pageHead(title, intro, h`<span class="save-state" id="ss" aria-live="polite">${ro ? 'View only' : 'All changes saved'}</span>`)}
    <div class="split"><nav class="stepper" aria-label="Common App sections">${SECTION_ROUTES.map((k, i) => { const p = progress[k]; return h`<a href="#/profile/${k}" class="${k === sec ? 'active' : ''}"><span class="step-dot ${p == null ? 'opt' : p >= 1 ? 'done' : p > 0 ? 'part' : ''}">${p != null && p >= 1 ? icon('check', 12) : i + 1}</span><span>${SEC_LABELS[k]}</span></a>`; })}</nav>
    <div class="split-main" id="pbody">${body()}</div></div>`.s;
    if (sec === 'additional') updWC();
  };
  const updWC = () => { const n = wordCount(data.text || ''); const el = $('#wc'); if (el) { el.textContent = `${n}/650 words`; el.classList.toggle('over', n > 650); } };
  let dirty = false;
  const save = debounce(async () => {
    if (sec === 'additional' && wordCount(data.text || '') > 650) { setSS('Over 650 words: not saved', 'err'); return; }
    try { setSS('Saving…'); const r = await PUT(sp(`/profile/${sec}`), { data }); progress = r.metrics.progress; dirty = false; setSS('All changes saved', 'ok'); repaintSteps(); } catch (e) { setSS(e.message, 'err'); toast(e.message, 'err'); }
  }, 700);
  const setSS = (t, c = '') => { const e = $('#ss'); if (e) { e.textContent = t; e.className = 'save-state ' + c; } };
  const repaintSteps = () => $$('.stepper a').forEach((a, i) => { const p = progress[SECTION_ROUTES[i]]; const d = $('.step-dot', a); d.className = 'step-dot ' + (p == null ? 'opt' : p >= 1 ? 'done' : p > 0 ? 'part' : ''); d.innerHTML = p != null && p >= 1 ? icon('check', 12).s : i + 1; });
  draw();
  S.cleanup = () => { if (dirty) save.flush() ; };
  if (ro) return;

  const target = (t) => t.dataset.list ? (sec === 'testing' || sec === 'family' ? (data[t.dataset.list] = data[t.dataset.list] || []) : data[t.dataset.list]) : null;
  const handle = (e, t) => {
    if (t.dataset.list) {
      const arr = target(t), it = arr[+t.dataset.i], c = t.dataset.c;
      if (t.dataset.multi !== undefined) { const a = it[c] = it[c] || []; t.checked ? a.includes(t.value) || a.push(t.value) : it[c] = a.filter(x => x !== t.value); }
      else it[c] = t.type === 'checkbox' ? t.checked : t.value;
      if (sec === 'courses') { const g = gpaCalc(data.rows); }
      const hd = t.closest('.slot') && $('strong.grow', t.closest('.slot')); if (hd && (c === 'org' || c === 'title')) hd.textContent = it[c] || (sec === 'honors' ? 'New honor' : 'New activity');
    } else {
      data[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value;
      if (sec === 'testing' && (t.dataset.k === 'sat_ebrw' || t.dataset.k === 'sat_math')) { const a = +data.sat_ebrw || 0, b = +data.sat_math || 0; data.sat_total = a && b ? String(a + b) : ''; $('#f_sat_total').value = data.sat_total; }
    }
    if (t.maxLength > 0 && t.type !== 'checkbox') { const c = t.closest('label') && $('.count', t.closest('label')); if (c) c.textContent = `${t.value.length}/${t.maxLength}`; }
    if (sec === 'additional') updWC();
    if (sec === 'courses') { const g = gpaCalc(data.rows); $('#gpa').innerHTML = g ? `<div><small>Unweighted GPA</small><strong>${g.u}</strong></div><div><small>Weighted GPA (AP/IB +1, Honors +0.5)</small><strong>${g.w}</strong></div>` : '<p class="muted">Add courses with grades to see a GPA estimate.</p>'; }
    dirty = true; setSS('Unsaved changes…'); save();
  };
  const pb = $('#pbody');
  pb.addEventListener('input', e => { const t = e.target.closest('[data-k],[data-list]'); if (t && !['SELECT'].includes(t.tagName) && t.type !== 'checkbox') handle(e, t); });
  pb.addEventListener('change', e => { const t = e.target.closest('[data-k],[data-list]'); if (t && (t.tagName === 'SELECT' || t.type === 'checkbox')) handle(e, t); });
  const arrFor = key => { const L = key === 'items' || key === 'rows' ? data : data; return key === 'siblings' || key === 'ap' ? (data[key] = data[key] || []) : data[key]; };
  const redraw = () => { const y = pb.scrollTop; $('#pbody').innerHTML = body().s; save(); setSS('Unsaved changes…'); };
  on(pb, 'click', '[data-add]', (e, t) => { const k = t.dataset.add; arrFor(k).push(newItem[k]()); redraw(); const last = $$('[data-slot]', pb).pop(); last && $('input,select,textarea', last)?.focus(); });
  on(pb, 'click', '[data-del]', async (e, t) => { const k = t.dataset.del, i = +t.dataset.i; const it = arrFor(k)[i]; const filledIn = Object.values(it).some(v => (Array.isArray(v) ? v.length : v && v !== '1' && v !== '12' && v !== 'Full year' && v !== 'Standard')); if (!filledIn || await confirmDlg('Remove this entry? This cannot be undone.', 'Remove')) { arrFor(k).splice(i, 1); redraw(); } });
  on(pb, 'click', '[data-move]', (e, t) => { const i = +t.dataset.i, j = i + +t.dataset.move, a = data.items; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; redraw(); });
};
