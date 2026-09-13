const fs = require('fs/promises');
const path = require('path');

const MAX_ENTRIES = Number(process.env.TITAN_MAX_MEMORY_ENTRIES || 500);

function words(value) {
  return new Set(String(value || '').toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(x => x.length > 2));
}

function score(task, entry) {
  const target = words(task);
  const text = `${entry.task || ''} ${entry.summary || ''} ${(entry.files || []).join(' ')}`;
  let hits = 0;
  for (const word of words(text)) if (target.has(word)) hits += 1;
  return hits;
}

class MemoryStore {
  constructor(workspaceRoot) {
    this.file = path.join(workspaceRoot, '.titan', 'memory.json');
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      return { decisions: Array.isArray(data.decisions) ? data.decisions : [], lessons: Array.isArray(data.lessons) ? data.lessons : [] };
    } catch (err) {
      if (err.code === 'ENOENT') return { decisions: [], lessons: [] };
      throw err;
    }
  }

  async relevant(task, limit = 8) {
    const data = await this.load();
    return [...data.decisions.map(x => ({ ...x, type: 'decision' })), ...data.lessons.map(x => ({ ...x, type: 'lesson' }))]
      .map((entry, index) => ({ entry, score: score(task, entry), index }))
      .sort((a, b) => b.score - a.score || b.index - a.index)
      .slice(0, limit)
      .map(x => x.entry);
  }

  async add(type, entry) {
    if (!['decisions', 'lessons'].includes(type)) throw new Error('Invalid memory type.');
    const data = await this.load();
    data[type].push({ ...entry, createdAt: new Date().toISOString() });
    data[type] = data[type].slice(-MAX_ENTRIES);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp-${process.pid}-${Date.now()}`;
    try {
      await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      await fs.rename(temp, this.file);
    } finally { await fs.rm(temp, { force: true }).catch(() => {}); }
    return data;
  }
}

module.exports = MemoryStore;
