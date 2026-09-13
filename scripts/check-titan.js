const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const titanDir = path.join(root, 'src', 'titan');
const files = fs.readdirSync(titanDir).filter(file => file.endsWith('.js'));

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(titanDir, file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Syntax error in ${file}\n${result.stderr}`);
    process.exit(1);
  }
}

const Titan = require(titanDir);
const engine = new Titan({ workspaceRoot: root });
for (const key of ['workspace', 'executor', 'patcher', 'memory', 'git', 'council', 'loop']) {
  if (!engine[key]) throw new Error(`Titan wiring missing: ${key}`);
}

console.log(`Titan self-check passed: ${files.length} modules loaded.`);
console.log(`Model: ${engine.model.model}`);
console.log(`Workspace: ${engine.workspace.root}`);
