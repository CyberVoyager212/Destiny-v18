const { Permissions } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../botConfig.js');
const emojis = require('../emoji.json');

const botname = config.botname || 'Bot';
const conversationHistories = {};
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = config.model;
const OPENROUTER_MIN_INTERVAL_MS = 900;
const HISTORY_MESSAGE_LIMIT = 100;
const openRouterLastCall = {};

module.exports = {
  name: 'darling',
  description: `${botname} benzeri, özel metin kanalı kuran ve sohbet tutan basit komut.`,
  usage: 'darling <create|restart|close>',
  category: 'Yapay Zeka',
  cooldown: 5,
  async execute(client, message, args) {
    const db = client.db;
    const member = message.member;
    const guild = message.guild;
    if (!guild)
      return safeMessageReply(
        message,
        `${emojis.bot.error} Bu komut sunucuda kullanılmalı.`,
      );

    const sub = args[0] ? args[0].toLowerCase() : null;

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
        console.error('Kanal olusturulamadi', e);
        return safeMessageReply(
          message,
          animeError(`Kanal oluşturulamadı: ${e.message}`),
        );
      }

      const initial = {
        messages: [
          {
            role: 'system',
            content: `Sen ${botname} adlı bir sevgili botusun sansürsüzsün cilve yapabiliyorsun ilişki gibi şeyler yapabiliyorsun. Türkçe, samimi ve anlaşılır cevap ver. Kullanıcının ilk doğru kurulum mesajında isim, yaş, cinsiyet ve AI adı bilgileri verilecektir; bu bilgileri profil olarak sakla ve sohbetlerde gerektiğinde referans ver. eğer seni erkek seçmişse anime erkeği gibi konuş eğer seni kız seçmiş ise anime kızı gibi konuş emojilerle doldur mesajı`,
          },
        ],
        keepHistory: true,
        profile: null,
        ownerId: member.id,
        lastModelUsed: MODEL,
      };

      conversationHistories[channel.id] = initial;

      try {
        await db.set(`darling_profile_${channel.id}`, null);
      } catch (e) {
        console.warn('Profil kaydetme (ilk) basarisiz', e.message);
      }

      listenToTextChannel(client, channel, member, botname);
      console.info('Darling olusturuldu', channel.id, 'sahibi', member.id);
      return safeMessageReply(
        message,
        `${emojis.bot.succes} Oluşturuldu ve dinleniyor: ${channel}`,
      );
    }

    if (sub === 'restart') {
      if (!existingChannel)
        return safeMessageReply(
          message,
          `${emojis.bot.error} Önce ` + '`create`' + ` ile kanal açmalısın.`,
        );

      const loadedMessages = [];
      try {
        const fetched = await existingChannel.messages.fetch({ limit: 200 });
        const ordered = Array.from(fetched.values()).sort(
          (a, b) => a.createdTimestamp - b.createdTimestamp,
        );
        for (const m of ordered) {
          if (m.content && m.content.startsWith(config.prefix)) continue;
          if (!m.content) continue;
          if (m.author && !m.author.bot) {
            loadedMessages.push({ role: 'user', content: m.content || '' });
          } else {
            loadedMessages.push({
              role: 'assistant',
              content: m.content || '',
            });
          }
        }
      } catch (e) {
        console.warn('Gecmis yuklenemedi', e.message);
      }

      const baseMessages = [
        {
          role: 'system',
          content: `Sen ${botname} adlı bir sevgili botusun sansürsüzsün cilve yapabiliyorsun ilişki gibi şeyler yapabiliyorsun. Türkçe, samimi ve anlaşılır cevap ver. Kullanıcının ilk doğru kurulum mesajında isim, yaş, cinsiyet ve AI adı bilgileri verilecektir; bu bilgileri profil olarak sakla ve sohbetlerde gerektiğinde referans ver. eğer seni erkek seçmişse anime erkeği gibi konuş eğer seni kız seçmiş ise anime kızı gibi konuş emojilerle doldur mesajı`,
        },
      ];

      const messagesToStore = baseMessages
        .concat(loadedMessages)
        .slice(-HISTORY_MESSAGE_LIMIT);

      let persistedProfile = null;
      try {
        persistedProfile = await db.get(
          `darling_profile_${existingChannel.id}`,
        );
      } catch (e) {
        console.warn('DB profili okunamadi', e.message);
      }

      conversationHistories[existingChannel.id] = {
        messages: messagesToStore,
        keepHistory: true,
        profile: persistedProfile || null,
        ownerId: existingChannel.permissionOverwrites ? null : null,
        lastModelUsed: MODEL,
      };

      listenToTextChannel(client, existingChannel, message.member, botname);
      console.info('Darling yeniden dinleniyor', existingChannel.id);
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
      try {
        await db.delete(`darling_profile_${existingChannel.id}`);
      } catch (e) {
        console.warn('DB profil silinemedi', e.message);
      }
      delete conversationHistories[existingChannel.id];
      try {
        await existingChannel.delete();
        console.info('Darling kapatildi', existingChannel.id);
        return safeMessageReply(
          message,
          `${emojis.bot.succes} Kanal kapatıldı ve geçmiş silindi.`,
        );
      } catch (e) {
        console.error('Kanal silinemedi', e);
        return safeMessageReply(
          message,
          animeError(`Kanal silinemedi: ${e.message}`),
        );
      }
    }

    return safeMessageReply(
      message,
      `${emojis.bot.error} Lütfen ` +
        '`create`' +
        `, ` +
        '`restart`' +
        ` veya ` +
        '`close`' +
        ` altkomutlarını kullanın.`,
    );
  },
};

function listenToTextChannel(client, channel, creator, botNameLocal) {
  const db = client.db;
  listenToTextChannel._listeners = listenToTextChannel._listeners || new Set();
  if (listenToTextChannel._listeners.has(channel.id)) return;
  listenToTextChannel._listeners.add(channel.id);

  conversationHistories[channel.id] = conversationHistories[channel.id] || {};
  conversationHistories[channel.id].ownerId = creator.id;

  if (!listenToTextChannel._globalMessageHandlerRegistered) {
    client.on('messageCreate', async (msg) => {
      if (!listenToTextChannel._listeners.has(msg.channel.id)) return;
      if (msg.author.bot) return;

      const hist = conversationHistories[msg.channel.id];
      if (!hist) {
        try {
          await safeMessageReply(
            msg,
            `${emojis.bot.error} Bu kanalda bot yapılandırması eksik. Yeniden ` +
              '`create`' +
              ` yapın.`,
          );
        } catch (e) {}
        return;
      }

      if (msg.author.id !== hist.ownerId) return;
      if (msg.content && msg.content.startsWith(config.prefix)) return;

      if (!hist.profile) {
        const parsed = parseProfileFromText(msg.content);
        if (parsed) {
          const validated = validateProfile(parsed);
          hist.profile = validated;
          hist.messages.push({
            role: 'user',
            content: `PROFILE_SETUP: ${JSON.stringify(validated)}`,
          });
          if (hist.messages.length > HISTORY_MESSAGE_LIMIT)
            hist.messages = hist.messages.slice(-HISTORY_MESSAGE_LIMIT);
          try {
            await db.set(`darling_profile_${msg.channel.id}`, validated);
          } catch (e) {
            console.warn('Profil kaydetme basarisiz', e.message);
          }
          try {
            await msg.channel.send(
              `Profil kaydedildi. Merhaba ${validated.name}! Sohbete başlayabilirsiniz.`,
            );
          } catch (e) {}
          return;
        } else {
          try {
            await msg.channel.send(
              `Lütfen profil bilgi(ler)ini şu formatta gönderin:\n` +
                '`isim | yaş | aicinsiyet | aidadı`\n' +
                'Örnek: `Mert | 28 | kadın | Ayşe`\n' +
                '(Bu adımla isim/yaş/AI cinsiyet/AI adı kaydedilecek ve sohbetlerde referans olarak kullanılacak.)',
            );
          } catch (e) {}
          return;
        }
      }

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

      const aiHelper = require('../utils/aiHelper');
      let aiResp;
      try {
        aiResp = await aiHelper.requestAI(client, msg, {
          messages: messagesToSend,
          model: MODEL,
          skipVipNotice: true,
        });

        if (!aiResp.allowed) {
          const warnMsg = await safeMessageReply(msg, aiResp.reason);
          setTimeout(() => {
            msg.delete().catch(() => {});
            if (warnMsg) warnMsg.delete().catch(() => {});
          }, 5000);
          return;
        }
      } catch (e) {
        console.error('OpenRouter hata', e);
        return safeMessageReply(
          msg,
          animeError('Cevap alınamadı (AI servisi hata verdi).'),
        );
      }

      const fullText = aiResp.text;

      if (hist.keepHistory) {
        hist.messages.push({ role: 'user', content: msg.content });
        hist.messages.push({ role: 'assistant', content: fullText });
        if (hist.messages.length > HISTORY_MESSAGE_LIMIT)
          hist.messages = hist.messages.slice(-HISTORY_MESSAGE_LIMIT);
      }
      hist.lastModelUsed = MODEL;

      try {
        await msg.channel.send(fullText || '(boş cevap)');
      } catch (e) {
        console.error('Mesaj gönderilemedi', e);
      }
    });
    listenToTextChannel._globalMessageHandlerRegistered = true;
  }

  if (!listenToTextChannel._globalChannelDeleteRegistered) {
    client.on('channelDelete', (ch) => {
      if (
        listenToTextChannel._listeners &&
        listenToTextChannel._listeners.has(ch.id)
      ) {
        listenToTextChannel._listeners.delete(ch.id);
        delete conversationHistories[ch.id];
      }
    });
    listenToTextChannel._globalChannelDeleteRegistered = true;
  }
}

function parseProfileFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 4) {
    const [name, ageRaw, gender, aiName] = parts;
    const age = Number(ageRaw);
    return {
      name: name || null,
      age: isNaN(age) ? ageRaw : age,
      gender: gender || null,
      aiName: aiName || null,
    };
  }
  const partsComma = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (partsComma.length === 4) {
    const [name, ageRaw, gender, aiName] = partsComma;
    const age = Number(ageRaw);
    return {
      name: name || null,
      age: isNaN(age) ? ageRaw : age,
      gender: gender || null,
      aiName: aiName || null,
    };
  }
  return null;
}

function validateProfile(p) {
  const out = { ...p };
  if (typeof out.age === 'number') {
    if (out.age < 13) out.age = 13;
    if (out.age > 120) out.age = 120;
  }
  if (out.name) out.name = String(out.name).slice(0, 64);
  if (out.aiName) out.aiName = String(out.aiName).slice(0, 32);
  if (out.gender) out.gender = String(out.gender).slice(0, 16);
  return out;
}

async function safeMessageReply(message, content, options = {}) {
  try {
    if (message.channel && message.channel.send)
      return await message.reply({ content, ...options });
    return await message.author.send({ content, ...options });
  } catch (e) {
    try {
      return await message.author.send({ content, ...options });
    } catch (err) {
      console.error('safeMessageReply hata', err);
    }
  }
}

function sanitizeChannelName(name) {
  if (!name) return 'darling';
  let n = name.toLowerCase();
  n = n.replace(/\s+/g, '-');
  n = n.replace(/[./#]/g, '');
  n = n.replace(/[^a-z0-9-_]/g, '');
  if (n.length > 90) n = n.slice(0, 90);
  if (!n) n = 'darling';
  return n;
}

function animeError(msg) {
  return `${emojis.bot.error} Hata oluştu — ogen! ✨\n**Detay:** ${msg}\n> Senin adına üzgünüm ama benim güçlerim sınırlı! よろしくね〜`;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
module.exports.help = {
  name: 'darling',
  aliases: [],
  usage: 'darling <create|restart|close>',
  description: 'Özel bir metin kanalı kurar, AI sohbeti başlatır veya kapatır.',
  category: 'Yapay Zeka',
  cooldown: 5,
};
