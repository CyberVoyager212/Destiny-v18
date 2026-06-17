const removeInvite = require('./utils/inviteDelete/removeInvite');

module.exports = async (client, invite) => {
  await removeInvite(client, invite);
};
