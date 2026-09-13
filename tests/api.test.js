import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seed } from '../server/seed.js';

let server;
let base;

/** Tiny cookie-jar fetch so each "user" keeps its own session. */
function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
  };
}

before(async () => {
  const db = openDatabase(':memory:');
  seed(db);
  const app = createApp(db);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('register validates input and creates a session', async () => {
  const c = client();
  let r = await c('POST', '/api/auth/register', { name: 'A', email: 'bad', password: 'short' });
  assert.equal(r.status, 400);
  r = await c('POST', '/api/auth/register', { name: 'ผู้เรียนใหม่', email: 'New@Example.com', password: 'password123' });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.email, 'new@example.com');
  assert.equal(r.data.user.role, 'student');
  r = await c('GET', '/api/auth/me');
  assert.equal(r.data.user.email, 'new@example.com');
  r = await c('POST', '/api/auth/register', { name: 'Dup', email: 'new@example.com', password: 'password123' });
  assert.equal(r.status, 409);
});

test('login rejects bad credentials and logout clears the session', async () => {
  const c = client();
  let r = await c('POST', '/api/auth/login', { email: 'student@emc.academy', password: 'wrong' });
  assert.equal(r.status, 401);
  r = await c('POST', '/api/auth/login', { email: 'student@emc.academy', password: 'password123' });
  assert.equal(r.status, 200);
  r = await c('GET', '/api/me/dashboard');
  assert.equal(r.status, 200);
  assert.ok(r.data.courses.length >= 1);
  r = await c('POST', '/api/auth/logout');
  assert.equal(r.status, 200);
  r = await c('GET', '/api/me/dashboard');
  assert.equal(r.status, 401);
});

test('catalog lists only published courses and supports category + search filters', async () => {
  const c = client();
  let r = await c('GET', '/api/courses');
  assert.equal(r.status, 200);
  assert.ok(r.data.courses.every((x) => x.published));
  const total = r.data.courses.length;
  r = await c('GET', '/api/courses?category=mind');
  assert.ok(r.data.courses.length >= 1 && r.data.courses.length < total);
  assert.ok(r.data.courses.every((x) => x.category === 'mind'));
  r = await c('GET', '/api/courses?q=' + encodeURIComponent('คริสตัล'));
  assert.equal(r.data.courses.length, 1);
});

test('student can enroll, complete lessons, and earn a certificate', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { name: 'Learner', email: 'learner@example.com', password: 'password123' });
  const list = (await c('GET', '/api/courses')).data.courses;
  const course = list.find((x) => !x.enrolled);
  const lesson = (await c('GET', `/api/courses/${course.id}`)).data.course.lessons[0];

  // must enroll first
  let r = await c('POST', `/api/lessons/${lesson.id}/complete`);
  assert.equal(r.status, 403);
  r = await c('GET', `/api/courses/${course.id}/certificate`);
  assert.equal(r.status, 404);

  r = await c('POST', `/api/courses/${course.id}/enroll`);
  assert.equal(r.status, 200);
  assert.equal(r.data.course.enrolled, true);

  for (const l of r.data.course.lessons) {
    r = await c('POST', `/api/lessons/${l.id}/complete`, { done: true });
    assert.equal(r.status, 200);
  }
  assert.equal(r.data.course.progress, 100);

  r = await c('GET', `/api/courses/${course.id}/certificate`);
  assert.equal(r.status, 200);
  assert.equal(r.data.certificate.courseTitle, course.title);
  assert.equal(r.data.certificate.studentName, 'Learner');

  // undo one lesson -> certificate no longer available
  r = await c('POST', `/api/lessons/${lesson.id}/complete`, { done: false });
  assert.equal(r.data.course.progress, 75);
  r = await c('GET', `/api/courses/${course.id}/certificate`);
  assert.equal(r.status, 400);

  const dash = (await c('GET', '/api/me/dashboard')).data;
  assert.equal(dash.stats.inProgress, 1);
  assert.ok(dash.stats.minutesLogged > 0);
});

test('instructor can create a course, add YouTube/Drive lessons, reorder, publish and delete', async () => {
  const student = client();
  await student('POST', '/api/auth/login', { email: 'student@emc.academy', password: 'password123' });
  let r = await student('POST', '/api/instructor/courses', { title: 'Nope', category: 'body' });
  assert.equal(r.status, 403, 'students cannot create courses');

  const inst = client();
  await inst('POST', '/api/auth/register', { name: 'ครูใหม่', email: 'teacher@example.com', password: 'password123', role: 'instructor' });

  r = await inst('POST', '/api/instructor/courses', { title: 'AB', category: 'body' });
  assert.equal(r.status, 400, 'title too short');
  r = await inst('POST', '/api/instructor/courses', { title: 'คอร์สทดสอบ', subtitle: 'sub', category: 'body', level: 'ระดับกลาง', published: false });
  assert.equal(r.status, 201);
  const courseId = r.data.course.id;
  assert.equal(r.data.course.published, false);

  // drafts are hidden from the public catalog and from other users
  const pub = (await student('GET', '/api/courses')).data.courses;
  assert.ok(!pub.some((x) => x.id === courseId));
  r = await student('GET', `/api/courses/${courseId}`);
  assert.equal(r.status, 404);
  r = await inst('GET', `/api/courses/${courseId}`);
  assert.equal(r.status, 200, 'owner can view own draft');

  // parse endpoint
  r = await inst('POST', '/api/resources/parse', { url: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.equal(r.status, 200);
  assert.equal(r.data.resource.provider, 'youtube');
  r = await inst('POST', '/api/resources/parse', { url: 'https://example.com/x' });
  assert.equal(r.status, 400);

  // add lessons
  r = await inst('POST', `/api/instructor/courses/${courseId}/lessons`, { title: 'บทที่ 1', resourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', durationMinutes: 12 });
  assert.equal(r.status, 201);
  r = await inst('POST', `/api/instructor/courses/${courseId}/lessons`, { title: 'บทที่ 2', resourceUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing', durationMinutes: 8 });
  assert.equal(r.status, 201);
  r = await inst('POST', `/api/instructor/courses/${courseId}/lessons`, { title: 'บทที่ 3', resourceUrl: 'https://vimeo.com/123' });
  assert.equal(r.status, 400, 'unsupported link rejected');
  let lessons = r.data && r.data.course ? r.data.course.lessons : (await inst('GET', `/api/courses/${courseId}`)).data.course.lessons;
  assert.equal(lessons.length, 2);
  assert.equal(lessons[0].provider, 'youtube');
  assert.equal(lessons[1].provider, 'gdrive');
  assert.equal(lessons[1].embedUrl, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview');

  // reorder
  r = await inst('PUT', `/api/instructor/courses/${courseId}/lessons/reorder`, { lessonIds: [lessons[1].id, lessons[0].id] });
  assert.equal(r.status, 200);
  assert.equal(r.data.course.lessons[0].id, lessons[1].id);
  r = await inst('PUT', `/api/instructor/courses/${courseId}/lessons/reorder`, { lessonIds: [lessons[1].id] });
  assert.equal(r.status, 400);

  // edit lesson
  r = await inst('PUT', `/api/instructor/lessons/${lessons[0].id}`, { title: 'บทที่ 1 (แก้ไข)', resourceUrl: '', durationMinutes: 5 });
  assert.equal(r.status, 200);
  const edited = r.data.course.lessons.find((l) => l.id === lessons[0].id);
  assert.equal(edited.title, 'บทที่ 1 (แก้ไข)');
  assert.equal(edited.provider, '');

  // another instructor cannot touch it
  const other = client();
  await other('POST', '/api/auth/login', { email: 'instructor@emc.academy', password: 'password123' });
  r = await other('PUT', `/api/instructor/courses/${courseId}`, { title: 'Hijack', category: 'body' });
  assert.equal(r.status, 403);
  r = await other('DELETE', `/api/instructor/lessons/${lessons[0].id}`);
  assert.equal(r.status, 403);

  // publish -> visible and enrollable
  r = await inst('PUT', `/api/instructor/courses/${courseId}`, { title: 'คอร์สทดสอบ', category: 'body', level: 'ระดับกลาง', published: true });
  assert.equal(r.data.course.published, true);
  r = await student('POST', `/api/courses/${courseId}/enroll`);
  assert.equal(r.status, 200);
  const mine = (await inst('GET', '/api/instructor/courses')).data.courses;
  assert.equal(mine.find((x) => x.id === courseId).studentCount, 1);

  // delete lesson & course
  r = await inst('DELETE', `/api/instructor/lessons/${lessons[1].id}`);
  assert.equal(r.data.course.lessons.length, 1);
  r = await inst('DELETE', `/api/instructor/courses/${courseId}`);
  assert.equal(r.status, 200);
  r = await student('GET', `/api/courses/${courseId}`);
  assert.equal(r.status, 404);
});

test('unknown API routes return JSON 404 and the SPA is served for app routes', async () => {
  const c = client();
  let r = await c('GET', '/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.ok(r.data.error);
  const res = await fetch(base + '/some/client/route');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<div id="app">/);
});
