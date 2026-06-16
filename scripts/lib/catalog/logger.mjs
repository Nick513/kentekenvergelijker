// Minimal console logger for catalog dev scripts.

function stamp(level) {
  return `[${new Date().toISOString()}] ${level}`;
}

export const logger = {
  info(message) {
    console.log(`${stamp("INFO")} ${message}`);
  },
  warn(message) {
    console.warn(`${stamp("WARN")} ${message}`);
  },
  error(message) {
    console.error(`${stamp("ERROR")} ${message}`);
  },
};
