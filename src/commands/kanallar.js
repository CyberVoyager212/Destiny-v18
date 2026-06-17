const emojis = require('../emoji.json');

module.exports = {
  async execute(client, message, args) {
    try {
      const visibleChannels = message.guild.channels.cache.filter((channel) =>
        channel.permissionsFor(message.member).has('VIEW_CHANNEL'),
      );

      if (visibleChannels.size === 0) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, görebildiğin hiç kanal bulamadım... o.O`,
        );
      }

      const categories = visibleChannels
        .filter((c) => c.type === 'GUILD_CATEGORY' || c.type === 4)
        .sort((a, b) => a.position - b.position);

      const uncategorized = visibleChannels
        .filter(
          (c) => !c.parentId && c.type !== 'GUILD_CATEGORY' && c.type !== 4,
        )
        .sort((a, b) => a.position - b.position);

      let outputArray = [];

      uncategorized.forEach((channel) => {
        let emoji =
          channel.type === 'GUILD_TEXT' || channel.type === 0 ? '' : '';
        outputArray.push(`${emoji} ${channel.name} (\`${channel.id}\`)`);
      });

      categories.forEach((category) => {
        const children = visibleChannels
          .filter((c) => c.parentId === category.id)
          .sort((a, b) => a.position - b.position);

        if (children.size > 0) {
          outputArray.push(`\n📁 **${category.name.toUpperCase()}**`);

          children.forEach((channel) => {
            let emoji = '';
            if (channel.type === 'GUILD_VOICE' || channel.type === 2)
              emoji = '';
            else if (
              channel.type === 'GUILD_ANNOUNCEMENT' ||
              channel.type === 5
            )
              emoji = '';
            else if (
              channel.type === 'GUILD_STAGE_VOICE' ||
              channel.type === 13
            )
              emoji = '';

            outputArray.push(
              `   ├── ${emoji} ${channel.name} (\`${channel.id}\`)`,
            );
          });
        }
      });

      const header = `${emojis.bot.succes} | **${message.member.displayName}**, işte senin için erişilebilir kanallar~ ✨\n`;
      let currentMessage = header;

      for (const line of outputArray) {
        if ((currentMessage + '\n' + line).length > 2000) {
          await message.channel.send(currentMessage);
          currentMessage = line;
        } else {
          currentMessage += (currentMessage === header ? '' : '\n') + line;
        }
      }

      if (currentMessage) {
        await message.channel.send(currentMessage);
      }
    } catch (error) {
      console.error('kanallar komutu hata:', error);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, ahh~ kanalları listelerken bir sorun çıktı... Yetkilerimi veya discord.js sürümünü kontrol edebilirsin.`,
      );
    }
  },

  help: {
    name: 'kanallar',
    aliases: ['channels', 'sunucu-kanallar'],
    usage: 'kanallar',
    description:
      'Sunucudaki erişebildiğiniz tüm kanalları düzenli bir şekilde listeler.',
    category: 'Moderasyon',
    cooldown: 5,
    permissions: ['VIEW_CHANNEL'],
  },
};
