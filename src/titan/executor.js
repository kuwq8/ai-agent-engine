const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ALLOWED = new Set(['npm', 'node', 'npx', 'git']);
const BLOCKED = /(^|\s)(rm|rmdir|del|format|shutdown|reboot|mkfs|dd)(\s|$)/i;

function safeCommand(command) {
  if (!command || BLOCKED.test(command)) throw new Error('Blocked command.');
  const parts = command.trim().split(/\s+/);
  if (!ALLOWED.has(parts[0])) throw new Error(`Command not allowed: ${parts[0]}`);
  return parts;
}

class Executor {
  constructor(workspace) {
    this.workspace = workspace;
    this.timeout = Number(process.env.TITAN_COMMAND_TIMEOUT_MS || 120000);
  }

  async run(command) {
    const [file, ...args] = safeCommand(command);
    const result = await execFileAsync(file, args, {
      cwd: this.workspace.root,
      timeout: this.timeout,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    });
    return { command, stdout: result.stdout, stderr: result.stderr, code: 0 };
  }

  async write(relative, content) {
    const target = path.resolve(this.workspace.root, relative);
    if (target !== this.workspace.root && !target.startsWith(`${this.workspace.root}${path.sep}`)) throw new Error('Unsafe write path.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
    return { path: relative, bytes: Buffer.byteLength(content) };
  }
}

module.exports = Executor;
