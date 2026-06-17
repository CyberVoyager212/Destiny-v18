const handleNewGuild = require('./utils/guildCreate/handleNewGuild');

module.exports = async (client, guild) => {
  await handleNewGuild(client, guild);
};
