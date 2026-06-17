const fs = require('fs');
const path = require('path');
const { readJSONSync, writeJSONSync } = require('./jsonStore');

const DATA_DIR = path.join(__dirname, '..', 'data', 'battle');

const FILES = {
  players: path.join(DATA_DIR, 'players.json'),
  pets: path.join(DATA_DIR, 'pool.json'),
  weaponsPool: path.join(DATA_DIR, 'weapons_pool.json'),
  weaponsDb: path.join(DATA_DIR, 'weapons_db.json'),
  battleStats: path.join(DATA_DIR, 'battle_stats.json'),
};

const LEGACY = {
  players: [
    path.join(__dirname, '..', 'data', 'battle', 'players.json'),
    path.join(__dirname, '..', 'utils', 'players.json'),
  ],
  pets: [
    path.join(__dirname, '..', 'data', 'battle', 'pool.json'),
    path.join(__dirname, '..', 'utils', 'pool.json'),
  ],
  weapons: [
    path.join(__dirname, '..', 'data', 'battle', 'weapons.json'),
    path.join(__dirname, '..', 'utils', 'weapons.json'),
  ],
};

let inited = false;

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch (e) {
    return false;
  }
}

function firstExisting(paths) {
  for (const p of paths || []) {
    if (fileExists(p)) return p;
  }
  return null;
}

function isEmptyObject(o) {
  return !o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).length === 0;
}

function initBattleData() {
  if (inited) return;
  inited = true;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}

  if (!fileExists(FILES.players)) {
    const legacyPath = firstExisting(LEGACY.players);
    const legacyPlayers = legacyPath ? readJSONSync(legacyPath, {}) : {};
    writeJSONSync(FILES.players, legacyPlayers || {});
  }

  if (!fileExists(FILES.pets)) {
    const legacyPath = firstExisting(LEGACY.pets);
    const legacyPets = legacyPath ? readJSONSync(legacyPath, {}) : {};
    writeJSONSync(FILES.pets, legacyPets || {});
  }

  if (!fileExists(FILES.weaponsDb)) {
    let db = {};
    const legacyPath = firstExisting(LEGACY.weapons);
    if (legacyPath) {
      const legacy = readJSONSync(legacyPath, {});
      const { WEAPON_POOL, ...rest } = legacy || {};
      db = rest || {};
    }
    writeJSONSync(FILES.weaponsDb, db);
  }

  if (!fileExists(FILES.weaponsPool)) {
    writeJSONSync(FILES.weaponsPool, {});
  }

  if (!fileExists(FILES.battleStats)) {
    writeJSONSync(FILES.battleStats, {});
  }
}

function readPlayers() {
  initBattleData();
  return readJSONSync(FILES.players, {});
}

function writePlayers(players) {
  initBattleData();
  return writeJSONSync(FILES.players, players || {});
}

function readPetsPool() {
  initBattleData();
  return readJSONSync(FILES.pets, {});
}

function readWeaponsPool() {
  initBattleData();
  const pool = readJSONSync(FILES.weaponsPool, {});
  if (!isEmptyObject(pool)) return pool;

  const legacyPath = firstExisting(LEGACY.weapons);
  const legacy = legacyPath ? readJSONSync(legacyPath, {}) : {};
  if (legacy && legacy.WEAPON_POOL && typeof legacy.WEAPON_POOL === 'object') {
    writeJSONSync(FILES.weaponsPool, legacy.WEAPON_POOL);
    return legacy.WEAPON_POOL;
  }
  return {};
}

function writeWeaponsPool(pool) {
  initBattleData();
  return writeJSONSync(FILES.weaponsPool, pool || {});
}

function readWeaponsDb() {
  initBattleData();
  return readJSONSync(FILES.weaponsDb, {});
}

function writeWeaponsDb(db) {
  initBattleData();
  return writeJSONSync(FILES.weaponsDb, db || {});
}

function readBattleStats() {
  initBattleData();
  return readJSONSync(FILES.battleStats, {});
}

function writeBattleStats(stats) {
  initBattleData();
  return writeJSONSync(FILES.battleStats, stats || {});
}

module.exports = {
  DATA_DIR,
  FILES,
  LEGACY,
  readPlayers,
  writePlayers,
  readPetsPool,
  readWeaponsPool,
  writeWeaponsPool,
  readWeaponsDb,
  writeWeaponsDb,
  readBattleStats,
  writeBattleStats,
};
