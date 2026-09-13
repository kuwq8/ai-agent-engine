const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const BLOCKED = /[;&|`<>\n\r]|\$\(|(^|\s)(rm|rmdir|del|format|shutdown|reboot|mkfs|dd|sudo)(\s|$)/i;
const SAFE_COMMANDS = [
  /^npm\s+(?:test|run\s+(?:test|lint|build|typecheck|check:titan))$/i,
  /^node\s+--check\s+[\w./\\-]+$/i
];
const PROTECTED = /(^|[\\/])(?:\.git|node_modules|\.titan)(?:[\\/]|$)|(^|[\\/])\.env(?:\.|$)/i;

function safeCommand(command) {
  const value = String(command || '').trim();
  if (!value || value.length > 300 || BLOCKED.test(value)) throw new Error('Blocked or unsafe command.');
  if (!SAFE_COMMANDS.some(pattern => pattern.test(value))) throw new Error(`Command not allowed: ${value}`);
  const filePath = value.match(/^node\s+--check\s+(.+)$/i)?.[1];
  if (filePath && PROTECTED.test(filePath)) throw new Error('Protected path cannot be checked.');
  return value.split(/\s+/);
}

class Executor {
  constructor(workspace) {
    this.workspace = workspace;
    this.timeout = Number(process.env.TITAN_COMMAND_TIMEOUT_MS || 120000);
  }

  async run(command) {
    const [file, ...args] = safeCommand(command);
    const started = Date.now();
    try {
      const result = await execFileAsync(file, args, {
        cwd: this.workspace.root,
        timeout: this.timeout,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true
      });
      return { command, stdout: result.stdout || '', stderr: result.stderr || '', code: 0, durationMs: Date.now() - started };
    } catch (error) {
      return { command, stdout: error.stdout || '', stderr: error.stderr || error.message, code: typeof error.code === 'number' ? error.code : 1, durationMs: Date.now() - started };
    }
  }
}

module.exports = Executor;
