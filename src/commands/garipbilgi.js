const axios = require('axios');
const emojis = require('../emoji.json');

exports.help = {
  name: 'garipbilgi',
  aliases: ['ilginçbilgi', 'tuhafbilgi'],
  usage: 'garipbilgi',
  description: 'Sana ilginç, garip ve tuhaf bir bilgi verir.',
  category: 'Yapay Zeka',
  cooldown: 10,
};

const aiHelper = require('../utils/aiHelper');

exports.execute = async (client, message, args) => {
  try {
    const messages = [
      {
        role: 'user',
        content:
          'Sen garip, eğlenceli ve tuhaf bilgiler veren bir botsun. Kullanıcıya internette pek bulunmayan, garip veya tuhaf bir bilgi ver. Bilgiyi sade, kısa ve eğlenceli anlat. Sadece bilgi ver, başka şey yazma.',
      },
    ];

    const aiRes = await aiHelper.requestAI(client, message, {
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
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

    const weirdFact = aiRes.text;

    const embed = {
      title: `🤯 Garip Bilgi!`,
      description: weirdFact,
      color: 0x00cccc,
      footer: { text: `${client.user.username} Garip Bilgi Botu` },
      timestamp: new Date(),
    };

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, hmmp~ sana garip bir şey söyleyecektim ama büyü tutmadı... birazdan tekrar dene lütfen :c`,
    );
  }
};
