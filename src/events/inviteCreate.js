const syncInvites = require('./utils/inviteCreate/syncInvites');

module.exports = async (client, invite) => {
  await syncInvites(client, invite);
};
