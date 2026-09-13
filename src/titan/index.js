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

  async analyze(task) {
    const files = await this.workspace.listFiles();
    const memory = await this.memory.load();
    const map = buildProjectMap(files);
    const candidates = [];
    for (const term of String(task).split(/\W+/).filter(x => x.length > 2).slice(0, 8)) {
      candidates.push(...await this.workspace.search(term, 8));
    }
    const relevant = [...new Set(candidates)].slice(0, 20);
    const snippets = [];
    for (const file of relevant) {
      try { snippets.push(`\n--- ${file} ---\n${(await this.workspace.readFile(file)).slice(0, 12000)}`); } catch (_) {}
    }
    const context = `Workspace: ${this.workspace.root}\nProject map:\n${JSON.stringify(map)}\nFiles (${files.length}):\n${files.slice(0, 600).join('\n')}\n\nRelevant files:\n${snippets.join('\n')}\n\nProject memory:\n${JSON.stringify(memory)}`;
    return this.council.discuss(task, context.slice(0, 180000));
  }

  async run(task, onProgress) { return this.loop.run(task, onProgress); }
}

module.exports = TitanEngine;
