/* Messaging: team thread (student + staff) and staff-only thread */
routes.messages = async (root, args, stale) => {
  const staff = S.user.role !== 'student';
  let ch = args[0] === 'staff' && staff ? 'staff' : 'team', last = 0, timer;
  const st = currentStudent() || { name: 'Student' };
  root.innerHTML = h`${pageHead('Messages', 'Everyone working with ' + st.name.split(' ')[0] + ' in one thread.')}
    <div class="chat card">
      ${staff ? h`<div class="tabs chat-tabs"><button data-ch="team">Team (with student)</button><button data-ch="staff">${icon('eye', 14)} Staff only</button></div>` : ''}
      <div class="chat-log" id="log" role="log" aria-live="polite"></div>
      <form id="cf" class="chat-form"><textarea rows="2" placeholder="Write a message. Enter to send, Shift+Enter for a new line." maxlength="5000" aria-label="Message"></textarea><button class="btn primary">Send</button></form>
    </div>`.s;
  const log = $('#log');
  const add = ms => {
    if (!ms.length) return;
    log.querySelector('.empty')?.remove();
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80 || !last;
    let prevDay = log.dataset.day || '';
    log.insertAdjacentHTML('beforeend', ms.map(m => {
      const day = m.created.slice(0, 10), sep = day !== prevDay ? `<div class="day">${fmtDate(day)}</div>` : ''; prevDay = day;
      const mine = m.sender_id === S.user.id;
      return sep + `<div class="msg ${mine ? 'mine' : ''}">${avatar({ id: m.sender_id, name: m.sender }, 30).s}<div><div class="who"><strong>${esc(m.sender)}</strong> ${roleBadge(m.role).s} <small class="muted">${fmtDT(m.created)}</small></div><div class="bubble">${esc(m.body).replace(/\n/g, '<br>')}</div></div></div>`;
    }).join(''));
    log.dataset.day = prevDay; last = ms[ms.length - 1].id;
    if (near) log.scrollTop = log.scrollHeight;
  };
  const fetchNew = async () => { try { const r = await GET(sp(`/messages?channel=${ch}&after=${last}`)); add(r.messages); pollUnread(); } catch { } };
  const switchCh = c => { ch = c; last = 0; log.innerHTML = ''; log.dataset.day = ''; $$('[data-ch]').forEach(b => b.classList.toggle('on', b.dataset.ch === ch)); fetchNew().then(() => { if (!last) log.innerHTML = '<div class="empty"><p>No messages yet. Say hello!</p></div>'; }); };
  on(root, 'click', '[data-ch]', (e, t) => switchCh(t.dataset.ch));
  const send = () => { const ta = $('#cf textarea'), body = ta.value.trim(); if (!body) return; ta.value = ''; guard(async () => { await POST(sp('/messages'), { channel: ch, body }); if (log.querySelector('.empty')) log.innerHTML = ''; await fetchNew(); }); };
  $('#cf').onsubmit = e => { e.preventDefault(); send(); };
  $('#cf textarea').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  switchCh(ch);
  timer = setInterval(fetchNew, 3000); S.cleanup = () => clearInterval(timer);
};
