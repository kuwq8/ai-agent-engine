const path = require('path');

function extensionOf(file) {
  return path.extname(file).toLowerCase() || '[none]';
}

function buildProjectMap(files) {
  const byExtension = {};
  const topLevel = {};
  for (const file of files) {
    const ext = extensionOf(file);
    byExtension[ext] = (byExtension[ext] || 0) + 1;
    const first = file.split(path.sep)[0];
    topLevel[first] = (topLevel[first] || 0) + 1;
  }
  return { fileCount: files.length, byExtension, topLevel };
}

module.exports = { buildProjectMap };
