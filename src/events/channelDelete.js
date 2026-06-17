const handleDeletedChannel = require('./utils/channelDelete/handleDeletedChannel');

module.exports = async (client, channel) => {
  await handleDeletedChannel(client, channel);
};
