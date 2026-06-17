const { Permissions, MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'duyuru',
  aliases: ['duyur'],
  usage: 'duyuru <mesaj>',
  description: 'Sunucudaki tüm üyelere özelden duyuru mesajı gönderir.',
  category: 'Moderasyon',
  cooldown: 10,
  permissions: ['ADMINISTRATOR'],
};

exports.execute = async (client, message, args) => {
  try {
    const announcement = args.join(' ');
    if (!announcement) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen göndermek istediğin duyuruyu yaz~`,
      );
    }

    const members = await message.guild.members.fetch({ withPresences: true });
    let successCount = 0;
    let failCount = 0;

    for (const member of members.values()) {
      if (!member.user.bot) {
        try {
          await member.send(`📢 **DUYURU**\n\n${announcement}`);
          successCount++;
        } catch {
          failCount++;
        }
      }
    }

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} Duyuru Gönderildi!`)
      .setColor('GREEN')
      .setDescription(
        `${emojis.bot.succes} **Başarıyla gönderilen:** ${successCount}\n ${emojis.bot.error} **Gönderilemeyen:** ${failCount}`,
      )
      .setFooter({ text: `Duyuruyu gönderen: ${message.member.displayName}` });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Duyuru gönderme hatası:', error);
    message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, duyuru mesajı gönderilirken bir hata oluştu~ Lütfen tekrar dene :c`,
    );
  }
};
