const handleSnipe = require('./utils/messageDelete/handleSnipe');
const handleAnimePool = require('./utils/messageDelete/handleAnimePool');
const handleSticky = require('./utils/messageDelete/handleSticky');

module.exports = async (client, message) => {
  try {
    if (!message.guild) return;

    await handleSnipe(client, message);
    await handleAnimePool(client, message);
    await handleSticky(client, message);
  } catch (error) {
    console.error('messageDelete handler hata:', error);
  }
};
