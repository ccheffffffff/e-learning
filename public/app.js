/* EMC Academy — single-page frontend (no build step). */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utils
  const $app = document.getElementById('app');
  const $toasts = document.getElementById('toasts');

  function h(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function attr(s) { return h(s); }
  function initials(name) { return (name || '?').trim().charAt(0).toUpperCase(); }
  function minutesLabel(m) {
    m = Number(m) || 0;
    if (m >= 60) { const hh = Math.floor(m / 60), mm = m % 60; return mm ? `${hh} ชม. ${mm} นาที` : `${hh} ชม.`; }
    return `${m} นาที`;
  }
  function roleLabel(r) { return r === 'instructor' ? 'ผู้สอน' : r === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้เรียน'; }
  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' error' : '');
    el.textContent = msg;
    $toasts.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function confirmModal({ title, text, okLabel = 'ยืนยัน', danger = false }) {
    return new Promise((resolve) => {
      const bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <h3>${h(title)}</h3>
          <p>${h(text)}</p>
          <div class="acts">
            <button class="btn btn-outline" data-x="cancel">ยกเลิก</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-x="ok">${h(okLabel)}</button>
          </div>
        </div>`;
      bg.addEventListener('click', (e) => {
        const x = e.target.getAttribute('data-x');
        if (e.target === bg || x === 'cancel') { bg.remove(); resolve(false); }
        if (x === 'ok') { bg.remove(); resolve(true); }
      });
      document.body.appendChild(bg);
    });
  }

  // ---------------------------------------------------------------- icons
  const I = {
    lotus: (cls = '', sw = 1.4) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.8 2 1.8 5 0 7-1.8-2-1.8-5 0-7z"/><path d="M12 21c1.8-2 1.8-5 0-7-1.8 2-1.8 5 0 7z"/><path d="M3 12c2-1.8 5-1.8 7 0-2 1.8-5 1.8-7 0z"/><path d="M21 12c-2-1.8-5-1.8-7 0 2 1.8 5 1.8 7 0z"/><path d="M5.6 5.6c2.6.4 4.6 2.4 5 5-2.6-.4-4.6-2.4-5-5z"/><path d="M18.4 18.4c-2.6-.4-4.6-2.4-5-5 2.6.4 4.6 2.4 5 5z"/><path d="M18.4 5.6c-.4 2.6-2.4 4.6-5 5 .4-2.6 2.4-4.6 5-5z"/><path d="M5.6 18.4c.4-2.6 2.4-4.6 5-5-.4 2.6-2.4 4.6-5 5z"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    cog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>`,
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
    next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    award: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>`,
    up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
    down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>`,
    drive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.3 3h7.4l6.3 11H15.7L8.3 3zM2 14l3.7-6.4L13 20H4.5L2 14zm5.4 6 2.6-4.4h11l-2.6 4.4H7.4z"/></svg>`,
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>`,
    printer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`
  };

  function providerTag(l) {
    if (!l || !l.provider) return `<span class="provider-tag">${I.link} ไม่มีสื่อ</span>`;
    if (l.provider === 'youtube') return `<span class="provider-tag youtube">${I.youtube} YouTube${l.kind === 'playlist' ? ' Playlist' : ''}</span>`;
    const kinds = { file: 'Google Drive', folder: 'Drive Folder', doc: 'Google Docs', slides: 'Google Slides', sheet: 'Google Sheets', form: 'Google Forms' };
    return `<span class="provider-tag gdrive">${I.drive} ${h(kinds[l.kind] || 'Google Drive')}</span>`;
  }

  // ---------------------------------------------------------------- state
  const state = {
    user: undefined, // undefined = unknown, null = guest
    categories: [],
    category: 'all',
    q: '',
    sidebarOpen: false
  };

  // ---------------------------------------------------------------- routing
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
    return { parts, query };
  }
  function go(path) { location.hash = path.startsWith('#') ? path : '#' + path; }

  window.addEventListener('hashchange', render);

  async function boot() {
    try {
      const [{ user }, { categories }] = await Promise.all([api('GET', '/api/auth/me'), api('GET', '/api/categories')]);
      state.user = user;
      state.categories = categories;
    } catch (e) {
      state.user = null;
      toast(e.message, 'error');
    }
    render();
  }

  let renderToken = 0;
  async function render() {
    const token = ++renderToken;
    const { parts, query } = parseHash();
    const page = parts[0] || '';
    state.sidebarOpen = false;

    if (state.user === undefined) return;

    if (page === 'login' || page === 'register') {
      if (state.user) return go('/');
      $app.innerHTML = renderAuth(page);
      bindAuth(page);
      return;
    }

    if (!state.user) {
      const next = location.hash && location.hash !== '#/' ? '?next=' + encodeURIComponent(location.hash) : '';
      return go('/login' + next);
    }

    if (query.category) state.category = query.category;

    try {
      let body;
      let title;
      if (page === '' || page === 'catalog') {
        [title, body] = await pageCatalog();
      } else if (page === 'course' && parts[1] && parts[2] === 'lesson' && parts[3]) {
        [title, body] = await pageLesson(parts[1], parts[3]);
      } else if (page === 'course' && parts[1]) {
        [title, body] = await pageCourse(parts[1]);
      } else if (page === 'dashboard') {
        [title, body] = await pageDashboard();
      } else if (page === 'certificate' && parts[1]) {
        [title, body] = await pageCertificate(parts[1]);
      } else if (page === 'manage' && isInstructor()) {
        if (parts[1] === 'new') [title, body] = [ 'สร้างคอร์สใหม่', renderCourseForm(null) ];
        else if (parts[1]) [title, body] = await pageManageCourse(parts[1]);
        else [title, body] = await pageManageList();
      } else {
        [title, body] = ['ไม่พบหน้า', `<div class="empty"><h3>ไม่พบหน้าที่คุณต้องการ</h3><p>ลิงก์อาจไม่ถูกต้องหรือหน้านี้ถูกลบไปแล้ว</p><a class="btn btn-primary" href="#/">กลับหน้าคอร์สเรียน</a></div>`];
      }
      if (token !== renderToken) return;
      $app.innerHTML = renderShell(page, title, body);
      bindShell();
      bindPage(page);
    } catch (e) {
      if (token !== renderToken) return;
      if (e.status === 401) { state.user = null; return go('/login'); }
      $app.innerHTML = renderShell(page, 'เกิดข้อผิดพลาด', `<div class="empty"><h3>${h(e.message)}</h3><p>ลองใหม่อีกครั้ง หรือกลับไปหน้าคอร์สเรียน</p><a class="btn btn-primary" href="#/">กลับหน้าคอร์สเรียน</a></div>`);
      bindShell();
    }
  }

  function isInstructor() { return state.user && (state.user.role === 'instructor' || state.user.role === 'admin'); }

  // ---------------------------------------------------------------- auth pages
  function renderAuth(page) {
    const isLogin = page === 'login';
    return `
    <div class="auth-page">
      <aside class="auth-brand">
        <span class="lotus-bg" style="color:var(--accent)">${I.lotus('', 0.6)}</span>
        <div class="brand">
          <span style="width:30px;height:30px;color:var(--accent)">${I.lotus('', 1.4)}</span>
          <div><div class="brand-name serif">EMC ACADEMY</div><div class="brand-sub">ศาสตร์บำบัดแบบองค์รวม</div></div>
        </div>
        <div class="pitch">
          <div class="eyebrow">แพลตฟอร์มเรียนออนไลน์</div>
          <h1 class="serif">เรียนรู้ศาสตร์การบำบัดแบบองค์รวม เพื่อกาย ใจ และจิตวิญญาณ</h1>
          <p>หลักสูตรออนไลน์ที่รวบรวมองค์ความรู้ด้านการแพทย์ทางเลือก พลังงานบำบัด และการดูแลสุขภาพแบบองค์รวม สอนโดยผู้เชี่ยวชาญเฉพาะทาง</p>
          <div class="points">
            <div><span class="dot"></span> เรียนผ่านวิดีโอ YouTube และเอกสาร Google Drive ได้ในที่เดียว</div>
            <div><span class="dot"></span> ติดตามความคืบหน้าและรับใบประกาศนียบัตรเมื่อเรียนจบ</div>
            <div><span class="dot"></span> ผู้สอนสร้างคอร์สได้เองเพียงวางลิงก์สื่อการสอน</div>
          </div>
        </div>
        <div class="foot">© EMC Academy</div>
      </aside>
      <main class="auth-form-wrap">
        <div class="auth-card">
          <h2 class="serif">${isLogin ? 'ยินดีต้อนรับกลับ' : 'สร้างบัญชีใหม่'}</h2>
          <p class="lead">${isLogin ? 'เข้าสู่ระบบเพื่อเรียนต่อจากจุดที่คุณค้างไว้' : 'สมัครฟรีเพื่อเริ่มเรียน หรือสมัครเป็นผู้สอนเพื่อสร้างคอร์สของคุณเอง'}</p>
          <div id="auth-alert"></div>
          <form id="auth-form" novalidate>
            ${isLogin ? '' : `
            <div class="field">
              <label for="f-name">ชื่อ-นามสกุล</label>
              <input class="input" id="f-name" name="name" type="text" autocomplete="name" required placeholder="เช่น ศิริพร ใจดี">
            </div>`}
            <div class="field">
              <label for="f-email">อีเมล</label>
              <input class="input" id="f-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
            </div>
            <div class="field">
              <label for="f-password">รหัสผ่าน</label>
              <input class="input" id="f-password" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required placeholder="${isLogin ? '••••••••' : 'อย่างน้อย 8 ตัวอักษร'}" minlength="8">
            </div>
            ${isLogin ? '' : `
            <div class="field">
              <label>สมัครในฐานะ</label>
              <div class="segment" id="role-seg">
                <button type="button" data-role="student" class="active">ผู้เรียน</button>
                <button type="button" data-role="instructor">ผู้สอน</button>
              </div>
              <span class="hint" id="role-hint">ผู้เรียนสามารถลงทะเบียนคอร์ส ติดตามความคืบหน้า และรับใบประกาศนียบัตร</span>
              <input type="hidden" name="role" value="student">
            </div>`}
            <button class="btn btn-primary btn-lg btn-block" type="submit" id="auth-submit">${isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
          </form>
          <div class="switch">${isLogin ? 'ยังไม่มีบัญชี? <a href="#/register">สมัครสมาชิก</a>' : 'มีบัญชีอยู่แล้ว? <a href="#/login">เข้าสู่ระบบ</a>'}</div>
          ${isLogin ? `
          <div class="demo-box">
            <b>บัญชีทดลองใช้งาน</b><br>
            ผู้เรียน: student@emc.academy · ผู้สอน: instructor@emc.academy<br>
            รหัสผ่าน: password123
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" type="button" data-demo="student@emc.academy">เข้าใช้แบบผู้เรียน</button>
              <button class="btn btn-outline btn-sm" type="button" data-demo="instructor@emc.academy">เข้าใช้แบบผู้สอน</button>
            </div>
          </div>` : ''}
        </div>
      </main>
    </div>`;
  }

  function bindAuth(page) {
    const form = document.getElementById('auth-form');
    const alertBox = document.getElementById('auth-alert');
    const seg = document.getElementById('role-seg');
    if (seg) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-role]');
        if (!b) return;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        form.role.value = b.dataset.role;
        document.getElementById('role-hint').textContent = b.dataset.role === 'instructor'
          ? 'ผู้สอนสามารถสร้างคอร์ส เพิ่มบทเรียนจากลิงก์ YouTube หรือ Google Drive และเผยแพร่ให้ผู้เรียน'
          : 'ผู้เรียนสามารถลงทะเบียนคอร์ส ติดตามความคืบหน้า และรับใบประกาศนียบัตร';
      });
    }
    document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
      form.email.value = b.dataset.demo;
      form.password.value = 'password123';
      form.requestSubmit();
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.innerHTML = '';
      const btn = document.getElementById('auth-submit');
      btn.disabled = true;
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const { user } = await api('POST', page === 'login' ? '/api/auth/login' : '/api/auth/register', payload);
        state.user = user;
        toast(page === 'login' ? `ยินดีต้อนรับกลับ, ${user.name}` : `สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ${user.name}`);
        const next = new URLSearchParams(location.hash.split('?')[1] || '').get('next');
        go(next && next.startsWith('#/') ? next : (user.role === 'instructor' ? '/manage' : '/'));
      } catch (err) {
        alertBox.innerHTML = `<div class="alert alert-error">${h(err.message)}</div>`;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------- shell
  function renderShell(page, title, body) {
    const u = state.user;
    const catalogActive = page === '' || page === 'catalog' || page === 'course';
    const cats = [{ id: 'all', label: 'ทั้งหมด' }, ...state.categories];
    return `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <a class="brand-row" href="#/">
          <span style="width:26px;height:26px;color:var(--accent)">${I.lotus('', 1.4)}</span>
          <div><div class="name serif">EMC ACADEMY</div><div class="sub">ศาสตร์บำบัดแบบองค์รวม</div></div>
        </a>
        <a class="nav-item ${catalogActive ? 'active' : ''}" href="#/">${I.grid}<span>คอร์สเรียน</span></a>
        <a class="nav-item ${page === 'dashboard' || page === 'certificate' ? 'active' : ''}" href="#/dashboard">${I.book}<span>คอร์สของฉัน</span></a>
        ${isInstructor() ? `<a class="nav-item ${page === 'manage' ? 'active' : ''}" href="#/manage">${I.cog}<span>จัดการคอร์ส</span></a>` : ''}
        <div class="nav-sep"></div>
        <div class="nav-label">หมวดหมู่</div>
        <div style="display:flex;flex-direction:column;gap:2px">
          ${cats.map((c) => `<a class="cat-chip ${catalogActive && state.category === c.id ? 'active' : ''}" href="#/?category=${attr(c.id)}"><span class="dot"></span><span>${h(c.label)}</span></a>`).join('')}
        </div>
        <div class="sidebar-foot">
          <div class="sidebar-user">
            <div class="avatar">${h(initials(u.name))}</div>
            <div class="who"><div class="n">${h(u.name)}</div><div class="r">${h(roleLabel(u.role))}</div></div>
            <button class="icon-btn" title="ออกจากระบบ" data-action="logout">${I.logout}</button>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <button class="menu-btn" data-action="menu" aria-label="เมนู">${I.menu}</button>
            <div class="title serif">${h(title)}</div>
          </div>
          <div class="right">
            <form class="search" id="search-form" role="search">
              ${I.search}<input type="search" name="q" placeholder="ค้นหาคอร์สเรียน..." value="${attr(state.q)}" aria-label="ค้นหาคอร์สเรียน">
            </form>
            <div class="user-pill"><div class="avatar">${h(initials(u.name))}</div><span>${h(u.name)}</span></div>
          </div>
        </header>
        <main class="content" id="content">${body}</main>
      </div>
    </div>`;
  }

  function bindShell() {
    const sidebar = document.getElementById('sidebar');
    document.querySelector('[data-action="menu"]').addEventListener('click', () => sidebar.classList.toggle('open'));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) sidebar.classList.remove('open'); });
    document.querySelector('[data-action="logout"]').addEventListener('click', async () => {
      await api('POST', '/api/auth/logout');
      state.user = null;
      state.q = '';
      state.category = 'all';
      toast('ออกจากระบบแล้ว');
      go('/login');
    });
    const sf = document.getElementById('search-form');
    sf.addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = sf.q.value.trim();
      if (parseHash().parts[0] && parseHash().parts[0] !== 'catalog') go('/');
      else render();
    });
    sf.q.addEventListener('input', () => {
      const p = parseHash().parts[0];
      if (p && p !== 'catalog') return;
      state.q = sf.q.value.trim();
      clearTimeout(sf._t);
      sf._t = setTimeout(async () => {
        const grid = document.getElementById('catalog-grid');
        if (!grid) return;
        const { courses } = await api('GET', catalogUrl());
        grid.outerHTML = renderCatalogGrid(courses);
      }, 220);
    });
  }

  function bindPage(page) {
    const content = document.getElementById('content');
    content.addEventListener('click', onContentClick);
    if (page === 'manage') bindManage();
    if (page === 'certificate') { const p = content.querySelector('[data-action="print"]'); if (p) p.addEventListener('click', () => window.print()); }
  }

  async function onContentClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;
    try {
      if (action === 'enroll') {
        el.disabled = true;
        const { course } = await api('POST', `/api/courses/${id}/enroll`);
        toast('ลงทะเบียนเรียนสำเร็จ เริ่มเรียนได้เลย');
        const first = course.lessons.find((l) => !l.done) || course.lessons[0];
        go(first ? `/course/${course.id}/lesson/${first.id}` : `/course/${course.id}`);
      } else if (action === 'toggle-complete') {
        el.disabled = true;
        const done = el.dataset.done !== 'true';
        const { course } = await api('POST', `/api/lessons/${id}/complete`, { done });
        toast(done ? 'บันทึกว่าเรียนบทนี้จบแล้ว' : 'ยกเลิกสถานะเรียนจบ');
        if (done && course.progress >= 100) toast('ยินดีด้วย! คุณเรียนจบคอร์สนี้แล้ว รับใบประกาศนียบัตรได้ที่หน้าคอร์สของฉัน');
        const nextLesson = done ? course.lessons.find((l) => l.id > Number(id) && !l.done) || course.lessons.find((l) => l.id > Number(id)) : null;
        if (done && nextLesson) go(`/course/${course.id}/lesson/${nextLesson.id}`);
        else render();
      } else if (action === 'clear-search') {
        state.q = '';
        render();
      }
    } catch (err) {
      toast(err.message, 'error');
      el.disabled = false;
    }
  }

  // ---------------------------------------------------------------- catalog
  function catalogUrl() {
    const p = new URLSearchParams();
    if (state.category && state.category !== 'all') p.set('category', state.category);
    if (state.q) p.set('q', state.q);
    return '/api/courses' + (p.toString() ? '?' + p.toString() : '');
  }

  async function pageCatalog() {
    const { courses } = await api('GET', catalogUrl());
    const cat = state.categories.find((c) => c.id === state.category);
    const title = state.category === 'all' ? 'คอร์สเรียนทั้งหมด' : (cat ? cat.label : 'คอร์สเรียน');
    const body = `
      <section class="hero">
        <span class="lotus-bg" style="color:var(--accent)">${I.lotus('', 0.7)}</span>
        <div class="inner">
          <div class="eyebrow">EMC ACADEMY</div>
          <h1 class="serif">เรียนรู้ศาสตร์การบำบัดแบบองค์รวม เพื่อกาย ใจ และจิตวิญญาณ</h1>
          <p>หลักสูตรออนไลน์ที่รวบรวมองค์ความรู้ด้านการแพทย์ทางเลือก พลังงานบำบัด และการดูแลสุขภาพแบบองค์รวม สอนโดยผู้เชี่ยวชาญเฉพาะทาง</p>
        </div>
      </section>
      ${renderCatalogGrid(courses)}`;
    return [title, body];
  }

  function renderCatalogGrid(courses) {
    if (!courses.length) {
      return `<div id="catalog-grid" class="empty"><h3>ไม่พบคอร์สที่ตรงกับเงื่อนไข</h3><p>${state.q ? `ไม่มีคอร์สที่ตรงกับ "${h(state.q)}"` : 'ยังไม่มีคอร์สในหมวดหมู่นี้'}</p>${state.q ? '<button class="btn btn-outline" data-action="clear-search">ล้างคำค้นหา</button>' : '<a class="btn btn-outline" href="#/?category=all">ดูคอร์สทั้งหมด</a>'}</div>`;
    }
    return `<div id="catalog-grid" class="grid">${courses.map(renderCourseCard).join('')}</div>`;
  }

  function renderCourseCard(c) {
    const cta = c.enrolled ? (c.progress >= 100 ? 'ทบทวนคอร์ส' : 'เรียนต่อ') : 'ดูรายละเอียด';
    return `
      <a class="card" href="#/course/${c.id}">
        <div class="thumb">
          <span class="lotus" style="color:var(--accent)">${I.lotus('', 0.8)}</span>
          <span class="cat">${h(c.categoryLabel)}</span>
        </div>
        <div class="body">
          <div class="title serif clamp2">${h(c.title)}</div>
          <div class="by">${I.user}<span>${h(c.instructor)}</span></div>
          <div class="facts">
            <span>${I.layers}${c.lessonCount} บทเรียน</span>
            <span>${I.clock}${h(minutesLabel(c.totalMinutes))}</span>
            <span class="lvl">${h(c.level)}</span>
          </div>
          ${c.enrolled ? `<div style="margin-bottom:12px"><div class="progress"><div style="width:${c.progress}%"></div></div></div>` : ''}
          <span class="btn ${c.enrolled ? 'btn-primary' : 'btn-outline'} btn-block cta">${cta}</span>
        </div>
      </a>`;
  }

  // ---------------------------------------------------------------- course detail
  async function pageCourse(id) {
    const { course: c } = await api('GET', `/api/courses/${id}`);
    const resume = c.lessons.find((l) => !l.done) || c.lessons[0];
    const cta = !c.lessons.length ? '' : c.enrolled
      ? `<a class="btn btn-primary btn-lg" href="#/course/${c.id}/lesson/${resume.id}">${c.progress >= 100 ? 'ทบทวนคอร์ส' : c.completedCount ? 'เรียนต่อ' : 'เริ่มเรียน'}</a>`
      : `<button class="btn btn-primary btn-lg" data-action="enroll" data-id="${c.id}">เริ่มเรียนคอร์สนี้</button>`;
    const body = `
      <button class="back" onclick="history.length > 1 ? history.back() : location.hash = '#/'">${I.back} กลับไปหน้าคอร์สเรียน</button>
      ${!c.published ? '<div class="alert alert-info">คอร์สนี้ยังเป็นฉบับร่าง ผู้เรียนจะยังไม่เห็นในหน้าคอร์สเรียน</div>' : ''}
      <section class="hero" style="padding:36px">
        <span class="lotus-bg" style="color:var(--accent);right:-10px;top:-30px;width:200px;height:200px;opacity:.18">${I.lotus('', 0.7)}</span>
        <div class="inner" style="max-width:640px">
          <span class="badge">${h(c.categoryLabel)}</span>
          <h1 class="serif" style="font-size:26px">${h(c.title)}</h1>
          <p>${h(c.subtitle)}</p>
          <div class="meta">
            <div>${I.user}${h(c.instructor)}</div>
            <div>${I.layers}${c.lessonCount} บทเรียน</div>
            <div>${I.clock}${h(minutesLabel(c.totalMinutes))}</div>
            <div>${I.users}${c.studentCount} ผู้เรียน</div>
            <span class="pill">${h(c.level)}</span>
          </div>
        </div>
      </section>
      <div class="panel row">
        <div class="grow">
          ${c.enrolled
            ? `<div class="progress-row"><div class="progress lg"><div style="width:${c.progress}%"></div></div><span>เรียนแล้ว ${c.completedCount}/${c.lessonCount} บท</span></div>`
            : `<div style="font-size:13.5px;color:var(--ink-3)">${c.lessonCount ? `คอร์สนี้มีทั้งหมด ${c.lessonCount} บทเรียน เริ่มเรียนได้ทันที` : 'คอร์สนี้ยังไม่มีบทเรียน'}</div>`}
        </div>
        <div style="display:flex;gap:10px;flex-shrink:0">
          ${c.enrolled && c.progress >= 100 && c.lessonCount ? `<a class="btn btn-outline btn-lg" href="#/certificate/${c.id}">${I.award} ใบประกาศนียบัตร</a>` : ''}
          ${isInstructor() && c.instructorId === state.user.id ? `<a class="btn btn-outline btn-lg" href="#/manage/${c.id}">${I.edit} แก้ไขคอร์ส</a>` : ''}
          ${cta}
        </div>
      </div>
      ${c.description ? `<h2 class="section-title serif">เกี่ยวกับคอร์สนี้</h2><p class="desc">${h(c.description)}</p>` : ''}
      <h2 class="section-title serif">เนื้อหาคอร์ส</h2>
      ${c.lessons.length ? `<div class="list">${c.lessons.map((l, i) => `
        <a class="lesson-row" href="#/course/${c.id}/lesson/${l.id}">
          <span class="check ${l.done ? 'done' : ''}" style="color:var(--accent-text)">${l.done ? I.check : ''}</span>
          <div class="t">${i + 1}. ${h(l.title)}<small>${providerTagText(l)}</small></div>
          ${providerTag(l)}
          <span class="d">${h(minutesLabel(l.durationMinutes))}</span>
        </a>`).join('')}</div>` : '<div class="empty"><h3>ยังไม่มีบทเรียน</h3><p>ผู้สอนกำลังเตรียมเนื้อหา</p></div>'}`;
    return [c.title, body];
  }

  function providerTagText(l) {
    if (!l.provider) return 'ยังไม่มีสื่อการสอน';
    return l.provider === 'youtube' ? 'วิดีโอ YouTube' : 'เอกสาร Google Drive';
  }

  // ---------------------------------------------------------------- lesson player
  async function pageLesson(courseId, lessonId) {
    const { course: c } = await api('GET', `/api/courses/${courseId}`);
    const idx = c.lessons.findIndex((l) => String(l.id) === String(lessonId));
    if (idx === -1) throw new Error('ไม่พบบทเรียนนี้');
    const l = c.lessons[idx];
    const prev = c.lessons[idx - 1];
    const next = c.lessons[idx + 1];
    const tall = l.provider === 'gdrive' && l.kind !== 'file';

    const frame = l.embedUrl
      ? (c.enrolled || isInstructor()
        ? `<div class="frame ${tall ? 'tall' : ''}"><iframe src="${attr(l.embedUrl)}" title="${attr(l.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
        : `<div class="frame"><div class="placeholder"><span class="lotus-bg" style="color:var(--accent)">${I.lotus('', 0.6)}</span><div class="play" style="color:var(--accent-text)">${I.play}</div>ลงทะเบียนเรียนเพื่อรับชมบทเรียนนี้<div style="margin-top:14px"><button class="btn btn-primary" data-action="enroll" data-id="${c.id}">เริ่มเรียนคอร์สนี้</button></div></div></div>`)
      : `<div class="frame"><div class="placeholder"><span class="lotus-bg" style="color:var(--accent)">${I.lotus('', 0.6)}</span><div class="play" style="color:var(--accent-text)">${I.play}</div>บทเรียนนี้ยังไม่มีสื่อการสอน</div></div>`;

    const body = `
      <a class="back" href="#/course/${c.id}">${I.back} กลับไปที่ ${h(c.title)}</a>
      <div class="player-layout">
        <div class="player-main">
          ${frame}
          <h1 class="lesson-title serif">${h(l.title)}</h1>
          <div class="lesson-meta">
            <span>บทที่ ${idx + 1} จาก ${c.lessonCount}</span>
            <span>·</span><span>${h(minutesLabel(l.durationMinutes))}</span>
            <span>·</span>${providerTag(l)}
            ${l.resourceUrl ? `<a href="${attr(l.resourceUrl)}" target="_blank" rel="noopener noreferrer">เปิดต้นฉบับ ${I.external.replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px"')}</a>` : ''}
          </div>
          <p class="lesson-desc">${h(l.description || `บทเรียนนี้เป็นส่วนหนึ่งของคอร์ส ${c.title} โดย ${c.instructor} เรียนตามจังหวะของคุณเองได้ทุกที่ทุกเวลา`)}</p>
          ${c.enrolled ? `
          <div class="panel row" style="padding:16px 20px">
            <div class="grow progress-row"><div class="progress md"><div style="width:${c.progress}%"></div></div><span>ความคืบหน้าคอร์ส ${c.progress}%</span></div>
            <button class="btn ${l.done ? 'btn-outline' : 'btn-primary'}" data-action="toggle-complete" data-id="${l.id}" data-done="${l.done}">${l.done ? `${I.check} เรียนจบแล้ว` : 'ทำเครื่องหมายว่าเรียนจบ'}</button>
          </div>` : `<div class="alert alert-info">ลงทะเบียนเรียนเพื่อบันทึกความคืบหน้าและรับใบประกาศนียบัตรเมื่อเรียนจบ</div>`}
          <div class="player-actions">
            ${prev ? `<a class="btn btn-outline" href="#/course/${c.id}/lesson/${prev.id}">${I.back} บทก่อนหน้า</a>` : '<span></span>'}
            ${next ? `<a class="btn btn-primary" href="#/course/${c.id}/lesson/${next.id}">บทถัดไป ${I.next}</a>` : (c.enrolled && c.progress >= 100 ? `<a class="btn btn-primary" href="#/certificate/${c.id}">${I.award} รับใบประกาศนียบัตร</a>` : '')}
          </div>
        </div>
        <aside class="player-side">
          <div class="head"><div class="t serif clamp2">${h(c.title)}</div><div class="p">${c.enrolled ? `เรียนแล้ว ${c.completedCount}/${c.lessonCount} บท` : `${c.lessonCount} บทเรียน · ${h(c.instructor)}`}</div></div>
          ${c.lessons.map((x, i) => `
            <a class="lesson-row ${x.id === l.id ? 'current' : ''}" href="#/course/${c.id}/lesson/${x.id}">
              <span class="check sm ${x.done ? 'done' : ''}" style="color:var(--accent-text)">${x.done ? I.check : ''}</span>
              <div class="t">${i + 1}. ${h(x.title)}</div>
              <span class="d">${x.durationMinutes || ''}${x.durationMinutes ? "'" : ''}</span>
            </a>`).join('')}
        </aside>
      </div>`;
    return [c.title, body];
  }

  // ---------------------------------------------------------------- dashboard
  async function pageDashboard() {
    const { courses, stats } = await api('GET', '/api/me/dashboard');
    const hours = Math.round((stats.minutesLogged / 60) * 10) / 10;
    const body = `
      <h1 class="greeting serif">สวัสดี, ${h(state.user.name)}</h1>
      <p class="subgreeting">ภาพรวมการเรียนรู้ของคุณในตอนนี้</p>
      <div class="stats">
        <div class="stat"><div class="ic">${I.book}</div><div class="v serif">${stats.inProgress}</div><div class="l">กำลังเรียน</div></div>
        <div class="stat"><div class="ic">${I.check}</div><div class="v serif">${stats.completed}</div><div class="l">เรียนจบแล้ว</div></div>
        <div class="stat"><div class="ic">${I.award}</div><div class="v serif">${stats.certificates}</div><div class="l">ใบประกาศนียบัตร</div></div>
        <div class="stat"><div class="ic">${I.clock}</div><div class="v serif">${hours} ชม.</div><div class="l">ชั่วโมงเรียนสะสม</div></div>
      </div>
      <h2 class="section-title serif" style="font-size:16px">เรียนต่อ</h2>
      ${courses.length ? `<div class="rows">${courses.map((c) => {
        const complete = c.lessonCount > 0 && c.progress >= 100;
        return `
        <a class="row-card" href="#/course/${c.id}">
          <div class="sq" style="color:var(--accent)">${I.lotus('', 0.9)}</div>
          <div class="info">
            <div class="t">${h(c.title)}</div>
            ${complete
              ? `<div class="s">${I.check.replace('<svg', '<svg style="width:14px;height:14px;color:var(--ok)"')} เรียนจบแล้ว — พร้อมรับใบประกาศนียบัตร</div>`
              : `<div class="s"><div class="progress"><div style="width:${c.progress}%"></div></div><span>${c.progress}%</span><span>· ${h(c.instructor)}</span></div>`}
          </div>
          <div class="acts">
            ${complete ? `<span class="btn btn-outline" onclick="event.preventDefault();location.hash='#/certificate/${c.id}'">ดูใบประกาศนียบัตร</span>` : `<span class="btn btn-primary">เรียนต่อ</span>`}
          </div>
        </a>`; }).join('')}</div>`
        : `<div class="empty"><h3>คุณยังไม่ได้ลงทะเบียนคอร์สใด</h3><p>เลือกคอร์สที่สนใจจากหน้าคอร์สเรียนเพื่อเริ่มต้น</p><a class="btn btn-primary" href="#/">ดูคอร์สเรียนทั้งหมด</a></div>`}`;
    return ['คอร์สของฉัน', body];
  }

  // ---------------------------------------------------------------- certificate
  async function pageCertificate(courseId) {
    const { certificate: c } = await api('GET', `/api/courses/${courseId}/certificate`);
    const body = `
      <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;gap:12px;flex-wrap:wrap">
        <a class="back" style="margin:0" href="#/dashboard">${I.back} กลับไปหน้าคอร์สของฉัน</a>
        <button class="btn btn-outline" data-action="print">${I.printer} พิมพ์ / บันทึกเป็น PDF</button>
      </div>
      <div class="certificate">
        <span class="lotus-bg" style="color:var(--navy)">${I.lotus('', 0.5)}</span>
        <div style="width:42px;height:42px;margin:0 auto 10px;color:var(--accent)">${I.lotus('', 1.3)}</div>
        <div class="eyebrow">EMC ACADEMY · CERTIFICATE OF COMPLETION</div>
        <h1 class="serif">ใบประกาศนียบัตร</h1>
        <div class="what">ขอมอบใบประกาศนียบัตรฉบับนี้เพื่อรับรองว่า</div>
        <div class="who serif">${h(c.studentName)}</div>
        <div class="what">ได้เรียนจบหลักสูตร</div>
        <div class="course-name serif">${h(c.courseTitle)}</div>
        <div class="what">จำนวน ${c.lessonCount} บทเรียน รวม ${h(minutesLabel(c.totalMinutes))} ครบถ้วนตามเกณฑ์ที่กำหนด</div>
        <div class="sig">
          <div><b>${h(c.instructor)}</b>ผู้สอน</div>
          <div style="text-align:center"><b>${h(fmtDate(c.completedAt))}</b>วันที่สำเร็จหลักสูตร</div>
          <div style="text-align:right"><b>${h(c.serial)}</b>เลขที่ใบประกาศนียบัตร</div>
        </div>
      </div>`;
    return ['ใบประกาศนียบัตร', body];
  }

  // ---------------------------------------------------------------- instructor: list
  async function pageManageList() {
    const { courses } = await api('GET', '/api/instructor/courses');
    const body = `
      <div class="manage-head">
        <div><h1 class="greeting serif" style="margin:0">คอร์สที่คุณสอน</h1><p>สร้างคอร์ส เพิ่มบทเรียนจากลิงก์ YouTube หรือ Google Drive แล้วเผยแพร่ให้ผู้เรียน</p></div>
        <a class="btn btn-primary btn-lg" href="#/manage/new">${I.plus} สร้างคอร์สใหม่</a>
      </div>
      ${courses.length ? `<div class="rows">${courses.map((c) => `
        <a class="row-card" href="#/manage/${c.id}">
          <div class="sq" style="color:var(--accent)">${I.lotus('', 0.9)}</div>
          <div class="info">
            <div class="t" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${h(c.title)} <span class="status-pill ${c.published ? 'live' : 'draft'}">${c.published ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</span></div>
            <div class="s"><span>${h(c.categoryLabel)}</span><span>· ${c.lessonCount} บทเรียน</span><span>· ${h(minutesLabel(c.totalMinutes))}</span><span>· ${c.studentCount} ผู้เรียน</span></div>
          </div>
          <div class="acts"><span class="btn btn-outline">${I.edit} จัดการ</span></div>
        </a>`).join('')}</div>`
        : `<div class="empty"><h3>คุณยังไม่มีคอร์ส</h3><p>เริ่มสร้างคอร์สแรกของคุณ แล้ววางลิงก์วิดีโอหรือเอกสารเป็นบทเรียน</p><a class="btn btn-primary" href="#/manage/new">${I.plus} สร้างคอร์สใหม่</a></div>`}`;
    return ['จัดการคอร์ส', body];
  }

  // ---------------------------------------------------------------- instructor: course form
  const LEVELS = ['เริ่มต้น', 'ระดับกลาง', 'ระดับสูง'];

  function renderCourseForm(c) {
    const v = c || { title: '', subtitle: '', description: '', category: state.categories[0]?.id || '', level: LEVELS[0], published: false };
    return `
      <a class="back" href="#/manage">${I.back} กลับไปหน้าจัดการคอร์ส</a>
      <div class="editor-layout">
        <form class="lesson-form" id="course-form" data-id="${c ? c.id : ''}" novalidate>
          <h2 class="section-title serif">${c ? 'ข้อมูลคอร์ส' : 'สร้างคอร์สใหม่'}</h2>
          <div id="course-alert"></div>
          <div class="field"><label for="c-title">ชื่อคอร์ส</label><input class="input" id="c-title" name="title" required value="${attr(v.title)}" placeholder="เช่น จักระ ศาสตร์แห่งการบำบัดและฟื้นฟู"></div>
          <div class="field"><label for="c-subtitle">คำอธิบายสั้น</label><input class="input" id="c-subtitle" name="subtitle" value="${attr(v.subtitle)}" placeholder="สรุปสิ่งที่ผู้เรียนจะได้รับใน 1 ประโยค"></div>
          <div class="form-row">
            <div class="field"><label for="c-category">หมวดหมู่</label>
              <select class="select" id="c-category" name="category">${state.categories.map((x) => `<option value="${attr(x.id)}" ${x.id === v.category ? 'selected' : ''}>${h(x.label)}</option>`).join('')}</select></div>
            <div class="field"><label for="c-level">ระดับ</label>
              <select class="select" id="c-level" name="level">${LEVELS.map((x) => `<option ${x === v.level ? 'selected' : ''}>${h(x)}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="c-desc">รายละเอียดคอร์ส</label><textarea class="textarea" id="c-desc" name="description" placeholder="อธิบายเนื้อหา กลุ่มเป้าหมาย และสิ่งที่ผู้เรียนจะทำได้หลังเรียนจบ">${h(v.description)}</textarea></div>
          <div class="field"><label class="checkbox"><input type="checkbox" name="published" ${v.published ? 'checked' : ''}> เผยแพร่คอร์สนี้ให้ผู้เรียนเห็นในหน้าคอร์สเรียน</label></div>
          <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap">
            ${c ? `<button type="button" class="btn btn-danger" data-manage="delete-course">${I.trash} ลบคอร์ส</button>` : '<span></span>'}
            <button class="btn btn-primary btn-lg" type="submit">${c ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างคอร์สและเพิ่มบทเรียน'}</button>
          </div>
        </form>
        ${c ? renderLessonManager(c) : `<div class="panel" style="margin:0"><h2 class="section-title serif">ขั้นตอนถัดไป</h2><p class="desc" style="margin:0">หลังจากสร้างคอร์สแล้ว คุณจะสามารถเพิ่มบทเรียนได้ทันที เพียงวางลิงก์ YouTube หรือ Google Drive ระบบจะแปลงเป็นสื่อที่เล่นในหน้าเรียนให้อัตโนมัติ</p><div class="paste-hint"><span>youtube.com/watch?v=…</span><span>youtu.be/…</span><span>drive.google.com/file/d/…</span><span>docs.google.com/document/…</span><span>docs.google.com/presentation/…</span></div></div>`}
      </div>`;
  }

  function renderLessonManager(c) {
    return `
      <div>
        <div class="lesson-form" id="lesson-form-wrap" style="margin-bottom:22px">
          <h2 class="section-title serif" id="lesson-form-title">เพิ่มบทเรียน</h2>
          <form id="lesson-form" data-course="${c.id}" data-lesson="" novalidate>
            <div id="lesson-alert"></div>
            <div class="field"><label for="l-title">ชื่อบทเรียน</label><input class="input" id="l-title" name="title" required placeholder="เช่น จักระคืออะไร"></div>
            <div class="field">
              <label for="l-url">ลิงก์สื่อการสอน (YouTube หรือ Google Drive)</label>
              <input class="input" id="l-url" name="resourceUrl" type="url" inputmode="url" placeholder="วางลิงก์ที่นี่ เช่น https://www.youtube.com/watch?v=… หรือ https://drive.google.com/file/d/…/view">
              <span class="hint" id="l-url-hint">รองรับ YouTube (watch, youtu.be, shorts, playlist), Google Drive (ไฟล์, โฟลเดอร์), Google Docs, Slides, Sheets และ Forms — ไฟล์ใน Drive ต้องแชร์แบบ "ทุกคนที่มีลิงก์"</span>
            </div>
            <div id="lesson-preview"></div>
            <div class="form-row">
              <div class="field"><label for="l-duration">ความยาว (นาที)</label><input class="input" id="l-duration" name="durationMinutes" type="number" min="0" step="1" placeholder="เช่น 12"></div>
            </div>
            <div class="field"><label for="l-desc">คำอธิบายบทเรียน</label><textarea class="textarea" id="l-desc" name="description" style="min-height:70px" placeholder="สรุปสิ่งที่ผู้เรียนจะได้เรียนรู้ในบทนี้"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button type="button" class="btn btn-outline hidden" id="lesson-cancel">ยกเลิกการแก้ไข</button>
              <button class="btn btn-primary" type="submit" id="lesson-submit">${I.plus} เพิ่มบทเรียน</button>
            </div>
          </form>
        </div>
        <div class="section-head"><h2 class="section-title serif">บทเรียนในคอร์ส (${c.lessons.length})</h2><a class="btn btn-ghost btn-sm" href="#/course/${c.id}">ดูมุมมองผู้เรียน ${I.next}</a></div>
        <div class="list" id="lesson-list">${renderManageLessons(c)}</div>
      </div>`;
  }

  function renderManageLessons(c) {
    if (!c.lessons.length) return `<div class="empty" style="border:none;border-radius:0"><h3>ยังไม่มีบทเรียน</h3><p>เพิ่มบทเรียนแรกด้วยการวางลิงก์ด้านบน</p></div>`;
    return c.lessons.map((l, i) => `
      <div class="manage-lesson" data-lesson-id="${l.id}">
        <span class="num">${i + 1}</span>
        <div class="t">${h(l.title)}<small>${providerTag(l)} <span>${h(minutesLabel(l.durationMinutes))}</span></small></div>
        <div class="acts">
          <button class="icon-btn" title="เลื่อนขึ้น" data-manage="move" data-dir="-1" data-id="${l.id}" ${i === 0 ? 'disabled' : ''}>${I.up}</button>
          <button class="icon-btn" title="เลื่อนลง" data-manage="move" data-dir="1" data-id="${l.id}" ${i === c.lessons.length - 1 ? 'disabled' : ''}>${I.down}</button>
          <button class="icon-btn" title="แก้ไข" data-manage="edit-lesson" data-id="${l.id}">${I.edit}</button>
          <button class="icon-btn" title="ลบ" data-manage="delete-lesson" data-id="${l.id}">${I.trash}</button>
        </div>
      </div>`).join('');
  }

  async function pageManageCourse(id) {
    const { course: c } = await api('GET', `/api/courses/${id}`);
    if (!isInstructor() || (state.user.role !== 'admin' && c.instructorId !== state.user.id)) throw new Error('คุณไม่ใช่ผู้สอนของคอร์สนี้');
    manageState.course = c;
    return [`จัดการ: ${c.title}`, renderCourseForm(c)];
  }

  const manageState = { course: null, parsed: null };

  function bindManage() {
    const cf = document.getElementById('course-form');
    if (cf) {
      cf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('course-alert');
        alertBox.innerHTML = '';
        const fd = new FormData(cf);
        const payload = { title: fd.get('title'), subtitle: fd.get('subtitle'), description: fd.get('description'), category: fd.get('category'), level: fd.get('level'), published: cf.published.checked };
        const id = cf.dataset.id;
        try {
          if (id) {
            const { course } = await api('PUT', `/api/instructor/courses/${id}`, payload);
            manageState.course = course;
            toast('บันทึกข้อมูลคอร์สแล้ว');
            document.querySelector('.topbar .title').textContent = `จัดการ: ${course.title}`;
          } else {
            const { course } = await api('POST', '/api/instructor/courses', payload);
            toast('สร้างคอร์สแล้ว เพิ่มบทเรียนได้เลย');
            go(`/manage/${course.id}`);
          }
        } catch (err) {
          alertBox.innerHTML = `<div class="alert alert-error">${h(err.message)}</div>`;
        }
      });
    }

    const content = document.getElementById('content');
    content.addEventListener('click', onManageClick);

    const lf = document.getElementById('lesson-form');
    if (!lf) return;
    const urlInput = document.getElementById('l-url');
    const preview = document.getElementById('lesson-preview');

    let t;
    async function previewUrl() {
      const url = urlInput.value.trim();
      manageState.parsed = null;
      if (!url) { preview.innerHTML = ''; return; }
      try {
        const { resource } = await api('POST', '/api/resources/parse', { url });
        manageState.parsed = resource;
        const tall = resource.provider === 'gdrive' && resource.kind !== 'file';
        preview.innerHTML = `
          <div class="preview" style="margin-bottom:16px">
            <div class="pv-head"><span style="display:flex;align-items:center;gap:8px">${providerTag(resource)} ตรวจพบลิงก์ที่รองรับ</span><a href="${attr(resource.url)}" target="_blank" rel="noopener noreferrer">${h(resource.url)}</a></div>
            <div class="frame ${tall ? 'tall' : ''}" style="${tall ? 'height:360px;min-height:0' : ''}"><iframe src="${attr(resource.embedUrl)}" title="ตัวอย่างสื่อ" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
          </div>`;
      } catch (err) {
        preview.innerHTML = `<div class="alert alert-error">${h(err.message)}</div>`;
      }
    }
    urlInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(previewUrl, 350); });
    urlInput.addEventListener('paste', () => { clearTimeout(t); t = setTimeout(previewUrl, 50); });

    document.getElementById('lesson-cancel').addEventListener('click', resetLessonForm);

    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('lesson-alert');
      alertBox.innerHTML = '';
      const fd = new FormData(lf);
      const payload = { title: fd.get('title'), resourceUrl: fd.get('resourceUrl'), durationMinutes: fd.get('durationMinutes'), description: fd.get('description') };
      const courseId = lf.dataset.course;
      const lessonId = lf.dataset.lesson;
      const btn = document.getElementById('lesson-submit');
      btn.disabled = true;
      try {
        const { course } = lessonId
          ? await api('PUT', `/api/instructor/lessons/${lessonId}`, payload)
          : await api('POST', `/api/instructor/courses/${courseId}/lessons`, payload);
        manageState.course = course;
        toast(lessonId ? 'บันทึกบทเรียนแล้ว' : 'เพิ่มบทเรียนแล้ว');
        refreshLessonList();
        resetLessonForm();
      } catch (err) {
        alertBox.innerHTML = `<div class="alert alert-error">${h(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function resetLessonForm() {
    const lf = document.getElementById('lesson-form');
    if (!lf) return;
    lf.reset();
    lf.dataset.lesson = '';
    document.getElementById('lesson-preview').innerHTML = '';
    document.getElementById('lesson-alert').innerHTML = '';
    document.getElementById('lesson-form-title').textContent = 'เพิ่มบทเรียน';
    document.getElementById('lesson-submit').innerHTML = `${I.plus} เพิ่มบทเรียน`;
    document.getElementById('lesson-cancel').classList.add('hidden');
  }

  function refreshLessonList() {
    const c = manageState.course;
    const list = document.getElementById('lesson-list');
    if (list) list.innerHTML = renderManageLessons(c);
    const head = document.querySelector('.section-head .section-title');
    if (head) head.textContent = `บทเรียนในคอร์ส (${c.lessons.length})`;
  }

  async function onManageClick(e) {
    const el = e.target.closest('[data-manage]');
    if (!el) return;
    const action = el.dataset.manage;
    const id = el.dataset.id;
    const c = manageState.course;
    try {
      if (action === 'delete-course') {
        const ok = await confirmModal({ title: 'ลบคอร์สนี้?', text: `คอร์ส "${c.title}" พร้อมบทเรียนและข้อมูลการลงทะเบียนทั้งหมดจะถูกลบถาวร`, okLabel: 'ลบคอร์ส', danger: true });
        if (!ok) return;
        await api('DELETE', `/api/instructor/courses/${c.id}`);
        toast('ลบคอร์สแล้ว');
        go('/manage');
      } else if (action === 'delete-lesson') {
        const l = c.lessons.find((x) => String(x.id) === id);
        const ok = await confirmModal({ title: 'ลบบทเรียนนี้?', text: `บทเรียน "${l.title}" จะถูกลบออกจากคอร์ส`, okLabel: 'ลบบทเรียน', danger: true });
        if (!ok) return;
        const { course } = await api('DELETE', `/api/instructor/lessons/${id}`);
        manageState.course = course;
        refreshLessonList();
        toast('ลบบทเรียนแล้ว');
      } else if (action === 'move') {
        const ids = c.lessons.map((x) => x.id);
        const i = ids.indexOf(Number(id));
        const j = i + Number(el.dataset.dir);
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        const { course } = await api('PUT', `/api/instructor/courses/${c.id}/lessons/reorder`, { lessonIds: ids });
        manageState.course = course;
        refreshLessonList();
      } else if (action === 'edit-lesson') {
        const l = c.lessons.find((x) => String(x.id) === id);
        const lf = document.getElementById('lesson-form');
        lf.dataset.lesson = l.id;
        lf.title.value = l.title;
        lf.resourceUrl.value = l.resourceUrl;
        lf.durationMinutes.value = l.durationMinutes || '';
        lf.description.value = l.description || '';
        document.getElementById('lesson-form-title').textContent = `แก้ไขบทเรียน: ${l.title}`;
        document.getElementById('lesson-submit').innerHTML = `${I.check} บันทึกบทเรียน`;
        document.getElementById('lesson-cancel').classList.remove('hidden');
        lf.resourceUrl.dispatchEvent(new Event('input'));
        document.getElementById('lesson-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  boot();
})();
