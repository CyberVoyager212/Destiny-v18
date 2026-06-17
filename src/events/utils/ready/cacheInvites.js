module.exports = async (client) => {
  client.invites = new Map();
  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      const inviteMap = new Map();
      invites.forEach((i) => {
        inviteMap.set(i.code, { uses: i.uses, inviter: i.inviter?.id ?? null });
      });
      client.invites.set(guild.id, inviteMap);
      console.log(
        `[Ready] ${guild.name} davetleri cachelendi (${inviteMap.size})`
      );
    } catch (err) {
      console.warn(
        `[Ready] ${guild.name} davetleri alınamadı (izin yok ya da hata).`
      );
    }
  }
};
