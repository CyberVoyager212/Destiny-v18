module.exports = async (client, invite) => {
  try {
    const inviteMap = client.invites.get(invite.guild.id) || new Map();

    inviteMap.set(invite.code, {
      uses: invite.uses || 0,
      inviter: invite.inviter?.id || null,
    });

    client.invites.set(invite.guild.id, inviteMap);
  } catch (err) {
    console.error('[InviteCreate] Davet kaydedilirken hata:', err);
  }
};
