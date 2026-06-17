const handleGuildLeave = require('./utils/guildDelete/handleGuildLeave');

module.exports = async (client, guild) => {
  await handleGuildLeave(client, guild);
};
