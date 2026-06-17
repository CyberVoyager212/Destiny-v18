const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');
const aiHelper = require('../utils/aiHelper');

exports.help = {
  name: 'ai',
  aliases: ['token', 'ai-token'],
  usage: 'ai',
  description:
    'Kullanıcının kalan AI token haklarını ve bir sonraki token yenileme süresini gösterir.',
  category: 'Yapay Zeka',
  cooldown: 5,
};

exports.execute = async (client, message) => {
  const userId = message.author.id;
  const tokenInfo = await aiHelper.getTokenStatus(userId);
  const aiEmoji = emojis.money?.AI || '<:aidestiniex:1514989235893960745>';

  const embed = new MessageEmbed()
    .setTitle(`${emojis.bot.succes} | AI Limit ve Token Durumu`)
    .setDescription(
      `**Kalan Token:** ${tokenInfo.tokens} ${aiEmoji}\n` +
        `**Maksimum Token:** ${tokenInfo.maxTokens} ${aiEmoji}\n` +
        `**Dakikalık İstek:** ${tokenInfo.minuteUsage} / ${tokenInfo.minuteLimit}\n` +
        `**Günlük İstek:** ${tokenInfo.dailyUsage} / ${tokenInfo.dailyLimit}\n\n` +
        `${tokenInfo.isVip ? '👑 VIP Üyesi' : '👤 Normal Üye'}`,
    )
    .addField(
      'Sonraki Token',
      tokenInfo.tokens >= tokenInfo.maxTokens
        ? 'Tam kapasite'
        : `<t:${Math.floor((Date.now() + tokenInfo.nextTokenSec * 1000) / 1000)}:R>`,
      true,
    )
    .setColor('#00FFAA')
    .setTimestamp();

  return message.channel.send({ embeds: [embed] });
};
