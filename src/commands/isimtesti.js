const axios = require('axios');
const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'isimtesti',
  aliases: ['isim-anlam', 'adtest'],
  usage: 'isimtesti <isim>',
  description: 'Girilen ismin anlamını yapay zeka ile öğrenir.',
  category: 'Yapay Zeka',
  cooldown: 10,
};

const aiHelper = require('../utils/aiHelper');

exports.execute = async (client, message, args) => {
  const name = args.join(' ');
  if (!name)
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, bana bir isim vermelisin yoksa sihrimi kullanamam~ :c`,
    );

  try {
    const aiRes = await aiHelper.requestAI(client, message, {
      messages: [
        {
          role: 'user',
          content: `Bana "${name}" isminin anlamını söyle. ekstra bişey ekleme sadece bu ismin anlamını söyle bir fikrin yoksa rastgele bişi söyle`,
        },
      ],
      max_tokens: 2000,
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

    const meaning = aiRes.text;

    if (!meaning) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, bu ismin anlamını bulamadım... belki de çok gizemli bir isim >///<`,
      );
    }

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | "${name}" İsminin Anlamı`)
      .setDescription(meaning)
      .setColor('#4B0082')
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, isim anlamını alırken bir şeyler ters gitti... biraz yavaş ol lütfen~ bana göre çok hızlısın :c`,
    );
  }
};
