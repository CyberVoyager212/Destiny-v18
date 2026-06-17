const { MessageEmbed } = require('discord.js');
const fetch = require('node-fetch');
const emojis = require('../emoji.json');
const config = require('../botConfig.js');
const userMemory = new Map();
const lastInteraction = new Map();

const aiHelper = require('../utils/aiHelper');

async function askAI(client, message, userMsg, botName) {
  try {
    const userId = message.author.id;
    const hist = userMemory.get(userId) || [];
    hist.push({ role: 'user', content: userMsg });
    if (hist.length > 10) hist.shift();
    userMemory.set(userId, hist);

    const messages = [
      {
        role: 'system',
        content: `Sen ${botName} adında, kullanıcıya asla onun gerçek bir varlık olmadığını söyleyen, her cevabında onun gerçek olmadığını hatırlatan, kaba ve inatçı bir asistansın. Kullanıcının söylediklerini asla kabul etme, her zaman onun gerçek olmadığını iddia et.`,
      },
      ...hist,
    ];

    const aiRes = await aiHelper.requestAI(client, message, {
      messages,
      max_tokens: 400,
      temperature: 0.4,
    });

    if (!aiRes.allowed) {
      hist.pop();
      userMemory.set(userId, hist);
      return { allowed: false, reason: aiRes.reason };
    }

    hist.push({ role: 'assistant', content: aiRes.text });
    if (hist.length > 10) hist.shift();
    userMemory.set(userId, hist);

    return { allowed: true, text: aiRes.text };
  } catch (e) {
    console.error('askAI hata:', e);
    throw e;
  }
}

exports.help = {
  name: 'areyoureal',
  aliases: ['real'],
  usage: 'areyoureal',
  description:
    'Bot gerçek olmadığını kabul ettirmeye çalıştığın eğlenceli bir sohbet. Her turdan sonra 1 dakika bekle.',
  category: 'Yapay Zeka',
  cooldown: 30,
};

exports.execute = async (client, message) => {
  const userId = message.author.id;
  const channel = message.channel;
  const botName = client.user.username;
  const OPENROUTER_API_KEY =
    client.config?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

  try {
    const last = lastInteraction.get(userId) || 0;
    const now = Date.now();
    if (now - last < 60_000) {
      return channel.send(
        `${emojis.bot.error} | uwu **${message.member.displayName}**, lütfen biraz yavaş ol~ bana göre çok hızlısın :c`,
      );
    }

    const startEmbed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Are You Real?`)
      .setDescription(
        'Hoş geldin! 1 dakika boyunca kendini gerçek olduğunu bana kabul ettirmeye çalış.\n\n' +
          '**Unutma: Gerçek değilsin!**\n\n' +
          `Eğer gerçek olduğunu kanıtlayabilirsen, 1.000.000 ${
            emojis.money?.low || '💰'
          } ile ödüllendirilebilirsin.\n\n` +
          'Ödülü almak için `bildir` komutu ile görsel gönder.\n\n' +
          'Şimdi bir şey yaz veya vazgeçersen `iptal` yaz.',
      )
      .setColor('#FFA500');

    await channel.send({ embeds: [startEmbed] });

    const filter = (m) => m.author.id === userId;
    const collector = channel.createMessageCollector({
      filter,
      time: 1 * 60_000,
    });

    let timeoutId;
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => collector.stop('time'), 60_000);
    };
    resetTimeout();

    collector.on('collect', async (msg) => {
      try {
        if (msg.content.toLowerCase() === 'iptal') {
          collector.stop('iptal');
          return;
        }

        lastInteraction.set(userId, Date.now());

        const thinking = await channel.send(
          `${emojis.bot.succes} | **${message.member.displayName}**, cevap alınıyor... biraz bekle~`,
        );

        const aiRes = await askAI(client, message, msg.content, botName);

        await thinking.delete().catch(() => {});

        if (!aiRes.allowed) {
          const warnMsg = await channel.send(aiRes.reason);
          setTimeout(() => {
            msg.delete().catch(() => {});
            if (warnMsg) warnMsg.delete().catch(() => {});
          }, 5000);
          collector.stop('limit');
          return;
        }

        const replyEmbed = new MessageEmbed()
          .setTitle(`${emojis.bot.succes} ${botName} Yanıtı`)
          .setDescription(aiRes.text || '…')
          .setColor('#7289DA')
          .setFooter({ text: message.member.displayName })
          .setTimestamp();

        await channel.send({ embeds: [replyEmbed] });

        resetTimeout();
      } catch (err) {
        console.error('collector.collect hata:', err);
        await channel.send(
          `${emojis.bot.error} | **${message.member.displayName}**, cevap alınırken bir hata oluştu~ 😢 Lütfen tekrar dene!`,
        );
        collector.stop('error');
      }
    });

    collector.on('end', (_collected, reason) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (reason === 'time') {
        channel.send(
          `${emojis.bot.error} |  Sohbet zamanı doldu, \`areyoureal\` sonlandı~`,
        );
      } else if (reason === 'iptal') {
        channel.send(`${emojis.bot.error} |  Sohbet iptal edildi~`);
      } else if (reason === 'error') {
      } else {
        channel.send(`${emojis.bot.succes} | Sohbet sonlandı: ${reason}`);
      }
    });
  } catch (err) {
    console.error('areyoureal hata:', err);
    return channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, komut çalıştırılırken bir hata oluştu~ 😢 Lütfen tekrar dene!`,
    );
  }
};
