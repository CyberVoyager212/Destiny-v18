const cacheInvites = require('./utils/ready/cacheInvites');
const autoVC = require('./utils/ready/autoVC');
const restoreHuntTasks = require('./utils/ready/restoreHuntTasks');
const statusManager = require('./utils/ready/statusManager');

module.exports = async (client) => {
  await cacheInvites(client);
  await autoVC(client);
  await restoreHuntTasks(client);
  await statusManager(client);

  console.log(
    `[Ready] ${client.user.tag} hazır. ${client.guilds.cache.size} sunucuya bağlı.`,
  );

  setTimeout(async () => {
    const ownerId = client.config?.ownerId || client.config?.owner || '';
    const mockMsg = {
      author: { id: ownerId },
      channel: { send: () => {} },
      reply: () => {},
      guild: { id: 'auto' },
    };

    const borsaCmd = client.commands.get('borsa');
    if (borsaCmd && typeof borsaCmd.execute === 'function') {
      try {
        await borsaCmd.execute(client, mockMsg, ['tick']);
        console.log('[AutoTick] Borsa tick baslatildi.');
      } catch (err) {
        console.error('[AutoTick] Borsa tick baslatma hatasi:', err);
      }
    }

    const coinCmd = client.commands.get('coin');
    if (coinCmd && typeof coinCmd.execute === 'function') {
      try {
        await coinCmd.execute(client, mockMsg, ['tick']);
        console.log('[AutoTick] Coin tick baslatildi.');
      } catch (err) {
        console.error('[AutoTick] Coin tick baslatma hatasi:', err);
      }
    }
  }, 3000);
};
