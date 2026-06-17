const { MessageEmbed } = require('discord.js');
const axios = require('axios');
const botConfig = require('../botConfig.js');
const emojis = require('../emoji.json');

module.exports.help = {
  name: 'dedikodu',
  aliases: ['gossip'],
  usage: 'dedikodu <kullanıcı>',
  description: 'Belirtilen kullanıcı hakkında rastgele bir dedikodu üretir.',
  category: 'Yapay Zeka',
  cooldown: 10,
};

module.exports.execute = async (client, message, args) => {
  const targetUser = args.join(' ');
  if (!targetUser)
    return message.reply(
      `${emojis.bot.error} | Ahh~ kim hakkında dedikodu yapacağımı yazmayı unuttun, **${message.member.displayName}** :c`,
    );

  const member = message.mentions.members.first();
  const user = message.mentions.users.first();
  const displayName = member ? member.displayName : (user ? user.username : targetUser);

  const prompt = `${displayName} hakkında kısa, eğlenceli ve tamamen hayali türkçe bir dedikodu yaz. sadece dedikoduyu yaz.`;

  try {
    const aiHelper = require('../utils/aiHelper');
    const aiRes = await aiHelper.requestAI(client, message, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
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

    const aiReply = aiRes.text;
    const embed = new MessageEmbed()
      .setTitle(`Dedikodu 🗣️ ${displayName}`)
      .setDescription(aiReply)
      .setColor('RANDOM')
      .setFooter({ text: `Dedikodu isteyen: ${message.author.tag}` });

    message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Dedikodu komutu hatası:', err);
    message.reply(
      `${emojis.bot.error} | Uuups! Dedikodu yapmak için kullandığım sihir bozuldu 😵 Lütfen tekrar dene~`,
    );
  }
};
