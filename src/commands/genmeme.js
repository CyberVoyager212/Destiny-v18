const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const fetch = require('node-fetch');
const translate = require('translate-google');
const emojis = require('../emoji.json');

exports.help = {
  name: 'komik',
  aliases: ['caps', 'guldur', 'mizah'],
  usage: 'komik',
  description:
    'Rastgele bir meme gönderir ve isteğe bağlı görüntüyü yapay zekaya açıklatır, ardından metni Türkçeye çevirir.',
  category: 'Yapay Zeka',
  cooldown: 5,
};

exports.execute = async (client, message, args) => {
  try {
    const res = await fetch('https://meme-api.com/gimme');
    const meme = await res.json();

    if (!meme || !meme.url) {
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, meme bulamadım~ biraz sonra tekrar dener misin? :c`,
      );
    }

    const embed = new MessageEmbed()
      .setTitle(meme.title || 'Meme')
      .setURL(meme.postLink || '')
      .setColor('RANDOM')
      .setImage(meme.url)
      .setFooter({ text: `👍 ${meme.ups || 0} || 💬 ${meme.comment || 0}` });

    await message.channel.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Meme alma hatası:', error);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, aaah~ meme getirirken bir şeyler ters gitti :c`,
    );
  }
};
