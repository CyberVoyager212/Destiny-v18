const { Permissions } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = async (client) => {
  for (const guild of client.guilds.cache.values()) {
    try {
      const data = await client.db.get(`autoVC_${guild.id}`);
      if (!data?.id) continue;
      const channel = guild.channels.cache.get(data.id);
      if (!channel) {
        console.warn(`[AutoVC] Kanal bulunamadı: ${guild.name} (${data.id})`);
        continue;
      }
      if (!channel.permissionsFor(client.user).has(Permissions.FLAGS.CONNECT)) {
        console.warn(
          `[AutoVC] ${guild.name} › ${channel.name} — CONNECT izni yok.`
        );
        continue;
      }
      try {
        joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
        });
        console.log(`[AutoVC] Katıldı: ${guild.name} › ${channel.name}`);
      } catch (err) {
        console.error(
          `[AutoVC] Katılamadı: ${guild.name}/${channel.name}`,
          err
        );
      }
    } catch (err) {
      console.error(`[AutoVC] ${guild.name} veri okunamadı:`, err);
    }
  }
};
