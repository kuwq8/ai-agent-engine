const fs = require('fs/promises');
const path = require('path');

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.cache']);
const MAX_FILE_BYTES = 512 * 1024;

async function walk(root, relative = '') {
  const dir = path.join(root, relative);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, rel));
    else files.push(rel);
  }
  return files;
}

function assertSafePath(root, relative) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Unsafe workspace path.');
  }
  return resolved;
}

class Workspace {
  constructor(root = process.env.TITAN_WORKSPACE || process.cwd()) {
    this.root = path.resolve(root);
  }

  async listFiles() { return walk(this.root); }

  async readFile(relative) {
    const file = assertSafePath(this.root, relative);
    const stat = await fs.stat(file);
    if (stat.size > MAX_FILE_BYTES) throw new Error(`File too large: ${relative}`);
    return fs.readFile(file, 'utf8');
  }

  async search(term, limit = 40) {
    const files = await this.listFiles();
    const matches = [];
    for (const relative of files) {
      if (matches.length >= limit) break;
      if (!/\.(js|cjs|mjs|ts|tsx|jsx|json|md|yml|yaml|py|go|rs|java|html|css|sql)$/i.test(relative)) continue;
      try {
        const text = await this.readFile(relative);
        if (text.toLowerCase().includes(term.toLowerCase())) matches.push(relative);
      } catch (_) {}
    }
    return matches;
  }
}

module.exports = Workspace;
