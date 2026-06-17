const { Permissions } = require('discord.js');
const emojis = require('../emoji.json');

exports.execute = async (client, message, args) => {
  try {
    let target =
      message.mentions.users.first() ||
      (await client.users.fetch(args[0]).catch(() => null));
    if (!target) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, atmak istediğin kullanıcıyı etiketle veya geçerli bir ID gir :c`,
      );
    }

    let member = message.guild.members.cache.get(target.id);
    if (!member) {
      return message.reply(
        `${emojis.bot.error} | Kullanıcı bu sunucuda bulunamadı~`,
      );
    }

    if (
      member.roles.highest.position >= message.member.roles.highest.position
    ) {
      return message.reply(
        `${emojis.bot.error} | Bu kullanıcıyı atamazsın, rolü seninle eşit veya daha yüksek~`,
      );
    }

    if (!member.kickable) {
      return message.reply(
        `${emojis.bot.error} | Botun bu kullanıcıyı atmaya yetkisi yok~`,
      );
    }

    let reason = args.slice(1).join(' ') || 'Belirtilmemiş';

    await member.kick(reason);

    return message.channel.send(
      `${emojis.bot.succes} | **${target.tag} başarıyla atıldı!** 🎉\n📌 Sebep: ${reason}\n👮‍♂️ Atan yetkili: ${message.member.displayName}`,
    );
  } catch (error) {
    console.error('Kick Komutu Hatası:', error);

    if (error.message.includes('Missing Permissions')) {
      return message.reply(
        `${emojis.bot.error} | Bot gerekli yetkilere sahip değil!`,
      );
    }

    return message.reply(`${emojis.bot.error} | Bir hata oluştu, tekrar dene~`);
  }
};

exports.help = {
  name: 'at',
  aliases: ['kick'],
  usage: 'at <@kullanıcı> [sebep]',
  description:
    'Bir kullanıcıyı sunucudan atar, isteğe bağlı olarak sebep belirtebilirsin.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['KICK_MEMBERS'],
};
