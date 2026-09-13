const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);

async function git(args, cwd) {
  const { stdout, stderr } = await run('git', args, { cwd, maxBuffer: 2 * 1024 * 1024 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

class GitWorkspace {
  constructor(workspace) { this.workspace = workspace; }

  async status() { return git(['status', '--short', '--branch'], this.workspace.root); }
  async diff() { return git(['diff', '--no-ext-diff'], this.workspace.root); }
  async head() { return git(['rev-parse', 'HEAD'], this.workspace.root); }
  async checkpoint(message = 'Titan checkpoint') {
    const before = await this.head();
    return { before: before.stdout, status: await this.status(), message };
  }
}

module.exports = GitWorkspace;
