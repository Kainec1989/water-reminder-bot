import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'subscribers.json');

export async function loadSubscribers() {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const data = JSON.parse(raw);
    const map = new Map();
    for (const [id, lang] of Object.entries(data)) {
      if (typeof lang === 'string' && lang.length > 0) {
        map.set(Number(id), lang);
      }
    }
    return map;
  } catch (err) {
    if (err.code === 'ENOENT') return new Map();
    console.error('Failed to load subscribers:', err.message);
    return new Map();
  }
}

export async function saveSubscribers(activeUsers) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const data = Object.fromEntries(
    [...activeUsers.entries()].map(([id, lang]) => [String(id), lang]),
  );
  const tmp = `${STORE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, STORE_FILE);
}

export function getStorePath() {
  return STORE_FILE;
}
