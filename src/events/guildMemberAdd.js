const handleMemberJoin = require('./utils/guildMemberAdd/handleMemberJoin');

module.exports = async (client, member) => {
  await handleMemberJoin(client, member);
};
