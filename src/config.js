const fs = require('fs');
const path = require('path');
require('dotenv').config();

function loadConfig() {
  const configPath = process.env.CONFIG_PATH
    ? path.resolve(process.env.CONFIG_PATH)
    : path.join(
        process.env.CONFIG_DIR ? path.resolve(process.env.CONFIG_DIR) : process.cwd(),
        'config.json'
      );
  const configDir = path.dirname(configPath);

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
