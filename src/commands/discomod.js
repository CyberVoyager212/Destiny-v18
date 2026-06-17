const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

const generateRandomColor = () => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')}`;
};

let interval;

exports.help = {
  name: 'discomod',
  aliases: [],
  usage: 'discomod @rol',
  description:
    'Belirtilen rolün rengini her 6 saniyede değiştirir. Tekrar çağrıldığında durdurur.',
  category: 'Eğlence',
  cooldown: 10,
  permissions: ['ADMINISTRATOR'],
};

exports.execute = async (client, message, args) => {
  const role = message.mentions.roles.first();
  if (!role) {
    return message.reply(
      `${emojis.bot.error} | Hımm~ **${message.member.displayName}**, lütfen bir rol etiketle :c Örnek: \`discomod @rol\``,
    );
  }

  if (interval) {
    clearInterval(interval);
    interval = null;
    return message.channel.send({
      embeds: [
        new MessageEmbed()
          .setColor('RED')
          .setTitle(`${emojis.bot.error} Rol rengi değiştirme durduruldu!`)
          .setDescription(`Hedef rol: **${role.name}**`)
          .setFooter({ text: `Anime-stil mod aktif! 🎨` }),
      ],
    });
  }

  interval = setInterval(() => {
    const color = generateRandomColor();
    role.setColor(color).catch(console.error);
  }, 6000);

  return message.channel.send({
    embeds: [
      new MessageEmbed()
        .setColor('GREEN')
        .setTitle(`${emojis.bot.succes} Rol rengi değiştirme başlatıldı!`)
        .setDescription(`Her 6 saniyede bir rol rengi değişecek.`)
        .addField('Hedef Rol', role.name)
        .setFooter({ text: `Anime-stil mod aktif! 🎨` }),
    ],
  });
};
