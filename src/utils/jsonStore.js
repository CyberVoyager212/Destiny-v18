const fs = require('fs');
const path = require('path');

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

function readJSONSync(filePath, fallback = {}) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw || '');
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSONSync(filePath, obj) {
  try {
    ensureDirForFile(filePath);
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (e) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
      return true;
    } catch (e2) {
      return false;
    }
  }
}

module.exports = {
  readJSONSync,
  writeJSONSync,
};
