const axios = require('axios');
const botConfig = require('../../../botConfig.js');
const { sendWithTyping } = require('./helpers');

module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const channelId = message.channel.id;
  const content = message.content || '';
  const lower = content.toLowerCase();

  const aiKapali = Boolean(await db.get('bakim_aiKapali'));
  if (aiKapali) return false;

  let isReplyToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referenced = await message.channel.messages.fetch(
        message.reference.messageId,
      );
      if (
        referenced &&
        referenced.author &&
        referenced.author.id === client.user.id
      ) {
        isReplyToBot = true;
      }
    } catch (err) {}
  }

  const botNameFilter = (global.botName || 'destiny').toLowerCase();
  const msgContentTrimmed = content.trim().toLowerCase();

  if (msgContentTrimmed === `${botNameFilter} ?ayarla`) {
    if (
      message.member &&
      (message.member.permissions.has('ADMINISTRATOR') ||
        message.author.id === (global.botOwnerId || client.config?.ownerId))
    ) {
      await db.set(`ai_chat_channel_${channelId}`, 'active');
      await message.channel.send(
        'Bu kanal başarıyla sürekli yapay zeka sohbet kanalı olarak ayarlandı.',
      );
      return true;
    }
  }

  if (msgContentTrimmed === `${botNameFilter} ?ayarla sil`) {
    if (
      message.member &&
      (message.member.permissions.has('ADMINISTRATOR') ||
        message.author.id === (global.botOwnerId || client.config?.ownerId))
    ) {
      await db.delete(`ai_chat_channel_${channelId}`);
      await message.channel.send(
        'Bu kanalın sürekli yapay zeka sohbet modu başarıyla iptal edildi.',
      );
      return true;
    }
  }

  const botId = client.user.id;
  const isMentioned = message.mentions?.users?.has(botId);
  const hasBotName = lower.includes(botNameFilter);

  const userChatKey = `ai_chat_user_${guildId}_${userId}`;
  const channelChatKey = `ai_chat_channel_${channelId}`;

  let userChatStatus = await db.get(userChatKey);
  const channelChatStatus = await db.get(channelChatKey);

  const stopWords = ['görüşürüz', 'bb', 'baybay', 'ben kaçtım', 'hoşça kal'];
  const hasStopWord = stopWords.some((w) => {
    if (w === 'bb') return new RegExp(`\\b${w}\\b`, 'i').test(lower);
    return lower.includes(w);
  });

  if (userChatStatus === 'active' && hasStopWord) {
    await db.delete(userChatKey);
    if (global.aiChatTimeouts?.has(userId)) {
      clearTimeout(global.aiChatTimeouts.get(userId));
      global.aiChatTimeouts.delete(userId);
    }
    await message.channel.send(
      `Görüşürüz <@${userId}>! Benimle sürekli sohbet oturumunu sonlandırdın. Bana ihtiyacın olduğunda seslenmen yeterli.`,
    );
    return true;
  }

  if (lower === `${botNameFilter}`) {
    await db.set(userChatKey, 'active');
    await message.channel.send(`Selam <@${userId}>! Seni dinliyorum.`);
    return true;
  }

  const isAiTriggered =
    isMentioned ||
    hasBotName ||
    isReplyToBot ||
    userChatStatus === 'active' ||
    channelChatStatus === 'active';

  if (isAiTriggered) {
    let userMessage = content;
    if (isMentioned)
      userMessage = userMessage
        .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
        .trim();
    if (
      hasBotName &&
      userChatStatus !== 'active' &&
      channelChatStatus !== 'active'
    ) {
      const nameRegex = new RegExp(`\\b${botNameFilter}\\b`, 'gi');
      userMessage = userMessage.replace(nameRegex, '').trim();
    }

    if (!global.aiChatBuffers) global.aiChatBuffers = new Map();
    const aiChatBuffers = global.aiChatBuffers;

    if (userChatStatus === 'active') {
      if (!global.aiChatTimeouts) global.aiChatTimeouts = new Map();
      if (global.aiChatTimeouts.has(userId))
        clearTimeout(global.aiChatTimeouts.get(userId));

      const timeout = setTimeout(async () => {
        await db.delete(userChatKey);
        global.aiChatTimeouts.delete(userId);
      }, 30000);

      global.aiChatTimeouts.set(userId, timeout);
    }

    const processAILogic = async (finalMessageText) => {
      const bufferId = `buffer_${channelId}_${userId}`;
      if (aiChatBuffers.has(bufferId)) {
        const bData = aiChatBuffers.get(bufferId);
        if (bData.timer) clearTimeout(bData.timer);
        aiChatBuffers.delete(bufferId);
      }

      const historyKey = `destiny_history_${guildId}_${userId}`;
      let history = (await db.get(historyKey)) || [];

      const currentOwnerId =
        global.botOwnerId || client.config?.ownerId || botConfig.ownerId;
      const ownerUser = client.users.cache.get(currentOwnerId);
      const ownerName = ownerUser ? ownerUser.username : 'Kurucu/Geliştirici';

      const systemPrompt = `Senin ismin ${
        global.botName || 'Destiny'
      }. Karşındaki kullanıcıya Türkçe cevap ver. Seni oluşturan kişi ${
        ownerName
      }. Karşındaki kullanıcının ismi ${
        message.author.username
      }. Şuan bulunduğun kanal ismi ${message.channel.name}. Sunucu ismi ${
        message.guild.name
      }.
      komut çalıştıramıyacağını belirt`;

      await message.channel.sendTyping().catch(() => {});
      const typingTimer = setInterval(
        () => message.channel.sendTyping().catch(() => {}),
        8000,
      );

      try {
        const aiHelper = require('../../../utils/aiHelper');
        const aiRes = await aiHelper.requestAI(client, message, {
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-25),
            { role: 'user', content: finalMessageText },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        });

        if (!aiRes.allowed) {
          const warnMsg = await message.channel.send(aiRes.reason);
          setTimeout(() => {
            message.delete().catch(() => {});
            if (warnMsg) warnMsg.delete().catch(() => {});
          }, 5000);
          return;
        }

        let aiReply = aiRes.text || '';
        aiReply = aiReply.trim();

        if (aiReply) {
          await sendWithTyping(message.channel, aiReply, {
            replyTo: message,
          });
          history.push({ role: 'user', content: finalMessageText });
          history.push({ role: 'assistant', content: aiReply });
          if (history.length > 50) history = history.slice(-50);
          await db.set(historyKey, history);
        }
      } catch (err) {
        console.error('AIChat error:', err);
        message.channel
          .send(`API bağlantımda bir sorun oluştu.`)
          .catch(() => {});
      } finally {
        clearInterval(typingTimer);
      }
    };

    const handleBuffer = (msgText) => {
      const bufferId = `buffer_${channelId}_${userId}`;
      if (!aiChatBuffers.has(bufferId)) {
        aiChatBuffers.set(bufferId, { messages: [], timer: null });
      }

      const userBuffer = aiChatBuffers.get(bufferId);
      userBuffer.messages.push(msgText);
      if (userBuffer.timer) clearTimeout(userBuffer.timer);

      userBuffer.timer = setTimeout(() => {
        const combinedMessage = userBuffer.messages.join('\n');
        processAILogic(combinedMessage);
      }, 4000);
    };

    handleBuffer(userMessage);
    return true;
  }

  return false;
};
