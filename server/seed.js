// Owner: Leena (content) / Danah (connection). Loads categories.json into MongoDB Atlas.
// Run from repo root: npm run seed (reads database/categories.json)
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

const categories = JSON.parse(await readFile(new URL('../database/categories.json', import.meta.url)));
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const col = client.db().collection('categories');
for (const c of categories) await col.replaceOne({ _id: c._id }, c, { upsert: true });
console.log(`Seeded ${categories.length} categories`);
await client.close();
