const LocalModel = require('./model');
const TitanCouncil = require('./council');
const Workspace = require('./workspace');
const Executor = require('./executor');
const MemoryStore = require('./memory-store');
const TitanLoop = require('./loop');

class TitanEngine {
  constructor(options = {}) {
    this.model = options.model || new LocalModel();
    this.workspace = options.workspace || new Workspace(options.workspaceRoot);
    this.executor = options.executor || new Executor(this.workspace);
    this.memory = options.memory || new MemoryStore(this.workspace.root);
    this.council = new TitanCouncil(this.model);
    this.loop = new TitanLoop(this);
  }

  async health() { return this.model.health(); }

  async inspect() {
    const files = await this.workspace.listFiles();
    return { root: this.workspace.root, fileCount: files.length, files };
  }

  async search(term, limit = 40) { return this.workspace.search(term, limit); }

  async analyze(task) {
    const files = await this.workspace.listFiles();
    const memory = await this.memory.load();
    const context = `Workspace: ${this.workspace.root}\nFiles (${files.length}):\n${files.slice(0, 600).join('\n')}\n\nProject memory:\n${JSON.stringify(memory)}`;
    return this.council.discuss(task, context);
  }

  async run(task) { return this.loop.run(task); }
}

module.exports = TitanEngine;
