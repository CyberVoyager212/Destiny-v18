require('events').EventEmitter.defaultMaxListeners = 400;
process.setMaxListeners(400);

const { Client, Collection, Intents } = require('discord.js');
const fs = require('fs');
const { QuickDB } = require('quick.db');

const config = require('./botConfig.js');
const debugHandler = require('./events/debug');
const items = require('./utils/items.js');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
});

client.setMaxListeners(200);

client.commands = new Collection();
client.aliases = new Collection();
client.games = new Map();

const db = new QuickDB();
client.db = db;

client.eco = {
  async fetchMoney(userId) {
    const value = await db.get(`money_${userId}`);
    return Number(value) || 0;
  },
  async addMoney(userId, amount) {
    const before = await this.fetchMoney(userId);
    const after = before + amount;
    await db.set(`money_${userId}`, after);
    return { before, after };
  },
  async removeMoney(userId, amount) {
    const before = await this.fetchMoney(userId);
    const after = Math.max(before - amount, 0);
    await db.set(`money_${userId}`, after);
    return { before, after };
  },
};

module.exports = { items };

client.config = config;
global.botName = client.config?.botname || '';

function loadCommands() {
  client.commands.clear();
  client.aliases.clear();
  fs.readdir('./commands/', (err, files) => {
    if (err) return console.error('Komut dosyaları okunamadı:', err);
    files
      .filter((f) => f.endsWith('.js'))
      .forEach((file) => {
        try {
          delete require.cache[require.resolve(`./commands/${file}`)];
          const command = require(`./commands/${file}`);
          if (command && command.help && command.help.name) {
            client.commands.set(command.help.name, command);
            if (Array.isArray(command.help.aliases)) {
              command.help.aliases.forEach((alias) => {
                client.aliases.set(alias, command.help.name);
              });
            }
          } else {
            console.warn(
              `[loadCommands] Skipping file ${file}: missing help.name`,
            );
          }
        } catch (err) {
          console.error(`[loadCommands] Error loading command ${file}:`, err);
        }
      });
  });
}

function loadEvents() {
  fs.readdir('./events/', (err, files) => {
    if (err) return console.error('Event dosyaları okunamadı:', err);
    files
      .filter((f) => f.endsWith('.js'))
      .forEach((file) => {
        delete require.cache[require.resolve(`./events/${file}`)];
        const event = require(`./events/${file}`);
        const eventName = file.split('.')[0];
        client.removeAllListeners(eventName);
        client.on(eventName, (...args) => event(client, ...args));
      });
  });
}

loadCommands();
loadEvents();

const path = require('path');

const restartFilePath = path.join(__dirname, 'restart.txt');
let _shuttingDownForRestart = false;

function _checkForRestartFileAndShutdown() {
  if (_shuttingDownForRestart) return;
  try {
    if (fs.existsSync(restartFilePath)) {
      _shuttingDownForRestart = true;
      console.log(
        '[index.js] restart.txt detected -> delete it, then graceful shutdown.',
      );

      try {
        fs.unlinkSync(restartFilePath);
        console.log('[index.js] restart.txt deleted by index.js.');
      } catch (e) {
        console.warn(
          '[index.js] could not delete restart.txt (ignored):',
          e.message,
        );
      }

      try {
        if (client && typeof client.destroy === 'function') {
          client.destroy();
          console.log('[index.js] client.destroy() called.');
        }
      } catch (err) {
        console.error('[index.js] error while destroying client:', err);
      }

      clearInterval(_restartPoll);
      setTimeout(() => {
        console.log(
          '[index.js] exiting process to allow launcher to restart cmd.',
        );
        process.exit(0);
      }, 500);
    }
  } catch (e) {
    console.warn('[index.js] restart watcher error (ignored):', e.message);
  }
}

const _restartPoll = setInterval(_checkForRestartFileAndShutdown, 1000);

process.on('exit', () => clearInterval(_restartPoll));
process.on('SIGINT', () => {
  clearInterval(_restartPoll);
  process.exit(0);
});
process.on('SIGTERM', () => {
  clearInterval(_restartPoll);
  process.exit(0);
});

client.once('ready', () => {
  console.log(`${client.user.tag} başarıyla giriş yaptı!`);

  const checkVips = async () => {
    try {
      const vips = (await db.get('vips')) || {};
      const now = Date.now();
      for (const [userId, data] of Object.entries(vips)) {
        if (data && data.expiresAt && data.expiresAt <= now) {
          await db.delete(`vips.${userId}`);
          console.log(
            `[VIP] Süre aşımı: ${userId} ID'li kullanıcının VIP süresi dolduğu için silindi.`,
          );
        }
      }
    } catch (e) {
      console.error('[VIP Kontrol Hatası]:', e);
    }
  };
  checkVips();
  setInterval(checkVips, 60 * 60 * 1000);
});

client.ws.on('debug', (info) => {
  debugHandler(client, { debug: info, shardId: client.shard?.ids[0] ?? 0 });
});

const zlib = require('zlib');
const SQLITE_FILE = path.join(__dirname, 'json.sqlite');
const BACKUP_DIR = path.join(__dirname, 'data', 'json');

let backupTimeout = null;

function formatDateTimeForFilename(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${MM}-${dd}_${hh}-${mm}-${ss}`;
}

function doBackup() {
  try {
    if (!fs.existsSync(SQLITE_FILE)) return;
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = formatDateTimeForFilename(new Date());
    const destFile = path.join(BACKUP_DIR, `backup_${timestamp}.sqlite.gz`);

    const sourceData = fs.readFileSync(SQLITE_FILE);

    const compressed = zlib.gzipSync(sourceData, {
      level: 9,
      memLevel: 9,
      windowBits: 15,
      strategy: zlib.constants.Z_DEFAULT_STRATEGY,
    });

    fs.writeFileSync(destFile, compressed);

    const originalSize = sourceData.length;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    console.log(
      `[Backup] SQLite database backed up: ${originalSize} bytes -> ${compressedSize} bytes (${ratio}% reduction)`,
    );
  } catch (err) {
    console.error('[Backup] Failed to create database backup:', err);
  }
}

if (fs.existsSync(SQLITE_FILE)) {
  fs.watch(SQLITE_FILE, (eventType) => {
    if (eventType === 'change') {
      if (backupTimeout) clearTimeout(backupTimeout);
      backupTimeout = setTimeout(doBackup, 5000);
    }
  });
  console.log('[Backup] SQLite watcher started.');
}

client.login(client.config.token).catch((err) => {
  console.error('Bot giriş yaparken hata oluştu:', err);
});
