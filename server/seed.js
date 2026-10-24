// Owner: Leena. Load the reviewed category content into MongoDB Atlas.
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { normalize } from './arabic.js';

const categories = JSON.parse(await readFile(new URL('../database/categories.json', import.meta.url), 'utf8'));
if (!Array.isArray(categories) || categories.length !== 30) throw new Error('Expected 30 categories');
const ids = new Set();
for (const category of categories) {
  if (typeof category._id !== 'string' || !category._id.trim() || ids.has(category._id)) {
    throw new Error('Category IDs must be nonempty and unique');
  }
  ids.add(category._id);
  if (typeof category.title !== 'string' || !category.title.trim() ||
      !Array.isArray(category.answers) || category.answers.length < 20) {
    throw new Error(`Invalid title or fewer than 20 answers: ${category._id}`);
  }
  const accepted = new Set();
  for (const answer of category.answers) {
    if (typeof answer !== 'string' || !normalize(answer) || normalize(answer).length > 40 || accepted.has(normalize(answer))) {
      throw new Error(`Invalid or duplicate answer: ${category._id}`);
    }
    accepted.add(normalize(answer));
  }
  for (const [canonical, aliases] of Object.entries(category.aliases || {})) {
    if (!category.answers.includes(canonical) || !Array.isArray(aliases)) throw new Error(`Invalid alias group: ${category._id}`);
    for (const alias of aliases) {
      if (typeof alias !== 'string' || !normalize(alias) || normalize(alias).length > 40 || accepted.has(normalize(alias))) {
        throw new Error(`Invalid or conflicting alias: ${category._id}`);
      }
      accepted.add(normalize(alias));
    }
  }
}

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env before seeding');
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const col = client.db().collection('categories');
  // Updating content must not erase the existing category usage history.
  await col.bulkWrite(categories.map(({ _id, lastUsedAt, ...content }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: content, $setOnInsert: { lastUsedAt: lastUsedAt ?? null } },
      upsert: true,
    },
  })));
  console.log(`Seeded ${categories.length} categories`);
} finally {
  await client.close();
}
