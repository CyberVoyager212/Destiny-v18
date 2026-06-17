const emojis = require('../../../emoji.json');

module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;
  const content = message.content || '';

  const engelKelimeler = (await db.get(`engelKelime_${guildId}`)) || [];
  let hasBadWord = false;
  let filteredContent = content;

  engelKelimeler.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(filteredContent)) {
      hasBadWord = true;
      filteredContent = filteredContent.replace(regex, '');
    }
  });

  if (hasBadWord) {
    try {
      await message.delete().catch(() => {});
      if (!filteredContent.trim()) return true;

      let webhook = (await message.channel.fetchWebhooks()).find(
        (wh) => wh.name === 'AdvencedEngel',
      );
      if (!webhook) {
        webhook = await message.channel.createWebhook('AdvencedEngel', {
          avatar: client.user.displayAvatarURL(),
        });
      }
      const displayName =
        message.member?.displayName || message.author.username;
      await webhook
        .send({
          content: filteredContent.trim(),
          username: displayName,
          avatarURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .catch((err) => {
          console.error('Engel webhook hata:', err);
        });
    } catch (err) {
      console.error('Engel sistemi hatası:', err);
      try {
        await message.channel
          .send(
            `${
              emojis.bot.error
            } | ✨ Engel sistemi çalışırken bir hata oluştu: ${
              err.message || 'Bilinmeyen'
            }`,
          )
          .catch(() => {});
      } catch {}
    }
  }

  return false;
};
