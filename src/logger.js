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

  function formatJstYmdHm() {
    const jstMs = Date.now() + 9 * 60 * 60 * 1000;
    const jst = new Date(jstMs);
    const yyyy = jst.getUTCFullYear();
    const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jst.getUTCDate()).padStart(2, '0');
    const hh = String(jst.getUTCHours()).padStart(2, '0');
    const min = String(jst.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  function write(level, message, meta) {
    const ts = formatJstYmdHm();
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
