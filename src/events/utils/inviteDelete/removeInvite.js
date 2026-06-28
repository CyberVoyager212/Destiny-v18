module.exports = async (client, invite) => {
  try {
    const guildId = invite?.guild?.id;
    if (!guildId) return;

    const cached = client.invites.get(guildId);

    if (cached && cached.has(invite.code)) {
      cached.delete(invite.code);
    }
  } catch (err) {
    console.error('[InviteDelete] Hata:', err);
  }
};
