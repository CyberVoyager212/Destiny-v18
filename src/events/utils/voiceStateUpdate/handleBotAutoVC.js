const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

module.exports = async (client, oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.id !== client.user.id) return;

  const guild = newState.guild;
  const dbData = await client.db.get(`autoVC_${guild.id}`);
  if (!dbData || !dbData.id) return;

  const targetChannelId = dbData.id;

  if (newState.channelId !== targetChannelId) {
    const channel = guild.channels.cache.get(targetChannelId);
    if (!channel) return;

    const existing = getVoiceConnection(guild.id);
    if (existing) {
      try {
        existing.destroy();
      } catch {}
    }

    try {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });
    } catch (err) {
      console.error(
        `[AutoVC] Yeniden bağlanırken hata oluştu: ${guild.id}`,
        err,
      );
    }
  }
};
