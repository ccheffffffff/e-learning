# EMC Academy — e-learning platform

แพลตฟอร์มเรียนออนไลน์ที่ผู้สอน **วางลิงก์ YouTube หรือ Google Drive** เป็นสื่อการสอนได้ทันที
พร้อมระบบสมัครสมาชิก / เข้าสู่ระบบ การลงทะเบียนคอร์ส ติดตามความคืบหน้า และใบประกาศนียบัตร

An e-learning platform where instructors build courses by pasting **YouTube or Google Drive links**
as lesson content. Includes register/login, enrollment, progress tracking, certificates, and an
instructor course manager. UI follows the "EMC Academy" design (dark navy sidebar, gold accent, Thai UI).

## Features

**Learners**
- Register / login / logout (session cookies, bcrypt-hashed passwords)
- Course catalog with category filter and live search
- Course detail page with curriculum and enrollment
- Lesson player that embeds the pasted resource (YouTube video/playlist, Drive file/folder, Docs, Slides, Sheets, Forms)
- Mark lessons complete, resume where you left off, per-course progress
- Dashboard with in-progress / completed counts and hours logged
- Printable certificate once every lesson in a course is completed

**Instructors** (choose "ผู้สอน" when registering)
- Create, edit, publish/unpublish and delete courses
- Add lessons by pasting a link — the link is validated and previewed inline before saving
- Edit, reorder and delete lessons
- Drafts are hidden from learners until published

## Supported resource links

| Provider | Accepted URL shapes | Embedded as |
| --- | --- | --- |
| YouTube | `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, `/embed/…`, `/live/…` (with optional `t=` timestamp) | `youtube.com/embed/<id>` |
| YouTube playlist | `youtube.com/playlist?list=…` | `embed/videoseries?list=…` |
| Google Drive file | `drive.google.com/file/d/<id>/view`, `/open?id=…`, `/uc?id=…` | `file/d/<id>/preview` |
| Google Drive folder | `drive.google.com/drive/folders/<id>` | `embeddedfolderview?id=<id>` |
| Google Docs / Sheets | `docs.google.com/document/d/<id>`, `spreadsheets/d/<id>` | `…/preview` |
| Google Slides | `docs.google.com/presentation/d/<id>` | `…/embed` |
| Google Forms | `docs.google.com/forms/d/<id>` or `/d/e/<id>` | `…/viewform?embedded=true` |

Drive files must be shared as **"Anyone with the link"** for the embed to load for learners.

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

The first start creates `data/emc-academy.db` (SQLite) and seeds demo content.

**Demo accounts** (password `password123`)

| Role | Email |
| --- | --- |
| Learner | `student@emc.academy` |
| Instructor | `instructor@emc.academy` |

Other scripts:

```bash
npm run dev        # restart on file changes
npm test           # API + link-parser tests (node:test, in-memory DB)
npm run seed       # seed demo data into an empty database
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_FILE` | `data/emc-academy.db` | SQLite file path (`:memory:` for ephemeral) |
| `SEED_DEMO` | `true` | Set to `false` to skip seeding demo data on first start |
| `COOKIE_SECURE` | `false` | Set to `true` behind HTTPS so the session cookie is `Secure` |

## Project layout

```
server/
  index.js      entry point (opens DB, seeds, starts Express)
  app.js        REST API + static file serving
  auth.js       password hashing, sessions, role guards
  db.js         SQLite schema and connection
  resources.js  YouTube / Google Drive link parser -> embed URL
  seed.js       demo accounts and courses
public/
  index.html    SPA shell
  app.js        frontend (hash router, all views, no build step)
  styles.css    design tokens and components
tests/
  api.test.js        end-to-end API tests against an in-memory database
  resources.test.js  link parser tests
```

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | `{name,email,password,role?}` role = `student` (default) or `instructor` |
| POST | `/api/auth/login` · `/api/auth/logout` | |
| GET | `/api/auth/me` | current user or `null` |
| GET | `/api/categories` | |
| GET | `/api/courses?category=&q=` | published courses (+ progress when logged in) |
| GET | `/api/courses/:id` | course with lessons; drafts visible to owner only |
| POST | `/api/courses/:id/enroll` | auth |
| POST | `/api/lessons/:id/complete` | `{done:true|false}`, requires enrollment |
| GET | `/api/me/dashboard` | enrolled courses + stats |
| GET | `/api/courses/:id/certificate` | only when progress is 100% |
| POST | `/api/resources/parse` | `{url}` → normalized resource + embed URL |
| GET/POST | `/api/instructor/courses` | instructor/admin |
| PUT/DELETE | `/api/instructor/courses/:id` | owner only |
| POST | `/api/instructor/courses/:id/lessons` | add lesson (link validated server-side) |
| PUT | `/api/instructor/courses/:id/lessons/reorder` | `{lessonIds:[…]}` |
| PUT/DELETE | `/api/instructor/lessons/:lessonId` | owner only |

## Notes

- Demo lesson videos point at well-known public YouTube videos as placeholders; replace them from the instructor manager.
- To grant a user the `admin` role (sees and manages all courses), update the `users.role` column directly in SQLite.
