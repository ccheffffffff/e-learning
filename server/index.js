import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { seedIfEmpty } from './seed.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const db = openDatabase();

if (process.env.SEED_DEMO !== 'false') seedIfEmpty(db);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`EMC Academy running at http://localhost:${PORT}`);
});
