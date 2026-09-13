const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'src', 'titan')).filter(f => f.endsWith('.js'));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, 'src', 'titan', file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Syntax error in ${file}\n${result.stderr}`);
    process.exit(1);
  }
}
const Titan = require(path.join(root, 'src', 'titan'));
const engine = new Titan({ workspaceRoot: root });
console.log(`Titan engine loaded. Model: ${engine.model.model}`);
console.log(`Workspace: ${engine.workspace.root}`);
