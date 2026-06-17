const { MessageEmbed, Permissions } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'roldüzenle',
  aliases: ['rolduzenle'],
  usage:
    'roldüzenle help\n' +
    'roldüzenle <@rol|id|isim> [renk(hex)] [izin1,izin2,...]',
  description:
    'Belirtilen rolün rengini veya izinlerini değiştirir. `help` ile izinleri ve renkleri görebilirsin.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MANAGE_ROLES'],
};

exports.execute = async (client, message, args) => {
  if (args[0]?.toLowerCase() === 'help') {
    return message.channel.send({
      embeds: [
        new MessageEmbed()
          .setTitle('🎨 roldüzenle Komut Yardımı')
          .setDescription(this.help.usage)
          .addField(
            'Geçerli İzinler',
            Object.keys(Permissions.FLAGS).join(', '),
          )
          .addField('Renk Örneği', '`#FF0000`, `BLUE`, `RANDOM`')
          .setColor('#00AAFF')
          .setFooter({
            text: `${message.member.displayName} talep etti`,
            iconURL: message.author.displayAvatarURL({ dynamic: true }),
          })
          .setTimestamp(),
      ],
    });
  }

  const [target, renk = null, izinler = null] = args;
  const rol =
    message.mentions.roles.first() ||
    message.guild.roles.cache.get(target) ||
    message.guild.roles.cache.find((r) => r.name === target);

  if (!rol) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, belirttiğin rol bulunamadı~ :c`,
    );
  }

  const options = {};
  if (renk) options.color = renk;
  if (izinler) options.permissions = izinler.split(',').filter((i) => i);

  try {
    await rol.edit(options);
    return message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, rol başarıyla güncellendi: ${rol.name} ✨`,
    );
  } catch (e) {
    console.error('Rol düzenleme hatası:', e);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, uf! Rol düzenleme sırasında bir hata oluştu~ lütfen tekrar dene :c`,
    );
  }
};
