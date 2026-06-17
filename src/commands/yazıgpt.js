const {
  Permissions,
  MessageActionRow,
  MessageButton,
  WebhookClient,
  MessageEmbed,
} = require('discord.js');
const axios = require('axios');
const config = require('../botConfig.js');
const emojis = require('../emoji.json');
const aiHelper = require('../utils/aiHelper');

const botname = config.botname || 'Bot';
const conversationHistories = {};
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = config.model;
const DEEP_MODEL = 'openai/gpt-oss-120b';
const CODER_MODEL = 'qwen/qwen3-32b';

const openRouterLastCall = { time: 0 };
const OPENROUTER_MIN_INTERVAL_MS = 900;

module.exports = {
  name: 'yazıgpt',
  description: `Yazılı modda ${botname} ile sohbet (embed, butonlar, multimodal, history UI).`,
  usage: 'yazıgpt <create|restart|close>',
  category: 'Yapay Zeka',
  cooldown: 5,

  async execute(client, message, args) {
    const member = message.member;
    const guild = message.guild;
    if (!guild)
      return safeMessageReply(
        message,
        `${emojis.bot.error} Bu komut sunucuda kullanılmalı.`,
      );

    const sub = args[0]?.toLowerCase();

    const displayFormat = config.displayNameFormat || '{username}';
    const rawName = displayFormat.replace('{username}', member.user.username);
    const channelNameFromMember = sanitizeChannelName(rawName);

    const existingChannel = guild.channels.cache.find(
      (ch) => ch.name === channelNameFromMember,
    );

    if (sub === 'create') {
      if (existingChannel)
        return safeMessageReply(
          message,
          `${emojis.bot.error} Zaten açılmış: ${existingChannel}`,
        );

      let channel;
      try {
        channel = await guild.channels.create(channelNameFromMember, {
          type: 'GUILD_TEXT',
          permissionOverwrites: [
            { id: guild.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            {
              id: member.id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            },
            {
              id: client.user.id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
                Permissions.FLAGS.MANAGE_WEBHOOKS,
              ],
            },
          ],
        });
      } catch (e) {
        console.error('Kanal oluşturulamadı:', e);
        return safeMessageReply(
          message,
          animeError(`Kanal oluşturulamadı: ${e.message}`),
        );
      }

      let webhook;
      try {
        webhook = await channel.createWebhook(member.displayName, {
          avatar: member.user.displayAvatarURL({ format: 'png' }),
        });
      } catch (e) {
        console.warn('Webhook oluşturulamadı (create):', e.message);
      }

      conversationHistories[channel.id] = {
        webhookId: webhook?.id || null,
        webhookToken: webhook?.token || null,
        messages: [
          {
            role: 'system',
            content: `Sen ${botname} adlı bir Discord botusun. Türkçe, samimi ve anlaşılır cevap ver. Cevaplarının sonunda kullanıcıyı yönlendirmek için kısa "devam" önerileri üret ve bunları JSON blok içinde "suggestions" anahtarıyla belirt.`,
          },
        ],
        keepHistory: true,
        suggestionsMap: {},
        lastEmbedMessageId: null,
        defaultMode: 'normal',
        toggleActive: false,
        historyPageByUser: {},
        lastModelUsed: DEFAULT_MODEL,
        suppressUserMessageCollector: false,
        _savedEmbedState: null,
      };

      listenToTextChannel(client, channel, member, botname);
      return safeMessageReply(
        message,
        `${emojis.bot.succes} Oluşturuldu ve dinleniyor: ${channel}`,
      );
    }

    if (sub === 'restart') {
      if (!existingChannel)
        return safeMessageReply(
          message,
          `${emojis.bot.error} Önce \`create\` ile kanal açmalısın.`,
        );

      let webhookId = null,
        webhookToken = null;
      try {
        const webhooks = await existingChannel.fetchWebhooks();
        const wh =
          webhooks.find((w) => w.owner?.id === client.user.id) ||
          webhooks.first();
        if (wh) {
          webhookId = wh.id;
          webhookToken = wh.token;
        } else {
          const newWh = await existingChannel.createWebhook(
            member.displayName,
            {
              avatar: member.user.displayAvatarURL({ format: 'png' }),
            },
          );
          webhookId = newWh.id;
          webhookToken = newWh.token;
        }
      } catch (e) {
        console.warn('Webhook bulunamadı/oluşturulamadı (restart):', e.message);
      }

      const loadedMessages = [];
      try {
        const fetched = await existingChannel.messages.fetch({ limit: 200 });
        const ordered = Array.from(fetched.values()).sort(
          (a, b) => a.createdTimestamp - b.createdTimestamp,
        );
        for (const m of ordered) {
          if (m.content && m.content.startsWith(config.prefix)) continue;
          if (!m.content && (!m.embeds || m.embeds.length === 0)) continue;

          if (m.author && !m.author.bot) {
            loadedMessages.push({ role: 'user', content: m.content || '' });
          } else {
            let assistantText = '';
            if (m.embeds && m.embeds.length > 0) {
              const emb = m.embeds[0];
              if (emb.description) assistantText += emb.description + '\n';
              if (emb.fields && emb.fields.length)
                assistantText += emb.fields
                  .map((f) => `${f.name}: ${f.value}`)
                  .join('\n');
            }
            if (m.content)
              assistantText =
                (assistantText ? assistantText + '\n' : '') + m.content;
            if (assistantText.trim())
              loadedMessages.push({
                role: 'assistant',
                content: assistantText.trim(),
              });
          }
        }
      } catch (e) {
        console.warn('Geçmiş yüklenemedi:', e.message);
      }

      const baseMessages = [
        {
          role: 'system',
          content: `Sen ${botname} adlı bir Discord botusun. Türkçe, samimi ve anlaşılır cevap ver. Cevaplarının sonunda kullanıcıyı yönlendirmek için kısa "devam" önerileri üret ve bunları JSON blok içinde "suggestions" anahtarıyla belirt.`,
        },
      ];
      const messagesToStore = baseMessages.concat(loadedMessages);

      conversationHistories[existingChannel.id] = {
        webhookId,
        webhookToken,
        messages: messagesToStore,
        keepHistory: true,
        suggestionsMap: {},
        lastEmbedMessageId: null,
        defaultMode: 'normal',
        toggleActive: false,
        historyPageByUser: {},
        lastModelUsed: DEFAULT_MODEL,
        suppressUserMessageCollector: false,
        _savedEmbedState: null,
      };

      listenToTextChannel(client, existingChannel, member, botname);
      return safeMessageReply(
        message,
        `${emojis.bot.succes} Yeniden dinleniyor ve geçmiş yüklendi: ${existingChannel}`,
      );
    }

    if (sub === 'close') {
      if (!existingChannel)
        return safeMessageReply(
          message,
          `${emojis.bot.error} Kapatılacak bir kanalın yok.`,
        );
      delete conversationHistories[existingChannel.id];
      try {
        await existingChannel.delete();
        return safeMessageReply(
          message,
          `${emojis.bot.succes} Kanal kapatıldı ve geçmiş silindi.`,
        );
      } catch (e) {
        console.error('Kanal silinemedi:', e);
        return safeMessageReply(
          message,
          animeError(`Kanal silinemedi: ${e.message}`),
        );
      }
    }

    return safeMessageReply(
      message,
      `${emojis.bot.error} Lütfen \`create\`, \`restart\` veya \`close\` altkomutlarını kullanın.`,
    );
  },
};

async function safeMessageReply(message, content, options = {}) {
  try {
    if (message.channel && message.channel.send)
      return await message.reply({ content, ...options });
    return await message.author.send({ content, ...options });
  } catch (e) {
    try {
      return await message.author.send({ content, ...options });
    } catch (err) {
      console.error('safeMessageReply hata:', err);
    }
  }
}

async function safeDefer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.deferUpdate();
    }
  } catch (e) {}
}

async function safeInteractionRespond(interaction, payload = {}) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply(payload);
    } else {
      return await interaction.followUp(payload);
    }
  } catch (e) {
    try {
      if (!interaction.replied) return await interaction.reply(payload);
      return await interaction.followUp(payload);
    } catch (err) {
      console.error('safeInteractionRespond hata:', err);
    }
  }
}

function listenToTextChannel(client, channel, creator, botNameLocal) {
  listenToTextChannel._listeners = listenToTextChannel._listeners || new Set();
  if (listenToTextChannel._listeners.has(channel.id)) return;
  listenToTextChannel._listeners.add(channel.id);

  client.on('messageCreate', async (msg) => {
    if (msg.channel.id !== channel.id) return;
    if (msg.author.bot) return;
    if (msg.author.id !== creator.id) return;
    if (msg.content.startsWith(config.prefix)) return;

    const hist = conversationHistories[channel.id];
    if (!hist) {
      console.warn('Bu kanal için geçmiş kaydı yok:', channel.id);
      return safeMessageReply(
        msg,
        `${emojis.bot.error} Bu kanalda bot yapılandırması eksik. Yeniden \`create\` yapın.`,
      );
    }

    if (hist.suppressUserMessageCollector) return;

    let modelToUse =
      hist.defaultMode === 'deepseek' ? DEEP_MODEL : DEFAULT_MODEL;
    if (hist.defaultMode === 'coder') modelToUse = CODER_MODEL;
    if (hist.defaultMode === 'web') modelToUse = DEFAULT_MODEL;

    let modeForThisCall =
      hist.currentModeForNextMessage || hist.defaultMode || 'normal';
    if (!hist.toggleActive) delete hist.currentModeForNextMessage;

    if (modeForThisCall === 'deepseek') modelToUse = DEEP_MODEL;
    if (modeForThisCall === 'web') modelToUse = DEFAULT_MODEL;
    if (modeForThisCall === 'coder') modelToUse = CODER_MODEL;

    try {
      await msg.channel.sendTyping();
    } catch (e) {}

    let messagesToSend;
    if (hist.keepHistory) {
      messagesToSend = [
        ...hist.messages,
        { role: 'user', content: msg.content },
      ];
    } else {
      const system = hist.messages.find((m) => m.role === 'system');
      messagesToSend = [];
      if (system) messagesToSend.push(system);
      messagesToSend.push({ role: 'user', content: msg.content });
    }

    if (modeForThisCall === 'web') {
      try {
        const webSummary = await webSearchAndSummarize(
          config.SERPER_API_KEY,
          msg.content,
        );
        if (webSummary) {
          messagesToSend.push({
            role: 'system',
            content: `WEB_ARAMA_SONUÇLARI:\n${webSummary}`,
          });
        }
      } catch (e) {
        console.warn('Web arama hatası:', e.message);
      }
    }

    try {
      const attachmentsSystem = await gatherAttachedFilesContentFromMessage(
        msg,
        msg.content,
      );
      if (attachmentsSystem)
        messagesToSend.push({ role: 'system', content: attachmentsSystem });
    } catch (e) {
      console.warn('attachments gather error', e.message);
    }

    const tokenCheck = await aiHelper.checkAndConsumeToken(
      msg.author.id,
      msg.author.username,
    );
    if (!tokenCheck.allowed) {
      const warnMsg = await safeMessageReply(msg, tokenCheck.reason);
      setTimeout(() => {
        msg.delete().catch(() => {});
        if (warnMsg) warnMsg.delete().catch(() => {});
      }, 5000);
      return;
    }

    let aiResp;
    try {
      aiResp = await fetchChatFromOpenRouter(
        process.env.OPENROUTER_API_KEY ||
          msg.client?.config?.OPENROUTER_API_KEY,
        messagesToSend,
        modelToUse,
      );
    } catch (e) {
      console.error('OpenRouter hata:', e);
      await aiHelper.refundToken(msg.author.id);
      return safeMessageReply(
        msg,
        animeError('Cevap alınamadı (AI servisi hata verdi).'),
      );
    }

    const fullText = aiResp.text;
    let suggestions = aiResp.suggestions || [];

    if (modelToUse === DEEP_MODEL) {
      try {
        const suggPrompt = [
          {
            role: 'system',
            content:
              'Sen kısa, kullanıcının takip etmesi için 3 adet öneri üreten bir yardımcısın. Sadece şu formatda, ```json{"suggestions":["..."]}``` şeklinde çıktı ver.',
          },
          {
            role: 'user',
            content: `Kontekst: ${fullText}\nLütfen 3 kısa devam önerisi üret.`,
          },
        ];
        const suggResp = await fetchChatFromOpenRouter(
          process.env.OPENROUTER_API_KEY ||
            msg.client?.config?.OPENROUTER_API_KEY,
          suggPrompt,
          DEFAULT_MODEL,
        );
        if (suggResp && suggResp.suggestions && suggResp.suggestions.length)
          suggestions = suggResp.suggestions;
      } catch (e) {
        console.warn('Suggestions regen hata:', e.message);
      }
    }

    if (hist.keepHistory) {
      hist.messages.push({ role: 'user', content: msg.content });
      hist.messages.push({ role: 'assistant', content: fullText });
    }
    hist.lastModelUsed = modelToUse;

    const embed = new MessageEmbed()
      .setColor('#5865F2')
      .setAuthor({
        name: botNameLocal,
        iconURL: msg.client.user.displayAvatarURL(),
      })
      .setDescription('...')
      .setTimestamp()
      .setFooter({
        text: `✨ ${botNameLocal} • Yapay Zeka destekli yanıt • Model: ${modelToUse}`,
        iconURL: msg.client.user.displayAvatarURL(),
      });

    const components = [];
    if (suggestions.length > 0) {
      const row = new MessageActionRow();
      for (let i = 0; i < Math.min(3, suggestions.length); i++) {
        const customId = `yazigpt_sug_${channel.id}_${Date.now()}_${i}`;
        hist.suggestionsMap[customId] = suggestions[i];
        row.addComponents(
          new MessageButton()
            .setCustomId(customId)
            .setLabel(
              suggestions[i].length > 80
                ? suggestions[i].slice(0, 77) + '...'
                : suggestions[i],
            )
            .setStyle('SECONDARY')
            .setEmoji('➡️'),
        );
      }
      components.push(row);
    }

    const mmRow = new MessageActionRow();
    mmRow.addComponents(
      new MessageButton()
        .setCustomId(`yazigpt_multimodal_${channel.id}`)
        .setLabel('Multimodal')
        .setStyle('PRIMARY')
        .setEmoji('🧠'),
      new MessageButton()
        .setCustomId(`yazigpt_history_${channel.id}`)
        .setLabel('History')
        .setStyle('SECONDARY')
        .setEmoji('📜'),
    );
    components.push(mmRow);

    try {
      await sendChunkedEmbedResponses(
        channel,
        embed,
        fullText,
        components,
        hist,
      );
    } catch (e) {
      console.error('Embed gönderilemedi:', e);
      return safeMessageReply(
        msg,
        animeError('Embed gönderilirken hata oluştu.'),
      );
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const cid = interaction.customId;

    if (cid.startsWith('yazigpt_sug_')) {
      const parts = cid.split('_');
      const channelId = parts[2];
      if (channelId !== interaction.channel.id)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu düğme bu kanalda geçerli değil.`,
          ephemeral: true,
        });

      const hist = conversationHistories[interaction.channel.id];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu düğme süresi dolmuş.`,
          ephemeral: true,
        });

      const suggestion = hist.suggestionsMap[cid];
      if (!suggestion)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Öneri artık geçerli değil.`,
          ephemeral: true,
        });

      const tokenCheck = await aiHelper.checkAndConsumeToken(
        interaction.user.id,
        interaction.user.username,
      );
      if (!tokenCheck.allowed) {
        return safeInteractionRespond(interaction, {
          content: tokenCheck.reason,
          ephemeral: true,
        });
      }

      await safeDefer(interaction);

      try {
        const webhookClient = new WebhookClient({
          id: hist.webhookId,
          token: hist.webhookToken,
        });
        const displayName = interaction.member
          ? interaction.member.displayName
          : interaction.user.username;
        await webhookClient.send({
          content: suggestion,
          username: displayName,
          avatarURL: interaction.user.displayAvatarURL({ format: 'png' }),
        });
      } catch (e) {
        console.warn('Webhook hatası:', e);
        await interaction.followUp({
          content: `${interaction.user}: ${suggestion}`,
          ephemeral: false,
        });
      }

      let modelToUse =
        hist.defaultMode === 'deepseek' ? DEEP_MODEL : DEFAULT_MODEL;
      if (hist.defaultMode === 'coder') modelToUse = CODER_MODEL;
      if (hist.defaultMode === 'web') modelToUse = DEFAULT_MODEL;

      const modeForThis =
        hist.currentModeForNextMessage || hist.defaultMode || 'normal';
      if (!hist.toggleActive) delete hist.currentModeForNextMessage;
      if (modeForThis === 'deepseek') modelToUse = DEEP_MODEL;
      if (modeForThis === 'coder') modelToUse = CODER_MODEL;

      let messagesToSend;
      if (hist.keepHistory) {
        hist.messages.push({ role: 'user', content: suggestion });
        messagesToSend = [...hist.messages];
      } else {
        const system = hist.messages.find((m) => m.role === 'system');
        messagesToSend = [];
        if (system) messagesToSend.push(system);
        messagesToSend.push({ role: 'user', content: suggestion });
      }

      if (modeForThis === 'web') {
        try {
          const webSummary = await webSearchAndSummarize(
            config.SERPER_API_KEY,
            suggestion,
          );
          if (webSummary)
            messagesToSend.push({
              role: 'system',
              content: `WEB_ARAMA_SONUÇLARI:\n${webSummary}`,
            });
        } catch (e) {
          console.warn('Web arama hatası (suggestion):', e.message);
        }
      }

      try {
        await interaction.channel.sendTyping();
      } catch (e) {}

      let aiResp;
      try {
        aiResp = await fetchChatFromOpenRouter(
          process.env.OPENROUTER_API_KEY ||
            interaction.client?.config?.OPENROUTER_API_KEY,
          messagesToSend,
          modelToUse,
        );
      } catch (e) {
        console.error('OpenRouter hata (suggestion):', e);
        await aiHelper.refundToken(interaction.user.id);
        return interaction.followUp({
          content: animeError('AI servisine ulaşılamadı.'),
          ephemeral: true,
        });
      }

      const text = aiResp.text;
      let suggestions = aiResp.suggestions || [];

      if (modelToUse === DEEP_MODEL) {
        try {
          const suggPrompt = [
            {
              role: 'system',
              content:
                'Kısa 3 devam önerisi üret ve JSON içinde önerileri döndür: ```json{ "suggestions": ["...","...","..."] }```',
            },
            {
              role: 'user',
              content: `Kontekst: ${text}\nLütfen 3 kısa devam önerisi üret.`,
            },
          ];
          const suggResp = await fetchChatFromOpenRouter(
            process.env.OPENROUTER_API_KEY ||
              interaction.client?.config?.OPENROUTER_API_KEY,
            suggPrompt,
            DEFAULT_MODEL,
          );
          if (suggResp && suggResp.suggestions && suggResp.suggestions.length)
            suggestions = suggResp.suggestions;
        } catch (e) {
          console.warn(
            'Suggestions regen hata (suggestion button):',
            e.message,
          );
        }
      }

      if (hist.keepHistory)
        hist.messages.push({ role: 'assistant', content: text });
      hist.lastModelUsed = modelToUse;

      const embed = new MessageEmbed()
        .setColor('#57F287')
        .setAuthor({
          name: botNameLocal,
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setDescription('...')
        .addFields({ name: 'Model', value: modelToUse, inline: true })
        .setTimestamp()
        .setFooter({
          text: `✨ ${botNameLocal} • Yapay Zeka destekli yanıt • Model: ${modelToUse}`,
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      const components = [];
      if (suggestions.length > 0) {
        const row = new MessageActionRow();
        for (let i = 0; i < Math.min(3, suggestions.length); i++) {
          const newCid = `yazigpt_sug_${
            interaction.channel.id
          }_${Date.now()}_${i}`;
          hist.suggestionsMap[newCid] = suggestions[i];
          row.addComponents(
            new MessageButton()
              .setCustomId(newCid)
              .setLabel(
                suggestions[i].length > 80
                  ? suggestions[i].slice(0, 77) + '...'
                  : suggestions[i],
              )
              .setStyle('SECONDARY')
              .setEmoji('➡️'),
          );
        }
        components.push(row);
      }
      const mmRow2 = new MessageActionRow();
      mmRow2.addComponents(
        new MessageButton()
          .setCustomId(`yazigpt_multimodal_${interaction.channel.id}`)
          .setLabel('Multimodal')
          .setStyle('PRIMARY')
          .setEmoji('🧠'),
        new MessageButton()
          .setCustomId(`yazigpt_history_${interaction.channel.id}`)
          .setLabel('History')
          .setStyle('SECONDARY')
          .setEmoji('📜'),
      );
      components.push(mmRow2);

      await sendChunkedEmbedResponses(
        interaction.channel,
        embed,
        text,
        components,
        hist,
      );
      return;
    }

    if (cid.startsWith('yazigpt_multimodal_')) {
      const parts = cid.split('_');
      const channelId = parts[2];
      if (channelId !== interaction.channel.id)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu düğme burada geçerli değil.`,
          ephemeral: true,
        });

      const hist = conversationHistories[interaction.channel.id];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu düğme artık geçerli değil.`,
          ephemeral: true,
        });

      await safeDefer(interaction);

      let lastMsg = null;
      try {
        if (hist.lastEmbedMessageId)
          lastMsg = await interaction.channel.messages.fetch(
            hist.lastEmbedMessageId,
          );
      } catch (e) {}

      try {
        if (lastMsg) {
          hist._savedEmbedState = {
            embeds: lastMsg.embeds ? lastMsg.embeds.map((e) => e) : null,
            components: lastMsg.components ? lastMsg.components : null,
            messageId: lastMsg.id,
          };
        }
      } catch (e) {}

      const modalRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(`yazigpt_mode_deepseek_${interaction.channel.id}`)
          .setLabel(
            hist.defaultMode === 'deepseek'
              ? '🚫 Normal Moda Dön'
              : '⚡ Düşünme Modu',
          )
          .setStyle(hist.defaultMode === 'deepseek' ? 'SUCCESS' : 'SECONDARY')
          .setEmoji('⚡'),
        new MessageButton()
          .setCustomId(`yazigpt_mode_web_${interaction.channel.id}`)
          .setLabel(
            hist.defaultMode === 'web'
              ? '🚫 Normal Moda Dön'
              : '🌐 Web Arama Modu',
          )
          .setStyle(hist.defaultMode === 'web' ? 'SUCCESS' : 'SECONDARY')
          .setEmoji('🌐'),
        new MessageButton()
          .setCustomId(`yazigpt_mode_coder_${interaction.channel.id}`)
          .setLabel(
            hist.defaultMode === 'coder'
              ? '🚫 Normal Moda Dön'
              : '🛠️ Coder Modu',
          )
          .setStyle(hist.defaultMode === 'coder' ? 'SUCCESS' : 'SECONDARY')
          .setEmoji('💻'),
        new MessageButton()
          .setCustomId(`yazigpt_mode_toggle_${interaction.channel.id}`)
          .setLabel(hist.toggleActive ? '🔁 Toggle: Açık' : '🔁 Toggle: Kapalı')
          .setStyle(hist.toggleActive ? 'SUCCESS' : 'SECONDARY')
          .setEmoji('🔁'),
      );

      try {
        if (lastMsg) {
          const embed =
            lastMsg.embeds[0] || new MessageEmbed().setDescription('...');
          await lastMsg.edit({ embeds: [embed], components: [modalRow] });
          return interaction.followUp({
            content: `${emojis.bot.succes} Multimodal kontroller açıldı (embed güncellendi).`,
            ephemeral: true,
          });
        } else {
          return interaction.followUp({
            content: `${emojis.bot.succes} Multimodal kontroller (embed bulunamadı — ephemeral).`,
            components: [modalRow],
            ephemeral: true,
          });
        }
      } catch (e) {
        console.warn('Embed edit hatası (multimodal):', e);
        return interaction.followUp({
          content: animeError('Multimodal açılırken hata oluştu.'),
          ephemeral: true,
        });
      }
    }

    if (cid.startsWith('yazigpt_mode_')) {
      const parts = cid.split('_');
      const action = parts[2];
      const channelId = parts[3];
      if (channelId !== interaction.channel.id)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu düğme burada geçerli değil.`,
          ephemeral: true,
        });

      const hist = conversationHistories[interaction.channel.id];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Kayıtlı kanal geçmişi bulunamadı.`,
          ephemeral: true,
        });

      await safeDefer(interaction);

      if (action === 'toggle') {
        hist.toggleActive = !hist.toggleActive;
        try {
          if (hist.lastEmbedMessageId) {
            const lastMsg = await interaction.channel.messages.fetch(
              hist.lastEmbedMessageId,
            );
            const embed =
              lastMsg.embeds[0] || new MessageEmbed().setDescription('...');
            const row = new MessageActionRow().addComponents(
              new MessageButton()
                .setCustomId(`yazigpt_mode_deepseek_${interaction.channel.id}`)
                .setLabel(
                  hist.defaultMode === 'deepseek'
                    ? '🚫 Normal Moda Dön'
                    : '⚡ Düşünme Modu',
                )
                .setStyle(
                  hist.defaultMode === 'deepseek' ? 'SUCCESS' : 'SECONDARY',
                )
                .setEmoji('⚡'),
              new MessageButton()
                .setCustomId(`yazigpt_mode_web_${interaction.channel.id}`)
                .setLabel(
                  hist.defaultMode === 'web'
                    ? '🚫 Normal Moda Dön'
                    : '🌐 Web Arama Modu',
                )
                .setStyle(hist.defaultMode === 'web' ? 'SUCCESS' : 'SECONDARY')
                .setEmoji('🌐'),
              new MessageButton()
                .setCustomId(`yazigpt_mode_coder_${interaction.channel.id}`)
                .setLabel(
                  hist.defaultMode === 'coder'
                    ? '🚫 Normal Moda Dön'
                    : '🛠️ Coder Modu',
                )
                .setStyle(
                  hist.defaultMode === 'coder' ? 'SUCCESS' : 'SECONDARY',
                )
                .setEmoji('💻'),
              new MessageButton()
                .setCustomId(`yazigpt_mode_toggle_${interaction.channel.id}`)
                .setLabel(
                  hist.toggleActive ? '🔁 Toggle: Açık' : '🔁 Toggle: Kapalı',
                )
                .setStyle(hist.toggleActive ? 'SUCCESS' : 'SECONDARY')
                .setEmoji('🔁'),
            );
            await lastMsg.edit({ embeds: [embed], components: [row] });
          }
        } catch (e) {
          console.warn('Embed edit (toggle) hata:', e);
        }

        return interaction.followUp({
          content: `${emojis.bot.succes} Toggle durumu: ${
            hist.toggleActive
              ? 'Açık — seçilen moda kalıcı geçilecek'
              : 'Kapalı — moda sadece bir sonraki mesaja uygulanacak'
          }`,
          ephemeral: true,
        });
      }

      if (action === 'deepseek' || action === 'web' || action === 'coder') {
        const modelForResponse =
          action === 'deepseek'
            ? DEEP_MODEL
            : action === 'coder'
              ? CODER_MODEL
              : DEFAULT_MODEL;

        let lastUserMessage = null;
        try {
          lastUserMessage = await fetchLastUserMessage(interaction.channel);
        } catch (e) {
          lastUserMessage = null;
        }

        if (hist.toggleActive) {
          if (hist.defaultMode === action) {
            hist.defaultMode = 'normal';
          } else {
            hist.defaultMode = action;
          }
          hist.toggleActive = false;
          try {
            if (hist.lastEmbedMessageId) {
              const lastMsg = await interaction.channel.messages.fetch(
                hist.lastEmbedMessageId,
              );
              const embedToEdit =
                lastMsg.embeds[0] || new MessageEmbed().setDescription('...');
              const row = new MessageActionRow().addComponents(
                new MessageButton()
                  .setCustomId(
                    `yazigpt_mode_deepseek_${interaction.channel.id}`,
                  )
                  .setLabel(
                    hist.defaultMode === 'deepseek'
                      ? '🚫 Normal Moda Dön'
                      : '⚡ Düşünme Modu',
                  )
                  .setStyle(
                    hist.defaultMode === 'deepseek' ? 'SUCCESS' : 'SECONDARY',
                  )
                  .setEmoji('⚡'),
                new MessageButton()
                  .setCustomId(`yazigpt_mode_web_${interaction.channel.id}`)
                  .setLabel(
                    hist.defaultMode === 'web'
                      ? '🚫 Normal Moda Dön'
                      : '🌐 Web Arama Modu',
                  )
                  .setStyle(
                    hist.defaultMode === 'web' ? 'SUCCESS' : 'SECONDARY',
                  )
                  .setEmoji('🌐'),
                new MessageButton()
                  .setCustomId(`yazigpt_mode_coder_${interaction.channel.id}`)
                  .setLabel(
                    hist.defaultMode === 'coder'
                      ? '🚫 Normal Moda Dön'
                      : '🛠️ Coder Modu',
                  )
                  .setStyle(
                    hist.defaultMode === 'coder' ? 'SUCCESS' : 'SECONDARY',
                  )
                  .setEmoji('💻'),
                new MessageButton()
                  .setCustomId(`yazigpt_mode_toggle_${interaction.channel.id}`)
                  .setLabel('🔁 Toggle: Kapalı')
                  .setStyle('SECONDARY')
                  .setEmoji('🔁'),
              );
              await lastMsg.edit({ embeds: [embedToEdit], components: [row] });
            }
          } catch (e) {}
          return interaction.followUp({
            content: `${emojis.bot.succes} Varsayılan mod "${hist.defaultMode}" olarak ayarlandı. Toggle kapatıldı.`,
            ephemeral: true,
          });
        } else {
          if (!lastUserMessage) {
            return interaction.followUp({
              content: `${emojis.bot.error} İşlenecek son kullanıcı mesajı bulunamadı.`,
              ephemeral: true,
            });
          }

          const tokenCheck = await aiHelper.checkAndConsumeToken(
            interaction.user.id,
            interaction.user.username,
          );
          if (!tokenCheck.allowed) {
            return interaction.followUp({
              content: tokenCheck.reason,
              ephemeral: true,
            });
          }

          try {
            await lastUserMessage.delete().catch(() => {});
          } catch (e) {}

          let messagesToSend = [];
          if (hist.keepHistory) {
            messagesToSend = [...hist.messages];
            messagesToSend.push({
              role: 'user',
              content: lastUserMessage.content || '',
            });
          } else {
            const system = hist.messages.find((m) => m.role === 'system');
            if (system) messagesToSend.push(system);
            messagesToSend.push({
              role: 'user',
              content: lastUserMessage.content || '',
            });
          }

          try {
            const attachmentsSystem =
              await gatherAttachedFilesContentFromMessage(
                lastUserMessage,
                lastUserMessage.content || '',
              );
            if (attachmentsSystem)
              messagesToSend.push({
                role: 'system',
                content: attachmentsSystem,
              });
          } catch (e) {}

          try {
            await interaction.channel.sendTyping();
          } catch (e) {}

          let aiResp;
          try {
            aiResp = await fetchChatFromOpenRouter(
              process.env.OPENROUTER_API_KEY ||
                interaction.client?.config?.OPENROUTER_API_KEY,
              messagesToSend,
              modelForResponse,
            );
          } catch (e) {
            console.error('OpenRouter hata (multimodal immediate):', e);
            await aiHelper.refundToken(interaction.user.id);
            return interaction.followUp({
              content: animeError('AI servisine ulaşılamadı.'),
              ephemeral: true,
            });
          }

          let text = aiResp.text;
          let suggestions = aiResp.suggestions || [];

          if (modelForResponse === DEEP_MODEL) {
            try {
              const suggPrompt = [
                {
                  role: 'system',
                  content:
                    'Kısa 3 devam önerisi üret ve JSON içinde önerileri döndür: ```json{ "suggestions": ["...","...","..."] }```',
                },
                {
                  role: 'user',
                  content: `Kontekst: ${text}\nLütfen 3 kısa devam önerisi üret.`,
                },
              ];
              const suggResp = await fetchChatFromOpenRouter(
                process.env.OPENROUTER_API_KEY ||
                  interaction.client?.config?.OPENROUTER_API_KEY,
                suggPrompt,
                DEFAULT_MODEL,
              );
              if (
                suggResp &&
                suggResp.suggestions &&
                suggResp.suggestions.length
              )
                suggestions = suggResp.suggestions;
            } catch (e) {}
          }

          if (hist.keepHistory)
            hist.messages.push({ role: 'assistant', content: text });
          hist.lastModelUsed = modelForResponse;

          try {
            const newEmbed = new MessageEmbed()
              .setColor('#57F287')
              .setAuthor({
                name: botNameLocal,
                iconURL: interaction.client.user.displayAvatarURL(),
              })
              .setDescription('...')
              .addFields({
                name: 'Model',
                value: modelForResponse,
                inline: true,
              })
              .setTimestamp()
              .setFooter({
                text: `✨ ${botNameLocal} • Yapay Zeka destekli yanıt • Model: ${modelForResponse}`,
                iconURL: interaction.client.user.displayAvatarURL(),
              });

            const sendComponents = [];
            if (suggestions.length > 0) {
              const row = new MessageActionRow();
              for (let i = 0; i < Math.min(3, suggestions.length); i++) {
                const cid = `yazigpt_sug_${
                  interaction.channel.id
                }_${Date.now()}_${i}`;
                hist.suggestionsMap[cid] = suggestions[i];
                row.addComponents(
                  new MessageButton()
                    .setCustomId(cid)
                    .setLabel(
                      suggestions[i].length > 80
                        ? suggestions[i].slice(0, 77) + '...'
                        : suggestions[i],
                    )
                    .setStyle('SECONDARY')
                    .setEmoji('➡️'),
                );
              }
              sendComponents.push(row);
            }
            const mmRow = new MessageActionRow();
            mmRow.addComponents(
              new MessageButton()
                .setCustomId(`yazigpt_multimodal_${interaction.channel.id}`)
                .setLabel('Multimodal')
                .setStyle('PRIMARY')
                .setEmoji('🧠'),
              new MessageButton()
                .setCustomId(`yazigpt_history_${interaction.channel.id}`)
                .setLabel('History')
                .setStyle('SECONDARY')
                .setEmoji('📜'),
            );
            sendComponents.push(mmRow);

            await sendChunkedEmbedResponses(
              interaction.channel,
              newEmbed,
              text,
              sendComponents,
              hist,
            );

            return interaction.followUp({
              content: `${emojis.bot.succes} Seçilen model ile yanıt gönderildi.`,
              ephemeral: true,
            });
          } catch (e) {
            console.warn('Embed düzenlenemedi (multimodal immediate):', e);
            return interaction.followUp({
              content: animeError('Embed düzenlenirken hata oluştu.'),
              ephemeral: true,
            });
          }
        }
      }
    }

    if (cid.startsWith('yazigpt_history_')) {
      const parts = cid.split('_');
      const channelId = parts[2];
      if (channelId !== interaction.channel.id)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu düğme burada geçerli değil.`,
          ephemeral: true,
        });

      const hist = conversationHistories[interaction.channel.id];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Geçmiş bulunamadı.`,
          ephemeral: true,
        });

      try {
        if (hist.lastEmbedMessageId) {
          const msg = await interaction.channel.messages.fetch(
            hist.lastEmbedMessageId,
          );
          hist._savedEmbedState = {
            embeds: msg.embeds ? msg.embeds.map((e) => e) : null,
            components: msg.components ? msg.components : null,
            messageId: msg.id,
          };
        }
      } catch (e) {}

      const userId = interaction.user.id;
      if (typeof hist.historyPageByUser[userId] === 'undefined')
        hist.historyPageByUser[userId] = 0;
      const page = hist.historyPageByUser[userId];

      await safeInteractionRespond(interaction, {
        content: `${emojis.bot.succes} Geçmiş gösteriliyor...`,
        ephemeral: true,
      });
      await sendHistoryPage(interaction, hist, page);
      return;
    }

    if (cid.startsWith('yazigpt_histnav_')) {
      const parts = cid.split('_');
      const channelId = parts[2];
      const userId = parts[3];
      const cmd = parts[4];
      let currentPage = Number(parts[5]) || 0;

      if (interaction.user.id !== userId)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu arayüz sadece butona basan kullanıcı için geçerli.`,
          ephemeral: true,
        });

      const hist = conversationHistories[channelId];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Geçmiş bulunamadı.`,
          ephemeral: true,
        });

      const perPage = 10;
      const totalPages = Math.max(
        1,
        Math.ceil(Math.max(0, hist.messages.length) / perPage),
      );

      if (cmd === 'prev') currentPage = Math.max(0, currentPage - 1);
      if (cmd === 'next')
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      if (cmd === 'prev10') currentPage = Math.max(0, currentPage - 10);
      if (cmd === 'next10')
        currentPage = Math.min(totalPages - 1, currentPage + 10);
      if (cmd === 'close') {
        try {
          if (hist._savedEmbedState && hist._savedEmbedState.messageId) {
            const lastMsg = await interaction.channel.messages.fetch(
              hist._savedEmbedState.messageId,
            );
            const embeds = hist._savedEmbedState.embeds || [];
            const components = hist._savedEmbedState.components || [];
            await lastMsg.edit({ embeds, components });
            hist._savedEmbedState = null;
            return safeInteractionRespond(interaction, {
              content: `${emojis.bot.succes} History kapatıldı ve önceki embed geri yüklendi.`,
              ephemeral: true,
            });
          }
        } catch (e) {
          console.warn('History close - eski embed geri yüklenemedi:', e);
        }
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.succes} History kapatıldı.`,
          ephemeral: true,
        });
      }

      hist.historyPageByUser[userId] = currentPage;
      return sendHistoryPage(interaction, hist, currentPage);
    }

    if (cid.startsWith('yazigpt_histedit_')) {
      const parts = cid.split('_');
      const channelId = parts[2];
      const userId = parts[3];
      if (interaction.user.id !== userId)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu arayüz sadece butona basan kullanıcı için geçerli.`,
          ephemeral: true,
        });

      const hist = conversationHistories[channelId];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Geçmiş bulunamadı.`,
          ephemeral: true,
        });

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(`yazigpt_histdelete_${channelId}_${userId}`)
          .setLabel('🗑️ Delete index')
          .setStyle('DANGER'),
        new MessageButton()
          .setCustomId(`yazigpt_histedit_send_${channelId}_${userId}`)
          .setLabel('✏️ Edit (gönder)')
          .setStyle('PRIMARY'),
      );

      await safeInteractionRespond(interaction, {
        content:
          "Lütfen düzenleme için şu formatta bir mesaj gönder: `index | role | yeni metin`\nÖrnek: `5 | assistant | Bu cümle artık şu şekilde.`\n(Veya silmek için 'Delete index' butonuna basın). (15 saniye içinde gönder)",
        components: [row],
        ephemeral: true,
      });

      hist.suppressUserMessageCollector = true;
      const filter = (m) => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 15000,
        max: 1,
      });

      collector.on('collect', (m) => {
        const content = m.content;
        const parts = content.split('|').map((s) => s.trim());
        if (parts.length < 3) {
          hist.suppressUserMessageCollector = false;
          return interaction.followUp({
            content: `${emojis.bot.error} Yanlış format. İşlem iptal edildi.`,
            ephemeral: true,
          });
        }
        const idx = Number(parts[0]);
        const role = parts[1];
        const newText = parts.slice(2).join('|').trim();
        if (isNaN(idx) || !['user', 'assistant', 'system'].includes(role)) {
          hist.suppressUserMessageCollector = false;
          return interaction.followUp({
            content: `${emojis.bot.error} Geçersiz index veya role. İptal edildi.`,
            ephemeral: true,
          });
        }
        if (!hist.messages[idx]) {
          hist.suppressUserMessageCollector = false;
          return interaction.followUp({
            content: `${emojis.bot.error} Geçersiz index.`,
            ephemeral: true,
          });
        }

        hist.messages[idx] = { role, content: newText };
        hist.suppressUserMessageCollector = false;
        return interaction.followUp({
          content: `${emojis.bot.succes} Mesaj #${idx} düzenlendi.`,
          ephemeral: true,
        });
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          hist.suppressUserMessageCollector = false;
          interaction.followUp({
            content: `${emojis.bot.error} Zaman aşımı — düzenleme iptal edildi.`,
            ephemeral: true,
          });
        }
      });

      return;
    }

    if (cid.startsWith('yazigpt_histdelete_')) {
      const parts = cid.split('_');
      const channelId = parts[2];
      const userId = parts[3];
      if (interaction.user.id !== userId)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Bu arayüz sadece butona basan kullanıcı için geçerli.`,
          ephemeral: true,
        });

      const hist = conversationHistories[channelId];
      if (!hist)
        return safeInteractionRespond(interaction, {
          content: `${emojis.bot.error} Geçmiş bulunamadı.`,
          ephemeral: true,
        });

      await safeDefer(interaction);
      await interaction.followUp({
        content: `${emojis.bot.succes} Silmek istediğiniz mesajın index'ini sadece sayı olarak gönderin (15 saniye).`,
        ephemeral: true,
      });

      hist.suppressUserMessageCollector = true;
      const filter = (m) => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 15000,
        max: 1,
      });

      collector.on('collect', (m) => {
        const idx = Number(m.content.trim());
        if (isNaN(idx) || !hist.messages[idx]) {
          hist.suppressUserMessageCollector = false;
          return interaction.followUp({
            content: `${emojis.bot.error} Geçersiz index veya mesaj bulunamadı. İşlem iptal edildi.`,
            ephemeral: true,
          });
        }
        hist.messages.splice(idx, 1);
        hist.suppressUserMessageCollector = false;
        return interaction.followUp({
          content: `${emojis.bot.succes} Mesaj #${idx} silindi.`,
          ephemeral: true,
        });
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          hist.suppressUserMessageCollector = false;
          interaction.followUp({
            content: `${emojis.bot.error} Zaman aşımı — silme iptal edildi.`,
            ephemeral: true,
          });
        }
      });

      return;
    }
  });
}

async function editEmbedOnce(
  messageOrMessageObj,
  baseEmbed,
  fullText,
  components = null,
) {
  try {
    let desc = typeof fullText === 'string' ? fullText : String(fullText || '');
    if (!desc.trim()) desc = ' ';

    const MAX_DESC = 4096;
    if (desc.length > MAX_DESC) {
      desc = desc.slice(0, MAX_DESC - 3) + '...';
    }

    if (typeof baseEmbed.setDescription === 'function') {
      baseEmbed.setDescription(desc);
    } else {
      baseEmbed = new (require('discord.js').MessageEmbed)().setDescription(
        desc,
      );
    }

    if (typeof messageOrMessageObj.edit === 'function') {
      const payload = { embeds: [baseEmbed] };
      if (components) payload.components = components;
      const edited = await messageOrMessageObj.edit(payload);
      return edited;
    } else {
      console.warn(
        'editEmbedOnce: messageOrMessageObj.edit fonksiyonu bulunamadı.',
      );
      return null;
    }
  } catch (err) {
    console.error('editEmbedOnce hata:', err);
    return null;
  }
}

async function sendHistoryPage(
  interactionOrInteractionReplyTarget,
  hist,
  page = 0,
) {
  const messages = hist.messages || [];
  const perPage = 10;
  const totalPages = Math.max(
    1,
    Math.ceil(Math.max(0, messages.length) / perPage),
  );
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const start = safePage * perPage;
  const slice = messages.slice(start, start + perPage);

  const lines = slice.map((m, i) => {
    const idx = start + i;
    return `#${idx} [${m.role}] ${
      m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content
    }`;
  }) || ['Geçmiş boş.'];

  const embed = new MessageEmbed()
    .setTitle(`Geçmiş — sayfa ${safePage + 1}/${totalPages}`)
    .setDescription(lines.join('\n\n'))
    .setFooter({
      text: `Toplam ${messages.length} mesaj • Model: ${
        hist.lastModelUsed || 'unknown'
      }`,
    })
    .setTimestamp();

  const navRow = new MessageActionRow();
  if (safePage > 9)
    navRow.addComponents(
      new MessageButton()
        .setCustomId(
          `yazigpt_histnav_${interactionOrInteractionReplyTarget.channel.id}_${interactionOrInteractionReplyTarget.user.id}_prev10_${safePage}`,
        )
        .setLabel('<< 10')
        .setStyle('SECONDARY'),
    );
  if (safePage > 0)
    navRow.addComponents(
      new MessageButton()
        .setCustomId(
          `yazigpt_histnav_${interactionOrInteractionReplyTarget.channel.id}_${interactionOrInteractionReplyTarget.user.id}_prev_${safePage}`,
        )
        .setLabel('← 1')
        .setStyle('SECONDARY'),
    );
  if (safePage < totalPages - 1)
    navRow.addComponents(
      new MessageButton()
        .setCustomId(
          `yazigpt_histnav_${interactionOrInteractionReplyTarget.channel.id}_${interactionOrInteractionReplyTarget.user.id}_next_${safePage}`,
        )
        .setLabel('1 →')
        .setStyle('SECONDARY'),
    );
  if (safePage < totalPages - 10)
    navRow.addComponents(
      new MessageButton()
        .setCustomId(
          `yazigpt_histnav_${interactionOrInteractionReplyTarget.channel.id}_${interactionOrInteractionReplyTarget.user.id}_next10_${safePage}`,
        )
        .setLabel('10 →>')
        .setStyle('SECONDARY'),
    );

  const actionRow2 = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId(
        `yazigpt_histedit_${interactionOrInteractionReplyTarget.channel.id}_${interactionOrInteractionReplyTarget.user.id}_${safePage}`,
      )
      .setLabel('✏️ Edit')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId(
        `yazigpt_histnav_${interactionOrInteractionReplyTarget.channel.id}_${interactionOrInteractionReplyTarget.user.id}_close_${safePage}`,
      )
      .setLabel('❌ Close')
      .setStyle('DANGER'),
  );

  const rows = [];
  if (navRow.components && navRow.components.length > 0) rows.push(navRow);
  if (actionRow2.components && actionRow2.components.length > 0)
    rows.push(actionRow2);

  try {
    if (interactionOrInteractionReplyTarget.update) {
      await interactionOrInteractionReplyTarget.followUp({
        embeds: [embed],
        components: rows,
        ephemeral: true,
      });
    } else if (interactionOrInteractionReplyTarget.reply) {
      await interactionOrInteractionReplyTarget.reply({
        embeds: [embed],
        components: rows,
        ephemeral: true,
      });
    } else {
      await interactionOrInteractionReplyTarget.followUp({
        embeds: [embed],
        components: rows,
        ephemeral: true,
      });
    }
  } catch (e) {
    try {
      await interactionOrInteractionReplyTarget.followUp({
        embeds: [embed],
        components: rows,
        ephemeral: true,
      });
    } catch (err) {
      console.error('History view gönderilemedi:', err);
    }
  }
}

async function fetchChatFromOpenRouter(
  apiKey,
  messages,
  model = DEFAULT_MODEL,
) {
  let actualKey =
    apiKey || process.env.OPENROUTER_API_KEY || config.OPENROUTER_API_KEY;
  let isGroq = false;

  if (!actualKey) {
    actualKey = process.env.GROQ_API_KEY || config.GROQ_API_KEY;
    if (actualKey) {
      isGroq = true;
    }
  } else if (actualKey.startsWith('gsk_')) {
    isGroq = true;
  }

  if (!actualKey) throw new Error('Yapay zeka API anahtarı yok.');

  const now = Date.now();
  const elapsed = now - (openRouterLastCall.time || 0);
  if (elapsed < OPENROUTER_MIN_INTERVAL_MS) {
    await sleep(OPENROUTER_MIN_INTERVAL_MS - elapsed);
  }
  openRouterLastCall.time = Date.now();

  const url = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : OPENROUTER_URL;
  let modelToUse = model;
  if (isGroq) {
    if (model === DEEP_MODEL || model === CODER_MODEL) {
      modelToUse = DEFAULT_MODEL;
    }
  }

  const payload = {
    model: modelToUse,
    messages,
    max_tokens: 1200,
    temperature: 0.8,
  };

  let res;
  try {
    res = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${actualKey}`,
      },
      timeout: 40000,
    });
  } catch (e) {
    console.error('API POST hata:', e.message);
    throw e;
  }

  const data = res.data;

  let content = null;
  try {
    const choice = data?.choices && data.choices[0] ? data.choices[0] : null;
    const candidateMsg = choice?.message ?? choice;

    const extractFrom = (obj) => {
      if (!obj && obj !== '') return null;
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'number' || typeof obj === 'boolean')
        return String(obj);

      if (Array.isArray(obj)) {
        return obj
          .map((c) => {
            if (typeof c === 'string') return c;
            if (typeof c === 'object' && c !== null) {
              return (
                c.text ??
                c.content ??
                (Array.isArray(c.parts) ? c.parts.join('') : null) ??
                JSON.stringify(c)
              );
            }
            return String(c);
          })
          .join('\n')
          .trim();
      }

      if (typeof obj === 'object') {
        if (typeof obj.content === 'string') return obj.content;
        if (Array.isArray(obj.content)) return extractFrom(obj.content);
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.output_text === 'string') return obj.output_text;
        if (typeof obj.payload === 'string') return obj.payload;
        if (Array.isArray(obj.parts)) return obj.parts.join('');
        if (obj[0]) return extractFrom(obj[0]);
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === 'string' && obj[k].length > 0) return obj[k];
          if (
            Array.isArray(obj[k]) &&
            obj[k].every((x) => typeof x === 'string')
          )
            return obj[k].join('');
        }
        return JSON.stringify(obj);
      }

      return null;
    };

    content =
      extractFrom(candidateMsg) ||
      extractFrom(choice?.text) ||
      extractFrom(data?.output) ||
      extractFrom(data?.response) ||
      extractFrom(data);

    if (content && typeof content === 'string') content = content.trim();
  } catch (e) {
    console.warn('İçerik çıkarılırken hata:', e.message);
    content = null;
  }

  if (!content) {
    const short = JSON.stringify(data, (k, v) => {
      if (typeof v === 'string' && v.length > 200)
        return v.slice(0, 200) + '...';
      return v;
    });
    console.error('Beklenmedik yanıt formatı:', short);
    throw new Error('AI yanıtı beklenmedik formatta geldi.');
  }

  let suggestions = [];
  try {
    let match = content.match(/```json\s*([\s\S]*?)```/i);
    let parsed = null;
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch (e) {
        const cleaned = match[1].replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
        parsed = JSON.parse(cleaned);
      }
    } else {
      const jsonMatch = content.match(/(\{[\s\S]*"suggestions"[\s\S]*?\})/i);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      }
    }

    if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions;
      content = content.replace(/```json[\s\S]*?```/i, '').trim();
      content = content
        .replace(/(\{[\s\S]*"suggestions"[\s\S]*?\})/i, '')
        .trim();
    }
  } catch (e) {
    console.warn('Suggestions parse hatası (tolere edildi):', e.message);
  }

  return { text: String(content).trim(), suggestions };
}

async function webSearchAndSummarize(serperKey, query) {
  if (!serperKey) throw new Error('SERPER_API_KEY tanımlı değil.');
  try {
    const endpoint = 'https://google.serper.dev/search';
    const res = await axios.get(endpoint, {
      params: { q: query, num: 5 },
      headers: { 'X-API-KEY': serperKey },
      timeout: 15000,
    });
    const data = res.data;
    const snippets = [];
    if (data?.organic) {
      for (const item of data.organic.slice(0, 5)) {
        if (item.snippet)
          snippets.push(`- ${item.title || item.link}\n  ${item.snippet}`);
        else snippets.push(`- ${item.title || item.link}`);
      }
    } else if (data?.organic_results) {
      for (const item of data.organic_results.slice(0, 5)) {
        if (item.snippet)
          snippets.push(`- ${item.title || item.link}\n  ${item.snippet}`);
        else snippets.push(`- ${item.title || item.link}`);
      }
    }
    return snippets.length ? snippets.join('\n\n') : 'Arama sonucu bulunamadı.';
  } catch (e) {
    console.warn('Serper arama hatası:', e.message);
    return null;
  }
}

module.exports.help = {
  name: 'yazıgpt',
  aliases: [],
  usage: 'yazıgpt <create|restart|close>',
  description: `${botname} ile yazılı modda sohbet gerçekleştirir.`,
  category: 'Yapay Zeka',
  cooldown: 5,
  extraFields: [
    {
      name: 'Alt Komutlar',
      value:
        '`yazıgpt create`: Size özel bir sohbet kanalı oluşturur ve dinlemeye başlar.\n' +
        '`yazıgpt restart`: Mevcut sohbet kanalınızdaki geçmiş mesajları yükleyerek sohbeti yeniden başlatır.\n' +
        '`yazıgpt close`: Sohbet kanalını kapatır ve geçmişi temizler.',
      inline: false,
    },
    {
      name: 'Özellikler ve Modlar',
      value:
        '• Kanal altındaki butonlar ile normal mod, DeepSeek (Düşünme), Web Arama veya Coder modları arasında hızlı geçiş yapabilirsiniz.\n' +
        '• Sohbet geçmişi otomatik korunur ve model yanıtlarının altına devam etmeniz için interaktif öneri butonları eklenir.',
      inline: false,
    },
  ],
};

function sanitizeChannelName(name) {
  if (!name) return 'yazigpt';
  let n = name.toLowerCase();
  n = n.replace(/\s+/g, '-');
  n = n.replace(/[./#]/g, '');
  n = n.replace(/[^a-z0-9-_]/g, '');
  if (n.length > 90) n = n.slice(0, 90);
  if (!n) n = 'yazigpt';
  return n;
}

function animeError(msg) {
  return `${emojis.bot.error} Hata oluştu — ogen! ✨\n**Detay:** ${msg}\n> Senin adına üzgünüm ama benim güçlerim sınırlı! よろしくね〜`;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

const CHUNK_MAX = 1800;
const ATTACH_EXT_WHITELIST = [
  '.js',
  '.txt',
  '.py',
  '.json',
  '.md',
  '.html',
  '.css',
  '.xml',
  '.csv',
  '.log',
  '.ini',
  '.conf',
  '.yaml',
  '.yml',
  '.toml',
  '.env',
  '.sql',
  '.sh',
  '.bat',
  '.cmd',
  '.ps1',
  '.gitignore',
  '.license',
  '.readme',
  '.dockerfile',
  '.config',
  '.ts',
  '.jsx',
  '.tsx',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.php',
  '.rb',
  '.rs',
  '.swift',
  '.kt',
  '.dart',
  '.vue',
  '.scss',
  '.sass',
  '.less',
  '.stylus',
  '.coffee',
  '.litcoffee',
  '.fs',
  '.fsx',
  '.ml',
  '.mli',
  '.ex',
  '.exs',
  '.erl',
  '.hrl',
  '.zig',
  '.v',
  '.nim',
  '.cr',
  '.d',
  '.vala',
  '.vapi',
  '.glsl',
  '.wgsl',
  '.proto',
  '.thrift',
  '.avsc',
  '.graphql',
  '.gql',
];
async function fetchAttachmentText(url) {
  try {
    const res = await axios.get(url, { responseType: 'text', timeout: 15000 });
    return res.data ? String(res.data) : '';
  } catch (e) {
    console.warn('attachment fetch hatası:', e.message);
    return '';
  }
}

async function gatherAttachedFilesContentFromMessage(
  msg,
  userMessageContent = '',
) {
  if (!msg || !msg.attachments || msg.attachments.size === 0) return '';
  const parts = [];
  for (const att of msg.attachments.values()) {
    const name = (att.name || '').toLowerCase();
    const should = ATTACH_EXT_WHITELIST.some((ext) => name.endsWith(ext));
    if (!should) continue;
    const text = await fetchAttachmentText(att.url);
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    parts.push(
      `${ext} dosyasının içeriğindeki yazıyı kopyala\n${text}\n(${userMessageContent})`,
    );
  }
  return parts.length ? parts.join('\n\n') : '';
}

function splitTextIntoChunks(text, maxLen = CHUNK_MAX) {
  if (!text) return [' '];
  text = String(text);
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let slice = remaining.slice(0, maxLen);
    let lastNL = slice.lastIndexOf('\n');
    if (lastNL > Math.floor(maxLen * 0.5)) {
      chunks.push(slice.slice(0, lastNL));
      remaining = remaining.slice(lastNL + 1);
      continue;
    }

    let lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > Math.floor(maxLen * 0.5)) {
      chunks.push(slice.slice(0, lastSpace));
      remaining = remaining.slice(lastSpace + 1);
      continue;
    }

    chunks.push(slice);
    remaining = remaining.slice(maxLen);
  }

  return chunks;
}

async function sendChunkedEmbedResponses(
  channel,
  baseEmbed,
  fullText,
  components = null,
  hist = null,
) {
  try {
    const chunks = splitTextIntoChunks(fullText, CHUNK_MAX);
    let lastSent = null;

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const embed = new MessageEmbed(baseEmbed).setDescription(
        chunks[i] || ' ',
      );

      const payload = { embeds: [embed] };
      if (isLast && components) {
        payload.components = Array.isArray(components)
          ? components
          : [components];
      }

      const sent = await channel.send(payload);
      lastSent = sent;
      await sleep(120);
    }

    if (lastSent && hist) hist.lastEmbedMessageId = lastSent.id;
    return lastSent;
  } catch (e) {
    console.error('sendChunkedEmbedResponses hata:', e);
    return null;
  }
}

async function fetchLastUserMessage(channel) {
  try {
    const fetched = await channel.messages.fetch({ limit: 50 });
    const nonBot = Array.from(fetched.values()).filter((m) => !m.author.bot);
    if (!nonBot.length) return null;
    nonBot.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    return nonBot[0];
  } catch (e) {
    console.warn('fetchLastUserMessage hata:', e.message);
    return null;
  }
}
