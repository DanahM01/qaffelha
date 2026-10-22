# MongoDB schema (Owner: Danah setup, Leena content)

Database `qaffelha`, collection `categories`:

```json
{
  "_id": "fruits",
  "title": "فواكه",
  "answers": ["تفاح", "موز", "برتقال", "مانجو"],
  "aliases": { "برتقال": ["برتقاله"] },
  "difficulty": "easy",
  "lastUsedAt": null
}
```

- `answers`: accepted answers, already written in their common form. The server compares using `normalize()` from `server/arabic.js`.
- `aliases`: optional extra spellings that count as the same answer.
- `lastUsedAt`: lets the server prefer categories not played recently, so games don't repeat.
- Sprint 1 target: 30 categories, each with at least 15 answers.
