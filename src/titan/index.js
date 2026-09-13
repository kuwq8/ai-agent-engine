const LocalModel = require('./model');
const TitanCouncil = require('./council');
const Workspace = require('./workspace');

class TitanEngine {
  constructor(options = {}) {
    this.model = options.model || new LocalModel();
    this.workspace = options.workspace || new Workspace(options.workspaceRoot);
    this.council = new TitanCouncil(this.model);
  }

  async health() {
    return this.model.health();
  }

  async inspect() {
    const files = await this.workspace.listFiles();
    return { root: this.workspace.root, fileCount: files.length, files };
  }

  async search(term, limit = 40) {
    return this.workspace.search(term, limit);
  }

  async analyze(task) {
    const files = await this.workspace.listFiles();
    const context = `Workspace: ${this.workspace.root}\nFiles (${files.length}):\n${files.slice(0, 600).join('\n')}`;
    return this.council.discuss(task, context);
  }
}

module.exports = TitanEngine;
