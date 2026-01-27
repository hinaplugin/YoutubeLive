const fs = require('fs');
const path = require('path');

function resolveStatePath(configDir, config) {
  const liveDir = process.env.LIVE_JSON_DIR;
  if (liveDir) {
    const baseDir = path.isAbsolute(liveDir) ? liveDir : path.join(configDir, liveDir);
    return path.join(baseDir, 'live.json');
  }
  return path.join(configDir, 'live.json');
}

function loadState(statePath) {
  if (!fs.existsSync(statePath)) {
    return { videos: {} };
  }
  const raw = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(raw);
}

function saveState(statePath, state) {
  const tmpPath = `${statePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, statePath);
}

module.exports = { resolveStatePath, loadState, saveState };
