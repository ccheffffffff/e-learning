import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'emc_session';
const SESSION_DAYS = 30;

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expires.toISOString());
  return { token, expires };
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function publicUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}

/** Express middleware: attaches req.user (or null) from the session cookie. */
export function sessionMiddleware(db) {
  const find = db.prepare(`
    SELECT u.* , s.expires_at FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `);
  return (req, _res, next) => {
    req.user = null;
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      const row = find.get(token);
      if (row && new Date(row.expires_at) > new Date()) {
        req.user = publicUser(row);
        req.sessionToken = token;
      } else if (row) {
        destroySession(db, token);
      }
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
    next();
  };
}

export function cookieOptions(expires) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    expires
  };
}
