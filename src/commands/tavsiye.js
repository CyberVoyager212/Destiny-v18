const fetch = require('node-fetch');
const emojis = require('../emoji.json');

exports.help = {
  name: 'tavsiye',
  aliases: ['öneri', 'advice'],
  usage: 'tavsiye <soru veya konu>',
  description: 'Yapay zekadan tavsiye veya öneri alırsınız.',
  category: 'Yapay Zeka',
  cooldown: 10,
};

const aiHelper = require('../utils/aiHelper');

exports.execute = async (client, message, args) => {
  if (!args.length) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, bana ne hakkında tavsiye istediğini söylemezsen sihir yapamam qwq~`,
    );
  }

  try {
    const userInput = args.join(' ');

    const aiRes = await aiHelper.requestAI(client, message, {
      messages: [
        {
          role: 'system',
          content:
            'Sen yardımcı, bilgili ve kibar bir tavsiye botusun. Kullanıcının sorusuna veya isteğine uygun, kısa ve net tavsiyeler veriyorsun. Gereksiz uzunluk yapma, direkt tavsiye ver.',
        },
        {
          role: 'user',
          content: userInput,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    if (!aiRes.allowed) {
      const warnMsg = await message.reply(aiRes.reason);
      setTimeout(() => {
        message.delete().catch(() => {});
        if (warnMsg) warnMsg.delete().catch(() => {});
      }, 5000);
      return;
    }

    const advice = aiRes.text;

    const embed = {
      title: `${emojis.bot.succes} | Tavsiyeniz`,
      description: advice,
      color: 0x00cccc,
      footer: { text: `${client.user.username} Tavsiye Botu` },
      timestamp: new Date(),
    };

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, tavsiyeni getirirken işler karıştı qwq~ \n> Hata: \`${error.message}\`\nBirazdan tekrar dene olur mu? >w<`,
    );
  }
};
