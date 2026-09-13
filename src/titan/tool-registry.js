const Workspace = require('./workspace');
const Executor = require('./executor');

class ToolRegistry {
  constructor(workspace) {
    this.workspace = workspace;
    this.executor = new Executor(workspace);
    this.tools = {
      list_files: async () => workspace.listFiles(),
      search: async ({ term, limit }) => workspace.search(term, limit || 40),
      read_file: async ({ path }) => workspace.readFile(path),
      run: async ({ command }) => this.executor.run(command),
      write_file: async ({ path, content }) => this.executor.write(path, content)
    };
  }

  has(name) { return Boolean(this.tools[name]); }
  async call(name, args = {}) {
    if (!this.has(name)) throw new Error(`Unknown Titan tool: ${name}`);
    return this.tools[name](args);
  }
}

module.exports = ToolRegistry;
