const fs = require('fs');
const botConfig = require('../botConfig.js');
const { reportError, KEEP_LOGS_LOCAL } = require('./utils/debug/reportError');

const initializedClients = new WeakSet();
let moduleInitialized = false;

module.exports = (client) => {
  if (!client) throw new Error('debug.js: client parametresi gerekli');

  if (initializedClients.has(client)) return;
  initializedClients.add(client);

  if (!moduleInitialized) {
    console.log('[debug] Hata/çökme raporlama başlatıldı. Log kanalı:', botConfig && botConfig.logChannelId);
    moduleInitialized = true;
  }

  client.on('error', (err) => reportError(client, err, { event: 'client.error' }));
  client.on('shardError', (err) => reportError(client, err, { event: 'client.shardError' }));
  client.on('warn', (info) => reportError(client, new Error(info), { event: 'client.warn' }));


  client.on('rateLimit', (info) => {
    try {
      console.warn('[debug.js] client.rateLimit alındı — kanala gönderim atlandı. Info:', info);
      if (KEEP_LOGS_LOCAL) fs.appendFileSync(`./logs/rate_limit_${new Date().toISOString().slice(0,10)}.log`, `\n--- ${new Date().toISOString()} ---\n${JSON.stringify(info)}\n`);
    } catch (e) { console.error('[debug.js] rateLimit log hatası', e); }
  });

  client.on('shardDisconnect', (event, shardID) => reportError(client, new Error(`shardDisconnect ${shardID}`), { event: 'client.shardDisconnect', extra: { event, shardID } }));
  client.on('invalidated', () => reportError(client, new Error('Client invalidated (session reset)'), { event: 'client.invalidated' }));

  if (client.ws && client.ws.on) {
    try {
      client.ws.on('debug', (m) => {
        if (typeof m === 'string' && m.toLowerCase().includes('animestyle')) reportError(client, new Error(m), { event: 'ws.debug', note: 'Animestyle içerikli WS mesajı (debug)' });
      });
    } catch (e) { }
  }

  process.on('unhandledRejection', (reason, promise) => reportError(client, reason || new Error('Unhandled rejection with no reason'), { event: 'process.unhandledRejection' }));
  process.on('rejectionHandled', (promise) => reportError(client, new Error('Rejection handled after the fact'), { event: 'process.rejectionHandled' }));
  process.on('uncaughtException', (err) => reportError(client, err, { event: 'process.uncaughtException' }));
  process.on('uncaughtExceptionMonitor', (err) => reportError(client, err, { event: 'process.uncaughtExceptionMonitor' }));
  process.on('warning', (warning) => reportError(client, warning, { event: 'process.warning' }));

  const exitHandler = (signal) => async () => {
    await reportError(client, new Error(`Process terminated with signal ${signal}`), { event: `process.signal.${signal}` });
  };
  process.on('SIGINT', exitHandler('SIGINT'));
  process.on('SIGTERM', exitHandler('SIGTERM'));

  client.safeEmit = async function (fn, context = {}) {
    try { await Promise.resolve(fn()); }
    catch (err) { await reportError(client, err, Object.assign({ event: 'client.safeEmit' }, context)); }
  };

  client.wrapHandler = function (handler) {
    return async function (...args) {
      try { return await handler(...args); }
      catch (err) { await reportError(client, err, { event: 'handler.failure', extra: { args } }); }
    };
  };
};
