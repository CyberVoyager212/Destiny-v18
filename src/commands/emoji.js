const { MessageEmbed } = require('discord.js');
const axios = require('axios');
const botConfig = require('../botConfig.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'emojiçevir',
  aliases: ['emojify'],
  usage: 'emojiçevir <metin>',
  description:
    'Verilen metni yapay zeka ile sadece emojilerden oluşacak şekilde çevirir.',
  category: 'Yapay Zeka',
  cooldown: 10,
};

exports.execute = async (client, message, args) => {
  const inputText = args.join(' ');
  if (!inputText) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, lütfen çevirmem için bir metin yaz~ Bana göre çok hızlısın :c`,
    );
  }

  const aiMessages = [
    {
      role: 'user',
      content: `Sen bir "emoji çeviri botusun". Bu metni: ${inputText} yalnızca emojilerle ifade et. Harf veya sayı kullanma. kullandığın emoji sayısı kelime sayısıyla orantılı olmaya çalışsın. herhangi bir açıklama yapma, metin kullanma, sadece emojileri yaz.`,
    },
  ];

  try {
    const aiHelper = require('../utils/aiHelper');
    const aiRes = await aiHelper.requestAI(client, message, {
      messages: aiMessages,
      max_tokens: 2048,
      temperature: 0.4,
      skipVipNotice: true,
    });

    if (!aiRes.allowed) {
      const warnMsg = await message.reply(aiRes.reason);
      setTimeout(() => {
        message.delete().catch(() => {});
        if (warnMsg) warnMsg.delete().catch(() => {});
      }, 5000);
      return;
    }

    const aiReply = aiRes.text;
    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} Emoji Çeviri`)
      .setDescription(aiReply)
      .setColor('RANDOM')
      .setFooter({ text: `Çeviren: ${message.member.displayName}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Emoji çeviri hatası:', err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, emoji çevirisi sırasında bir hata oluştu~ Lütfen biraz yavaş ol ve tekrar dene :c`,
    );
  }
};
