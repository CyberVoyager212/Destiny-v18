const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'mute',
  aliases: [],
  usage: 'mute <@kullanıcı|id|isim> [süre(m)]',
  description:
    "Belirtilen süre boyunca Discord'un yerleşik susturma rolünü (TIMEOUT) uygular.",
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MODERATE_MEMBERS'],
};

exports.execute = async (client, message, args) => {
  const target = args[0];
  const member =
    message.mentions.members.first() ||
    message.guild.members.cache.get(target) ||
    message.guild.members.cache.find((m) => m.user.username === target);

  if (!member)
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, kimi susturmak istediğini söylemedin qwq`,
    );

  const minutes = parseInt(args[1]) || 5;
  if (minutes < 1 || minutes > 1440)
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, süre çok kısa ya da çok uzun... sadece \`1 - 1440 dakika\` arasında seçebilirsin!`,
    );

  try {
    await member.timeout(
      minutes * 60 * 1000,
      `Süreli mute: ${minutes} dakika (Yetkili: ${message.member.displayName})`,
    );

    const embed = new MessageEmbed()
      .setDescription(
        `${emojis.bot.succes} | **${member.user.tag}** ${minutes} dakika boyunca sessizliğe gömüldü... 🤫`,
      )
      .setColor('#99AAB5')
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, susturma sırasında bir hata oluştu qwq\n> Sebep: \`${err.message}\``,
    );
  }
};
