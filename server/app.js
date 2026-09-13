import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SESSION_COOKIE, hashPassword, verifyPassword, createSession, destroySession,
  publicUser, sessionMiddleware, requireAuth, requireRole, cookieOptions
} from './auth.js';
import { parseResourceUrl, SUPPORTED_HINT } from './resources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEVELS = ['เริ่มต้น', 'ระดับกลาง', 'ระดับสูง'];

function str(v, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware(db));

  // Basic security headers. Frames are needed only for the embeds we render ourselves.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'),
    categories: db.prepare('SELECT id, label FROM categories ORDER BY position'),
    courseById: db.prepare(`
      SELECT c.*, cat.label AS category_label, u.name AS instructor_name
      FROM courses c JOIN categories cat ON cat.id = c.category_id JOIN users u ON u.id = c.instructor_id
      WHERE c.id = ?`),
    lessonsByCourse: db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY position, id'),
    lessonById: db.prepare('SELECT * FROM lessons WHERE id = ?'),
    enrollment: db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?'),
    enroll: db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)'),
    completedLessonIds: db.prepare(`
      SELECT lp.lesson_id FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = ? AND l.course_id = ?`),
    complete: db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)'),
    uncomplete: db.prepare('DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ?'),
    insertCourse: db.prepare(`
      INSERT INTO courses (instructor_id, category_id, title, subtitle, description, level, published)
      VALUES (?, ?, ?, ?, ?, ?, ?)`),
    updateCourse: db.prepare(`
      UPDATE courses SET category_id = ?, title = ?, subtitle = ?, description = ?, level = ?, published = ?,
      updated_at = datetime('now') WHERE id = ?`),
    deleteCourse: db.prepare('DELETE FROM courses WHERE id = ?'),
    nextLessonPos: db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM lessons WHERE course_id = ?'),
    insertLesson: db.prepare(`
      INSERT INTO lessons (course_id, position, title, description, resource_url, resource_provider, resource_kind, embed_url, duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    updateLesson: db.prepare(`
      UPDATE lessons SET title = ?, description = ?, resource_url = ?, resource_provider = ?, resource_kind = ?,
      embed_url = ?, duration_minutes = ? WHERE id = ?`),
    setLessonPos: db.prepare('UPDATE lessons SET position = ? WHERE id = ? AND course_id = ?'),
    deleteLesson: db.prepare('DELETE FROM lessons WHERE id = ?'),
    touchCourse: db.prepare("UPDATE courses SET updated_at = datetime('now') WHERE id = ?")
  };

  // ---------- helpers ----------

  function courseSummaryList({ where = '', params = [], userId = null }) {
    const rows = db.prepare(`
      SELECT c.*, cat.label AS category_label, u.name AS instructor_name,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
        (SELECT COALESCE(SUM(duration_minutes), 0) FROM lessons l WHERE l.course_id = c.id) AS total_minutes,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count
        ${userId ? `,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.user_id = @uid) AS enrolled,
        (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
          WHERE l.course_id = c.id AND lp.user_id = @uid) AS completed_count` : ''}
      FROM courses c
      JOIN categories cat ON cat.id = c.category_id
      JOIN users u ON u.id = c.instructor_id
      ${where}
      ORDER BY c.updated_at DESC, c.id DESC
    `).all(userId ? { ...params, uid: userId } : params);
    return rows.map(shapeCourseSummary);
  }

  function shapeCourseSummary(r) {
    const lessonCount = r.lesson_count || 0;
    const completed = r.completed_count || 0;
    return {
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      level: r.level,
      published: !!r.published,
      category: r.category_id,
      categoryLabel: r.category_label,
      instructorId: r.instructor_id,
      instructor: r.instructor_name,
      lessonCount,
      totalMinutes: r.total_minutes || 0,
      studentCount: r.student_count || 0,
      enrolled: !!r.enrolled,
      completedCount: completed,
      progress: lessonCount ? Math.round((completed / lessonCount) * 100) : 0,
      updatedAt: r.updated_at,
      createdAt: r.created_at
    };
  }

  function shapeLesson(l, completedSet) {
    return {
      id: l.id,
      courseId: l.course_id,
      position: l.position,
      title: l.title,
      description: l.description,
      resourceUrl: l.resource_url,
      provider: l.resource_provider,
      kind: l.resource_kind,
      embedUrl: l.embed_url,
      durationMinutes: l.duration_minutes,
      done: completedSet ? completedSet.has(l.id) : false
    };
  }

  function courseDetail(courseId, user) {
    const c = q.courseById.get(courseId);
    if (!c) return null;
    const lessons = q.lessonsByCourse.all(courseId);
    let completedSet = null;
    let enrolled = false;
    if (user) {
      enrolled = !!q.enrollment.get(user.id, courseId);
      completedSet = new Set(q.completedLessonIds.all(user.id, courseId).map((r) => r.lesson_id));
    }
    const shaped = lessons.map((l) => shapeLesson(l, completedSet));
    const completed = shaped.filter((l) => l.done).length;
    return {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      level: c.level,
      published: !!c.published,
      category: c.category_id,
      categoryLabel: c.category_label,
      instructorId: c.instructor_id,
      instructor: c.instructor_name,
      lessonCount: shaped.length,
      totalMinutes: shaped.reduce((s, l) => s + (l.durationMinutes || 0), 0),
      studentCount: db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?').get(courseId).n,
      enrolled,
      completedCount: completed,
      progress: shaped.length ? Math.round((completed / shaped.length) * 100) : 0,
      lessons: shaped,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    };
  }

  function canManage(user, course) {
    return user && (user.role === 'admin' || (user.role === 'instructor' && course.instructor_id === user.id));
  }

  function validateCourseBody(body) {
    const title = str(body.title, 160);
    const subtitle = str(body.subtitle, 300);
    const description = str(body.description, 5000);
    const category = str(body.category, 40);
    const level = LEVELS.includes(body.level) ? body.level : LEVELS[0];
    const published = body.published ? 1 : 0;
    if (title.length < 3) return { error: 'กรุณากรอกชื่อคอร์สอย่างน้อย 3 ตัวอักษร' };
    if (!q.categories.all().some((c) => c.id === category)) return { error: 'หมวดหมู่ไม่ถูกต้อง' };
    return { value: { title, subtitle, description, category, level, published } };
  }

  function validateLessonBody(body) {
    const title = str(body.title, 200);
    const description = str(body.description, 5000);
    const resourceUrl = str(body.resourceUrl, 2000);
    let duration = parseInt(body.durationMinutes, 10);
    if (!Number.isFinite(duration) || duration < 0) duration = 0;
    if (duration > 100000) duration = 100000;
    if (title.length < 2) return { error: 'กรุณากรอกชื่อบทเรียน' };
    let parsed = null;
    if (resourceUrl) {
      parsed = parseResourceUrl(resourceUrl);
      if (!parsed) return { error: 'ลิงก์ไม่รองรับ: ' + SUPPORTED_HINT };
    }
    return {
      value: {
        title,
        description,
        resourceUrl: parsed ? parsed.url : '',
        provider: parsed ? parsed.provider : '',
        kind: parsed ? parsed.kind : '',
        embedUrl: parsed ? parsed.embedUrl : '',
        duration
      }
    };
  }

  // ---------- auth ----------

  app.post('/api/auth/register', (req, res) => {
    const name = str(req.body?.name, 80);
    const email = str(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role === 'instructor' ? 'instructor' : 'student';

    if (name.length < 2) return res.status(400).json({ error: 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    if (password.length < 8) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    if (password.length > 200) return res.status(400).json({ error: 'รหัสผ่านยาวเกินไป' });
    if (q.userByEmail.get(email)) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });

    const info = q.insertUser.run(name, email, hashPassword(password), role);
    const user = publicUser(q.userById.get(info.lastInsertRowid));
    const { token, expires } = createSession(db, user.id);
    res.cookie(SESSION_COOKIE, token, cookieOptions(expires));
    res.status(201).json({ user });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = str(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const row = q.userByEmail.get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const user = publicUser(row);
    const { token, expires } = createSession(db, user.id);
    res.cookie(SESSION_COOKIE, token, cookieOptions(expires));
    res.json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    destroySession(db, req.sessionToken);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user });
  });

  // ---------- public / student ----------

  app.get('/api/categories', (_req, res) => {
    res.json({ categories: q.categories.all() });
  });

  app.get('/api/courses', (req, res) => {
    const category = str(req.query.category, 40);
    const search = str(req.query.q, 100).toLowerCase();
    const clauses = ['c.published = 1'];
    const params = {};
    if (category && category !== 'all') { clauses.push('c.category_id = @category'); params.category = category; }
    if (search) {
      clauses.push('(lower(c.title) LIKE @search OR lower(c.subtitle) LIKE @search OR lower(u.name) LIKE @search)');
      params.search = `%${search}%`;
    }
    const courses = courseSummaryList({ where: 'WHERE ' + clauses.join(' AND '), params, userId: req.user?.id });
    res.json({ courses });
  });

  app.get('/api/courses/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const raw = q.courseById.get(id);
    if (!raw) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
    if (!raw.published && !canManage(req.user, raw)) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
    res.json({ course: courseDetail(id, req.user) });
  });

  app.post('/api/courses/:id/enroll', requireAuth, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const raw = q.courseById.get(id);
    if (!raw || !raw.published) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
    q.enroll.run(req.user.id, id);
    res.json({ course: courseDetail(id, req.user) });
  });

  app.post('/api/lessons/:id/complete', requireAuth, (req, res) => {
    const lesson = q.lessonById.get(parseInt(req.params.id, 10));
    if (!lesson) return res.status(404).json({ error: 'ไม่พบบทเรียน' });
    if (!q.enrollment.get(req.user.id, lesson.course_id)) {
      return res.status(403).json({ error: 'กรุณาลงทะเบียนคอร์สก่อน' });
    }
    if (req.body?.done === false) q.uncomplete.run(req.user.id, lesson.id);
    else q.complete.run(req.user.id, lesson.id);
    res.json({ course: courseDetail(lesson.course_id, req.user) });
  });

  app.get('/api/me/dashboard', requireAuth, (req, res) => {
    const courses = courseSummaryList({
      where: 'JOIN enrollments e ON e.course_id = c.id AND e.user_id = @uid WHERE c.published = 1',
      params: {},
      userId: req.user.id
    });
    const minutes = db.prepare(`
      SELECT COALESCE(SUM(l.duration_minutes), 0) AS m FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ?`).get(req.user.id).m;
    const completed = courses.filter((c) => c.lessonCount > 0 && c.progress >= 100);
    res.json({
      courses,
      stats: {
        inProgress: courses.length - completed.length,
        completed: completed.length,
        certificates: completed.length,
        minutesLogged: minutes
      }
    });
  });

  app.get('/api/courses/:id/certificate', requireAuth, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const course = courseDetail(id, req.user);
    if (!course || !course.enrolled) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
    if (course.lessonCount === 0 || course.progress < 100) {
      return res.status(400).json({ error: 'ต้องเรียนจบทุกบทเรียนก่อนรับใบประกาศนียบัตร' });
    }
    const last = db.prepare(`
      SELECT MAX(lp.completed_at) AS d FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = ? AND l.course_id = ?`).get(req.user.id, id).d;
    res.json({
      certificate: {
        studentName: req.user.name,
        courseTitle: course.title,
        instructor: course.instructor,
        totalMinutes: course.totalMinutes,
        lessonCount: course.lessonCount,
        completedAt: last,
        serial: `EMC-${String(id).padStart(4, '0')}-${String(req.user.id).padStart(5, '0')}`
      }
    });
  });

  // ---------- resources ----------

  app.post('/api/resources/parse', requireAuth, (req, res) => {
    const parsed = parseResourceUrl(req.body?.url);
    if (!parsed) return res.status(400).json({ error: 'ลิงก์ไม่รองรับ: ' + SUPPORTED_HINT });
    res.json({ resource: parsed });
  });

  // ---------- instructor ----------

  const instructor = express.Router();
  instructor.use(requireRole('instructor', 'admin'));

  instructor.get('/courses', (req, res) => {
    const mine = req.user.role === 'admin' ? '' : 'WHERE c.instructor_id = @uid';
    res.json({ courses: courseSummaryList({ where: mine, params: {}, userId: req.user.id }) });
  });

  instructor.post('/courses', (req, res) => {
    const v = validateCourseBody(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const { title, subtitle, description, category, level, published } = v.value;
    const info = q.insertCourse.run(req.user.id, category, title, subtitle, description, level, published);
    res.status(201).json({ course: courseDetail(info.lastInsertRowid, req.user) });
  });

  function loadOwnedCourse(req, res, next) {
    const id = parseInt(req.params.id, 10);
    const raw = q.courseById.get(id);
    if (!raw) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
    if (!canManage(req.user, raw)) return res.status(403).json({ error: 'คุณไม่ใช่ผู้สอนของคอร์สนี้' });
    req.courseRow = raw;
    next();
  }

  instructor.put('/courses/:id', loadOwnedCourse, (req, res) => {
    const v = validateCourseBody(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const { title, subtitle, description, category, level, published } = v.value;
    q.updateCourse.run(category, title, subtitle, description, level, published, req.courseRow.id);
    res.json({ course: courseDetail(req.courseRow.id, req.user) });
  });

  instructor.delete('/courses/:id', loadOwnedCourse, (req, res) => {
    q.deleteCourse.run(req.courseRow.id);
    res.json({ ok: true });
  });

  instructor.post('/courses/:id/lessons', loadOwnedCourse, (req, res) => {
    const v = validateLessonBody(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const l = v.value;
    const pos = q.nextLessonPos.get(req.courseRow.id).pos;
    q.insertLesson.run(req.courseRow.id, pos, l.title, l.description, l.resourceUrl, l.provider, l.kind, l.embedUrl, l.duration);
    q.touchCourse.run(req.courseRow.id);
    res.status(201).json({ course: courseDetail(req.courseRow.id, req.user) });
  });

  instructor.put('/courses/:id/lessons/reorder', loadOwnedCourse, (req, res) => {
    const ids = Array.isArray(req.body?.lessonIds) ? req.body.lessonIds.map((n) => parseInt(n, 10)) : [];
    const existing = q.lessonsByCourse.all(req.courseRow.id).map((l) => l.id);
    if (ids.length !== existing.length || !ids.every((id) => existing.includes(id))) {
      return res.status(400).json({ error: 'ลำดับบทเรียนไม่ถูกต้อง' });
    }
    db.transaction(() => ids.forEach((id, i) => q.setLessonPos.run(i + 1, id, req.courseRow.id)))();
    q.touchCourse.run(req.courseRow.id);
    res.json({ course: courseDetail(req.courseRow.id, req.user) });
  });

  function loadOwnedLesson(req, res, next) {
    const lesson = q.lessonById.get(parseInt(req.params.lessonId, 10));
    if (!lesson) return res.status(404).json({ error: 'ไม่พบบทเรียน' });
    const raw = q.courseById.get(lesson.course_id);
    if (!canManage(req.user, raw)) return res.status(403).json({ error: 'คุณไม่ใช่ผู้สอนของคอร์สนี้' });
    req.lessonRow = lesson;
    next();
  }

  instructor.put('/lessons/:lessonId', loadOwnedLesson, (req, res) => {
    const v = validateLessonBody(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const l = v.value;
    q.updateLesson.run(l.title, l.description, l.resourceUrl, l.provider, l.kind, l.embedUrl, l.duration, req.lessonRow.id);
    q.touchCourse.run(req.lessonRow.course_id);
    res.json({ course: courseDetail(req.lessonRow.course_id, req.user) });
  });

  instructor.delete('/lessons/:lessonId', loadOwnedLesson, (req, res) => {
    q.deleteLesson.run(req.lessonRow.id);
    q.touchCourse.run(req.lessonRow.course_id);
    res.json({ course: courseDetail(req.lessonRow.course_id, req.user) });
  });

  app.use('/api/instructor', instructor);

  // ---------- static frontend ----------

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { index: 'index.html', extensions: ['html'] }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'ไม่พบ endpoint นี้' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' });
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
  });

  return app;
}
