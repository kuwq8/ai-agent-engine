const fs = require('fs/promises');
const path = require('path');

class MemoryStore {
  constructor(workspaceRoot) {
    this.file = path.join(workspaceRoot, '.titan', 'memory.json');
  }

  async load() {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return { decisions: [], lessons: [] }; throw err; }
  }

  async add(type, entry) {
    if (!['decisions', 'lessons'].includes(type)) throw new Error('Invalid memory type.');
    const data = await this.load();
    data[type].push({ ...entry, createdAt: new Date().toISOString() });
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return data;
  }
}

module.exports = MemoryStore;
