const fs = require('fs');
const path = require('path');

function createLogger() {
  const logDir = process.env.LOG_DIR
    ? path.resolve(process.env.LOG_DIR)
    : path.resolve('./logs');
  const logPath = path.join(logDir, 'latest.log');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  function write(level, message, meta) {
    const ts = new Date().toISOString();
    const line = `${ts} [${level}] ${message}` + (meta ? ` ${JSON.stringify(meta)}` : '') + '\n';
    fs.appendFileSync(logPath, line, 'utf8');
  }

  return {
    info: (msg, meta) => write('INFO', msg, meta),
    warn: (msg, meta) => write('WARN', msg, meta),
    error: (msg, meta) => write('ERROR', msg, meta)
  };
}

module.exports = { createLogger };
