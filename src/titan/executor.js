const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const ALLOWED = new Set(['npm', 'node', 'npx', 'git']);
const BLOCKED = /(^|\s)(rm|rmdir|del|format|shutdown|reboot|mkfs|dd|sudo)(\s|$)|[;&|`<>]/i;
const PROTECTED = /(^|[\\/])(?:\.git|node_modules)(?:[\\/]|$)|(^|[\\/])\.env(?:\.|$)/i;

function safeCommand(command) {
  if (!command || BLOCKED.test(command)) throw new Error('Blocked or unsafe command.');
  const parts = command.trim().split(/\s+/);
  if (!ALLOWED.has(parts[0])) throw new Error(`Command not allowed: ${parts[0]}`);
  if (parts[0] === 'git' && /(?:reset|clean|checkout|restore|push|commit)\b/i.test(parts.slice(1).join(' '))) throw new Error('Git mutation command requires explicit higher-level handling.');
  return parts;
}

class Executor {
  constructor(workspace) { this.workspace = workspace; this.timeout = Number(process.env.TITAN_COMMAND_TIMEOUT_MS || 120000); }

  async run(command) {
    const [file, ...args] = safeCommand(command);
    try {
      const result = await execFileAsync(file, args, { cwd: this.workspace.root, timeout: this.timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
      return { command, stdout: result.stdout || '', stderr: result.stderr || '', code: 0 };
    } catch (error) {
      return { command, stdout: error.stdout || '', stderr: error.stderr || error.message, code: typeof error.code === 'number' ? error.code : 1 };
    }
  }

  async write(relative, content) {
    if (!relative || path.isAbsolute(relative) || PROTECTED.test(relative)) throw new Error(`Protected or unsafe write path: ${relative}`);
    if (typeof content !== 'string') throw new Error('File content must be a string.');
    if (Buffer.byteLength(content, 'utf8') > 512 * 1024) throw new Error('File is too large.');
    const target = path.resolve(this.workspace.root, relative);
    if (!target.startsWith(`${this.workspace.root}${path.sep}`)) throw new Error('Unsafe write path.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.titan-tmp-${process.pid}-${Date.now()}`;
    try { await fs.writeFile(temp, content, 'utf8'); await fs.rename(temp, target); }
    finally { await fs.rm(temp, { force: true }).catch(() => {}); }
    return { path: relative, bytes: Buffer.byteLength(content) };
  }
}

module.exports = Executor;
