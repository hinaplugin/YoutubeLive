const fs = require('fs');
const path = require('path');
require('dotenv').config();

function loadConfig() {
  const configDir = process.env.CONFIG_DIR
    ? path.resolve(process.env.CONFIG_DIR)
    : process.cwd();
  const configPath = path.join(configDir, 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`config.json not found at ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);

  if (!config.poll_interval_minutes || !config.channels) {
    throw new Error('config.json missing required fields: poll_interval_minutes, channels');
  }

  return { config, configDir, configPath };
}

module.exports = { loadConfig };
