const LocalModel = require('./model');
const TitanCouncil = require('./council');
const Workspace = require('./workspace');
const Executor = require('./executor');
const Patcher = require('./patcher');
const MemoryStore = require('./memory-store');
const GitWorkspace = require('./git');
const TitanLoop = require('./loop');
const { buildProjectMap } = require('./project-map');

class TitanEngine {
  constructor(options = {}) {
    this.model = options.model || new LocalModel();
    this.workspace = options.workspace || new Workspace(options.workspaceRoot);
    this.executor = options.executor || new Executor(this.workspace);
    this.patcher = options.patcher || new Patcher(this.workspace);
    this.memory = options.memory || new MemoryStore(this.workspace.root);
    this.git = options.git || new GitWorkspace(this.workspace);
    this.council = new TitanCouncil(this.model);
    this.loop = new TitanLoop(this);
  }

  async health() { return this.model.health(); }

  async inspect() {
    const files = await this.workspace.listFiles();
    return { root: this.workspace.root, fileCount: files.length, files, map: buildProjectMap(files) };
  }

  async search(term, limit = 40) { return this.workspace.search(term, limit); }

  async status() {
    const [healthy, inspection, gitStatus, head] = await Promise.all([
      this.health().catch(() => false),
      this.inspect(),
      this.git.status().catch(e => ({ stdout: '', stderr: e.message })),
      this.git.head().catch(e => ({ stdout: '', stderr: e.message }))
    ]);
    return { model: this.model.model, ollama: healthy, workspace: inspection.root, fileCount: inspection.fileCount, git: gitStatus, head: head.stdout };
  }

  async buildContext(task) {
    const files = await this.workspace.listFiles();
    const memory = await this.memory.relevant(task, 8);
    const map = buildProjectMap(files);
    const terms = [...new Set(String(task).split(/[^\p{L}\p{N}_]+/u).filter(x => x.length > 2))].slice(0, 10);
    const candidates = [];
    for (const term of terms) candidates.push(...await this.workspace.search(term, 8));
    const relevant = [...new Set(candidates)].slice(0, 24);
    const snippets = [];
    for (const file of relevant) {
      try { snippets.push(`\n--- ${file} ---\n${(await this.workspace.readFile(file)).slice(0, 12000)}`); } catch (_) {}
    }
    return `Workspace: ${this.workspace.root}\nProject map:\n${JSON.stringify(map)}\nFiles (${files.length}):\n${files.slice(0, 800).join('\n')}\n\nRelevant files:\n${snippets.join('\n')}\n\nRelevant project memory:\n${JSON.stringify(memory)}`.slice(0, 180000);
  }

  async analyze(task) {
    return this.council.discuss(task, await this.buildContext(task));
  }

  async reviewFinal(task, diff) {
    return this.council.finalReview(task, typeof diff === 'string' ? diff : (diff.stdout || ''));
  }

  async run(task, onProgress) { return this.loop.run(task, onProgress); }
}

module.exports = TitanEngine;
