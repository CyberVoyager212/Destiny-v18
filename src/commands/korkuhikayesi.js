const axios = require('axios');
const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'korkuhikayesi',
  aliases: ['korku', 'horror'],
  usage: 'korkuhikayesi',
  description: 'Yapay zeka tarafından kısa bir korku hikayesi anlatır.',
  category: 'Yapay Zeka',
  cooldown: 20,
};

const aiHelper = require('../utils/aiHelper');

exports.execute = async (client, message, args) => {
  try {
    const aiRes = await aiHelper.requestAI(client, message, {
      messages: [
        {
          role: 'system',
          content:
            'Kısa, ürkütücü ve akılda kalıcı bir korku hikayesi yaz. Sadece hikayeyi yaz, başka bir şey ekleme.',
        },
        { role: 'user', content: 'Bana korku hikayesi anlat.' },
      ],
      max_tokens: 1000,
      temperature: 0.8,
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

    const story = aiRes.text;
    if (!story) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, huhu~ korku hikayesi alamadım, sanırım karanlıkta kayboldum :c`,
      );
    }

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} Korku Hikayesi`)
      .setDescription(story)
      .setColor('#8B0000')
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Korku Hikayesi Komutu Hatası:', err);
    message.reply(
      `${emojis.bot.error} | Ayyaa~ bir şeyler ters gitti **${message.member.displayName}**... tekrar deneyebilir misin? :c`,
    );
  }
};
