const { MessageEmbed } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const emojis = require('../emoji.json');

exports.execute = async (client, message, args) => {
  const user = message.mentions.users.first();
  const resetAll = args[0] === 'all';

  try {
    if (resetAll) {
      await message.channel.send(
        `${emojis.bot.succes} | **${message.member.displayName}**, tüm kullanıcıların bakiyeleri sıfırlanıyor... lütfen bekle~ ⏱`,
      );

      const guild = message.guild;
      const members = await guild.members.fetch();

      let changed = 0;
      for (const member of members.values()) {
        try {
          if (member.user.bot) continue;
          await db.set(`money_${member.user.id}`, 0);
          changed++;
        } catch (innerErr) {
          console.error(
            `resetmoney: ${member.user.id} sıfırlanırken hata:`,
            innerErr,
          );
        }
      }

      const embed = new MessageEmbed()
        .setTitle(`${emojis.bot.succes} | Tüm Paralar Sıfırlandı!`)
        .setDescription(
          `🔄 Sunucudaki **${changed}** kullanıcının bakiyesi başarıyla sıfırlandı.\n\n✨ İşlem tamamlandı — eğlenceye devam!`,
        )
        .setColor('#57F287')
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } else if (user) {
      await db.set(`money_${user.id}`, 0);

      const embed = new MessageEmbed()
        .setTitle(`${emojis.bot.succes} | Kullanıcının Parası Sıfırlandı`)
        .addFields(
          { name: 'Kullanıcı', value: `<@${user.id}>`, inline: true },
          { name: 'Yeni Bakiye', value: '0', inline: true },
        )
        .setColor('#57F287')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({
          text: `İşlemi yapan: ${message.member.displayName}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        });

      return message.channel.send({ embeds: [embed] });
    } else {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen bir kullanıcı etiketle veya \`all\` parametresi kullan (örnek: \`resetmoney @user\` veya \`resetmoney all\`).`,
      );
    }
  } catch (error) {
    console.error('resetmoney hata:', error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, uff! Bir şeyler ters gitti ve işlem tamamlanamadı... biraz sonra tekrar dene~ :c`,
    );
  }
};

exports.help = {
  name: 'resetmoney',
  aliases: ['resetbal'],
  usage: 'resetmoney @kullanıcı | resetmoney all',
  description:
    'Bir kullanıcının parasını veya tüm kullanıcıların parasını sıfırlar.',
  category: 'Ekonomi',
  cooldown: 5,
  admin: true,
};
