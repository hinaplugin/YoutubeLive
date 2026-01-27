const fs = require('fs');
const path = require('path');

function getStatePath(configDir) {
  return path.join(configDir, 'state.json');
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

module.exports = { getStatePath, loadState, saveState };
