const fs = require('fs/promises');
const path = require('path');

const MAX_EDITS = Number(process.env.TITAN_MAX_EDITS || 20);
const MAX_FILE_BYTES = 512 * 1024;
const PROTECTED = /(^|[\\/])(?:\.git|node_modules|\.titan)(?:[\\/]|$)|(^|[\\/])\.env(?:\.|$)|(^|[\\/])(?:.*\.(?:pem|key))$/i;

function safe(root, relative) {
  if (!relative || path.isAbsolute(relative) || PROTECTED.test(relative)) throw new Error(`Protected or unsafe path: ${relative}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Unsafe path: ${relative}`);
  return resolved;
}

class Patcher {
  constructor(workspace) { this.workspace = workspace; }

  async validate(edits) {
    if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_EDITS) throw new Error(`Invalid edit count (1-${MAX_EDITS}).`);
    const seen = new Set();
    for (const edit of edits) {
      if (!edit || !['write', 'delete'].includes(edit.action)) throw new Error(`Unsupported edit action: ${edit?.action}`);
      safe(this.workspace.root, edit.path);
      if (seen.has(edit.path)) throw new Error(`Duplicate edit path: ${edit.path}`);
      seen.add(edit.path);
      if (edit.action === 'write' && (typeof edit.content !== 'string' || Buffer.byteLength(edit.content, 'utf8') > MAX_FILE_BYTES)) throw new Error(`Invalid or oversized content: ${edit.path}`);
    }
    return true;
  }

  async apply(edits) {
    await this.validate(edits);
    const backups = [];
    for (const edit of edits) {
      const target = safe(this.workspace.root, edit.path);
      let original = null;
      try { original = await fs.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      backups.push({ path: edit.path, original });
    }
    try {
      for (const edit of edits) {
        const target = safe(this.workspace.root, edit.path);
        if (edit.action === 'delete') {
          await fs.rm(target, { force: true });
          continue;
        }
        await fs.mkdir(path.dirname(target), { recursive: true });
        const temp = `${target}.titan-tmp-${process.pid}-${Date.now()}`;
        try {
          await fs.writeFile(temp, edit.content, 'utf8');
          await fs.rename(temp, target);
        } finally { await fs.rm(temp, { force: true }).catch(() => {}); }
      }
      return { edits: edits.map(e => e.path), backups };
    } catch (error) {
      await this.restore(backups);
      throw error;
    }
  }

  async restore(backups) {
    for (const backup of [...backups].reverse()) {
      const target = safe(this.workspace.root, backup.path);
      if (backup.original === null) await fs.rm(target, { force: true }).catch(() => {});
      else {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, backup.original, 'utf8');
      }
    }
  }
}

module.exports = Patcher;
