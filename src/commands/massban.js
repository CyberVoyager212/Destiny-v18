const { Permissions } = require('discord.js');
const emojis = require('../emoji.json');

module.exports = {
  name: 'massban',
  description: 'Belirtilen kullanıcıları toplu olarak yasaklar.',
  aliases: ['mban', 'massbanhammer'],
  usage: 'massban @user1 @user2 ...',

  async execute(client, message, args) {
    if (!message.guild.me.permissions.has(Permissions.FLAGS.BAN_MEMBERS)) {
      return message.reply(
        `${emojis.bot.error} | Auu~ benim de **Üyeleri Yasakla** iznim yok **${message.member.displayName}**... ne yapabilirim ki :c`,
      );
    }

    const users = message.mentions.members;
    if (!users.size) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, kimi yasaklamam gerektiğini söylemelisin~ boş boş bakamam sana :<`,
      );
    }

    let success = 0,
      failed = 0;

    for (const [, member] of users) {
      try {
        await member.ban({
          reason: `Toplu Yasaklama - Yetkili: ${message.member.displayName}`,
        });
        success++;
      } catch (error) {
        failed++;
      }
    }

    return message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, toplu ban tamamlandı!\n` +
        `🔨 **Başarıyla yasaklananlar:** ${success} kişi\n` +
        `${emojis.bot.error} **Başarısız olanlar:** ${failed} kişi ~ üzgünüm biraz aksilik oldu :c`,
    );
  },

  help: {
    name: 'massban',
    aliases: ['mban', 'massbanhammer'],
    usage: 'massban @user1 @user2 ...',
    description: 'Belirtilen kişileri topluca yasaklar.',
    category: 'Moderasyon',
    cooldown: 10,
    permissions: ['BAN_MEMBERS'],
  },
};
