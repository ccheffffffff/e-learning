import { openDatabase } from './db.js';
import { hashPassword } from './auth.js';
import { parseResourceUrl } from './resources.js';

/**
 * Demo content. Video links point at well-known public YouTube videos so the
 * player has something real to embed; instructors replace them with their
 * own YouTube / Google Drive links from the course manager.
 */
const DEMO_VIDEOS = [
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'https://youtu.be/aqz-KE-bpKQ',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=9bZkp7q19f0',
  'https://www.youtube.com/watch?v=kJQP7kiw5Fk'
];

export const DEMO_ACCOUNTS = {
  instructor: { name: 'อ.วรรณภา ประจักษ์ทิพย์', email: 'instructor@emc.academy', password: 'password123', role: 'instructor' },
  student: { name: 'ศิริพร ใจดี', email: 'student@emc.academy', password: 'password123', role: 'student' }
};

const INSTRUCTORS = [
  DEMO_ACCOUNTS.instructor,
  { name: 'อ.กันยา ศิวะรักษ์', email: 'kanya@emc.academy', password: 'password123', role: 'instructor' },
  { name: 'อ.ปิยะดา เจริญสุข', email: 'piyada@emc.academy', password: 'password123', role: 'instructor' },
  { name: 'อ.ธีรเดช วงศ์สว่าง', email: 'teeradech@emc.academy', password: 'password123', role: 'instructor' },
  { name: 'อ.มาลี สุขสมบูรณ์', email: 'malee@emc.academy', password: 'password123', role: 'instructor' },
  { name: 'อ.นภัสสร กิตติคุณ', email: 'napassorn@emc.academy', password: 'password123', role: 'instructor' }
];

const COURSES = [
  {
    instructor: 0, category: 'energy', level: 'เริ่มต้น',
    title: 'จักระ ศาสตร์แห่งการบำบัดและฟื้นฟู',
    subtitle: 'เข้าใจระบบพลังงาน 7 จักระ และเทคนิคปรับสมดุลด้วยตนเอง',
    description: 'คอร์สนี้พาคุณทำความรู้จักระบบพลังงานทั้ง 7 จักระตั้งแต่พื้นฐาน เรียนรู้วิธีสังเกตความไม่สมดุล และฝึกเทคนิคปรับสมดุลด้วยการหายใจและสมาธิที่ทำได้เองที่บ้าน',
    lessons: [
      ['จักระคืออะไร เข้าใจศาสตร์แห่งพลังงานร่างกาย', 8],
      ['จักระทั้ง 7 ตำแหน่งและความหมาย', 14],
      ['วิธีตรวจสอบสมดุลจักระด้วยตนเอง', 11],
      ['เทคนิคปรับสมดุลจักระเบื้องต้นด้วยการทำสมาธิ', 17]
    ],
    enrollDemo: 2
  },
  {
    instructor: 1, category: 'body', level: 'ระดับกลาง',
    title: 'พลังงานบำบัดเพื่อสุขภาพแบบองค์รวม',
    subtitle: 'Holistic Health การแพทย์แห่งอนาคตเพื่อกาย ใจ และพลังงาน',
    description: 'สำรวจแนวคิด Holistic Health ที่มองสุขภาพเป็นองค์รวมของกาย ใจ และพลังงาน พร้อมเครื่องมือออกแบบกิจวัตรดูแลตนเองที่ยั่งยืน',
    lessons: [
      ['Holistic Health คืออะไร', 8],
      ['ระบบพลังงานละเอียดอ่อนของร่างกาย', 11],
      ['เทคนิคกระตุ้นความสามารถในการรักษาตัวเอง', 13],
      ['ออกแบบกิจวัตรดูแลสุขภาพแบบองค์รวม', 10]
    ],
    enrollDemo: 4
  },
  {
    instructor: 2, category: 'mind', level: 'เริ่มต้น',
    title: 'ฝึกสติเพื่อสมาธิและคลายเครียด',
    subtitle: 'เทคนิคเจริญสติที่ใช้ได้จริงในชีวิตประจำวันและวัยทำงาน',
    description: 'เรียนรู้การเจริญสติแบบเป็นขั้นตอน ตั้งแต่การสังเกตลมหายใจไปจนถึงการรับมือกับความคิดฟุ้งซ่านในที่ทำงาน',
    lessons: [
      ['เริ่มต้นฝึกสติในชีวิตประจำวัน', 6],
      ['สมาธิเพื่อคลายเครียดใน 10 นาที', 10],
      ['การรับมือกับความคิดฟุ้งซ่าน', 13],
      ['สร้างกรอบความคิดแบบเติบโตผ่านสติ', 16]
    ],
    enrollDemo: 1
  },
  {
    instructor: 3, category: 'spirit', level: 'ระดับกลาง',
    title: 'ฟื้นฟูพลังจิตวิญญาณจากภายใน',
    subtitle: 'ทำความเข้าใจสัญญาณความอ่อนล้าทางจิตใจก่อนจะกลายเป็นความเหนื่อยล้าเรื้อรัง',
    description: 'รู้จักสัญญาณเตือนของความอ่อนล้าทางจิตวิญญาณ และฝึกเทคนิคเยียวยาตนเองในระยะยาว',
    lessons: [
      ['12 สัญญาณความอ่อนล้าทางจิตวิญญาณ', 9],
      ['เข้าใจสุขภาพทางอารมณ์', 12],
      ['เทคนิคลดความเครียดด้วยตนเอง', 14],
      ['การเยียวยาจิตใจในระยะยาว', 14]
    ]
  },
  {
    instructor: 4, category: 'relationship', level: 'เริ่มต้น',
    title: 'สร้างความสัมพันธ์ที่ดีเพื่อสุขภาพใจ',
    subtitle: 'ทักษะการสร้างและรักษาความสัมพันธ์ที่ส่งเสริมสุขภาพกายและใจ',
    description: 'ความสัมพันธ์ที่ดีคือยาขนานเอกของสุขภาพใจ คอร์สนี้สอนทักษะการสื่อสารและการดูแลความสัมพันธ์ให้ยั่งยืน',
    lessons: [
      ['ลักษณะของความสัมพันธ์ที่ดีต่อสุขภาพ', 8],
      ['ทักษะการสร้างและรักษามิตรภาพ', 10],
      ['5 สิ่งจำเป็นสำหรับความสัมพันธ์ที่ดี', 9],
      ['ความรักห้าประการที่ดีต่อสุขภาพ', 12]
    ],
    enrollDemo: 2
  },
  {
    instructor: 5, category: 'wellbeing', level: 'เริ่มต้น',
    title: 'คริสตัลบำบัด ศาสตร์แห่งพลังหิน',
    subtitle: 'รู้จักการใช้คริสตัลบำบัดอย่างถูกวิธีเพื่อเสริมความเป็นอยู่ที่ดี',
    description: 'แนะนำคริสตัลบำบัดตั้งแต่พื้นฐาน การเลือกหิน วิธีใช้ในชีวิตประจำวัน และข้อควรระวัง',
    lessons: [
      ['รู้จักคริสตัลบำบัดเบื้องต้น', 8],
      ['การเลือกหินให้เหมาะกับตัวเอง', 10],
      ['วิธีใช้คริสตัลบำบัดในชีวิตประจำวัน', 11],
      ['ข้อควรระวังก่อนใช้คริสตัลบำบัด', 7]
    ]
  }
];

export function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (n > 0) return false;
  seed(db);
  return true;
}

export function seed(db) {
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  const insertCourse = db.prepare(`
    INSERT INTO courses (instructor_id, category_id, title, subtitle, description, level, published)
    VALUES (?, ?, ?, ?, ?, ?, 1)`);
  const insertLesson = db.prepare(`
    INSERT INTO lessons (course_id, position, title, description, resource_url, resource_provider, resource_kind, embed_url, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const enroll = db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)');
  const complete = db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)');

  db.transaction(() => {
    const instructorIds = INSTRUCTORS.map((u) => insertUser.run(u.name, u.email, hashPassword(u.password), u.role).lastInsertRowid);
    const s = DEMO_ACCOUNTS.student;
    const studentId = insertUser.run(s.name, s.email, hashPassword(s.password), s.role).lastInsertRowid;

    let vi = 0;
    COURSES.forEach((c) => {
      const courseId = insertCourse.run(instructorIds[c.instructor], c.category, c.title, c.subtitle, c.description, c.level).lastInsertRowid;
      const lessonIds = c.lessons.map(([title, minutes], i) => {
        const r = parseResourceUrl(DEMO_VIDEOS[vi++ % DEMO_VIDEOS.length]);
        return insertLesson.run(
          courseId, i + 1, title,
          `บทเรียนนี้เป็นส่วนหนึ่งของคอร์ส ${c.title} ความยาวประมาณ ${minutes} นาที เรียนตามจังหวะของคุณเองได้ทุกที่ทุกเวลา`,
          r.url, r.provider, r.kind, r.embedUrl, minutes
        ).lastInsertRowid;
      });
      if (c.enrollDemo) {
        enroll.run(studentId, courseId);
        lessonIds.slice(0, c.enrollDemo).forEach((id) => complete.run(studentId, id));
      }
    });
  })();
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const db = openDatabase();
  if (seedIfEmpty(db)) console.log('Seeded demo data.');
  else console.log('Database already has users; skipping seed. Delete data/emc-academy.db to reseed.');
}
