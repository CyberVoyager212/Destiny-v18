const handleMemberLeave = require('./utils/guildMemberRemove/handleMemberLeave');

module.exports = async (client, member) => {
  await handleMemberLeave(client, member);
};
