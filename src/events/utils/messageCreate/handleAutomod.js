const emojis = require('../../../emoji.json');
const {
  isUrl,
  isInvite,
  countEmojis,
  capsPercent,
  sendTemporaryNotice,
} = require('./helpers');

const DEFAULT_AUTOMOD = {
  enabled: true,
  muteRoleId: null,
  features: {
    profanity: { enabled: true, words: ['s*ç', 'oç', 'amk'], action: 'delete' },
    antispam: {
      enabled: true,
      messages: 5,
      interval: 7,
      action: 'mute',
      muteMinutes: 10,
    },
    antiinvite: { enabled: true, action: 'delete' },
    antilink: { enabled: false, action: 'delete' },
    massmention: { enabled: true, threshold: 5, action: 'delete' },
    anticaps: {
      enabled: true,
      thresholdPercent: 70,
      minLength: 8,
      action: 'delete',
    },
    repeated: { enabled: true, repeats: 3, action: 'delete' },
    antiattachment: { enabled: false, action: 'delete' },
    emojiSpam: { enabled: false, threshold: 10, action: 'delete' },
    minAccountAge: { enabled: false, days: 3, action: 'kick' },
  },
  ignoreRoles: [],
  ignoreChannels: [],
};

const recentMessages = new Map();
const lastMessage = new Map();

async function applyAction(action, message, reason, featureCfg, globalCfg) {
  try {
    const noticeBaseKey = `automod:${message.guild.id}:${message.channel.id}:${message.author.id}:${action}:${reason}`;

    if (action === 'delete') {
      if (message.deletable) await message.delete().catch(() => {});
      try {
        await sendTemporaryNotice(
          message.channel,
          `${emojis.bot.succes} | Mesaj başarıyla kaldırıldı. (${reason})`,
          { lockKey: noticeBaseKey },
        );
      } catch {}
    } else if (action === 'warn') {
      try {
        await message.author
          .send(
            `${emojis.bot.error} | Uyarı: ${reason} — Lütfen kurallara dikkat et, sempai~`,
          )
          .catch(() => {});
      } catch {}
    } else if (action === 'mute') {
      let muteRole = message.guild.roles.cache.find((r) => r.name === 'mute');
      if (!muteRole) {
        try {
          muteRole = await message.guild.roles.create({
            name: 'mute',
            permissions: [],
            reason: 'Otomatik mute rolü oluşturma (Otomod)',
          });

          message.guild.channels.cache.forEach((c) => {
            if (
              c.name !== 'muted-only' &&
              (c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE')
            ) {
              c.permissionOverwrites
                .edit(muteRole, {
                  VIEW_CHANNEL: false,
                  SEND_MESSAGES: false,
                  ADD_REACTIONS: false,
                  SPEAK: false,
                  CONNECT: false,
                })
                .catch(() => {});
            }
          });

          await message.channel
            .send(
              `${emojis.bot.succes} | Mute rolü oluşturuldu ve tüm kanallara izinleri ayarlandı~ ✨`,
            )
            .catch(() => {});
        } catch (err) {
          console.error('Otomod mute rolü oluşturma hatası:', err);
        }
      }

      let muteChannel = message.guild.channels.cache.find(
        (c) => c.name === 'muted-only',
      );
      if (!muteChannel && muteRole) {
        try {
          muteChannel = await message.guild.channels.create('muted-only', {
            type: 'GUILD_TEXT',
            permissionOverwrites: [
              {
                id: message.guild.roles.everyone.id,
                deny: ['VIEW_CHANNEL'],
              },
              {
                id: muteRole.id,
                allow: [
                  'VIEW_CHANNEL',
                  'SEND_MESSAGES',
                  'READ_MESSAGE_HISTORY',
                ],
              },
            ],
            reason: 'Mute kullanıcılar için özel kanal',
          });
          await message.channel
            .send(
              `${emojis.bot.succes} | **muted-only** kanalı oluşturuldu ve izinleri ayarlandı~ ✨`,
            )
            .catch(() => {});
        } catch (err) {
          console.error('Kanal oluşturma hatası:', err);
        }
      }

      const member = message.member;
      if (member && muteRole) {
        const db = message.client.db;
        const muteMinutes =
          (featureCfg && featureCfg.muteMinutes) ||
          (globalCfg &&
            globalCfg.features &&
            globalCfg.features.antispam &&
            globalCfg.features.antispam.muteMinutes) ||
          10;
        const endTimestamp = Date.now() + muteMinutes * 60000;

        if (!member.roles.cache.has(muteRole.id)) {
          const currentRoles = member.roles.cache
            .filter((r) => r.id !== message.guild.id && r.id !== muteRole.id)
            .map((r) => r.id);

          await db.set(
            `mute_roles_${message.guild.id}_${member.id}`,
            currentRoles,
          );
          await db.set(
            `mute_end_${message.guild.id}_${member.id}`,
            endTimestamp,
          );
          await member.roles.set([muteRole.id]).catch(() => {});

          setTimeout(
            async () => {
              try {
                const checkEnd = await db.get(
                  `mute_end_${message.guild.id}_${member.id}`,
                );
                if (checkEnd && Date.now() >= checkEnd) {
                  const oldRoles =
                    (await db.get(
                      `mute_roles_${message.guild.id}_${member.id}`,
                    )) || [];
                  await member.roles.set(oldRoles).catch(() => {});
                  await db.delete(
                    `mute_roles_${message.guild.id}_${member.id}`,
                  );
                  await db.delete(`mute_end_${message.guild.id}_${member.id}`);
                }
              } catch {}
            },
            muteMinutes * 60 * 1000 + 5000,
          );
        }
      }

      if (message.deletable) await message.delete().catch(() => {});
      try {
        await sendTemporaryNotice(
          message.channel,
          `${emojis.bot.succes} | Kullanıcı geçici olarak susturuldu (${reason}).`,
          { lockKey: noticeBaseKey, deleteAfterMs: 7000 },
        );
      } catch {}
    } else if (action === 'kick') {
      if (message.deletable) await message.delete().catch(() => {});
      if (message.member && message.member.kickable)
        await message.member.kick(reason).catch(() => {});
      try {
        await sendTemporaryNotice(
          message.channel,
          `${emojis.bot.succes} | Kullanıcı sunucudan atıldı (${reason}).`,
          { lockKey: noticeBaseKey, deleteAfterMs: 7000 },
        );
      } catch {}
    } else if (action === 'ban') {
      if (message.deletable) await message.delete().catch(() => {});
      if (message.member && message.member.bannable)
        await message.member.ban({ reason }).catch(() => {});
      try {
        await sendTemporaryNotice(
          message.channel,
          `${emojis.bot.succes} | Kullanıcı banlandı (${reason}).`,
          { lockKey: noticeBaseKey, deleteAfterMs: 7000 },
        );
      } catch {}
    }
  } catch (err) {
    console.error('applyAction error:', err);
    try {
      await sendTemporaryNotice(
        message.channel,
        `${emojis.bot.error} | Oopsie~ Bir şey ters gitti while applying action: ${err.message}`,
        {
          lockKey: `automod:error:${message.guild.id}:${message.channel.id}:${action}`,
          deleteAfterMs: 7000,
        },
      );
    } catch {}
  }
}

module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const channelId = message.channel.id;
  const content = (message.content || '').trim();
  const ownerId = client.config && client.config.ownerId;
  const admins = (client.config && client.config.admins) || [];

  try {
    if (!admins.includes(userId) && userId !== ownerId) {
      let cfg = await db.get(`otomod_${guildId}`);
      if (!cfg) {
        cfg = DEFAULT_AUTOMOD;
        await db.set(`otomod_${guildId}`, cfg);
      }

      if (cfg && cfg.enabled) {
        if (cfg.ignoreChannels && cfg.ignoreChannels.includes(channelId)) {
        } else if (
          message.member &&
          cfg.ignoreRoles &&
          message.member.roles.cache.some((r) => cfg.ignoreRoles.includes(r.id))
        ) {
        } else {
          const txt = content || '';

          const pConf = cfg.features.profanity || {};
          if (pConf.enabled && pConf.words && txt) {
            const found = pConf.words.find((w) => {
              if (!w) return false;
              try {
                return txt.toLowerCase().includes(w.toLowerCase());
              } catch {
                return false;
              }
            });
            if (found) {
              await applyAction(
                pConf.action,
                message,
                `Küfür tespit: ${found}`,
                pConf,
                cfg,
              );
              return true;
            }
          }

          const invConf = cfg.features.antiinvite || {};
          if (invConf.enabled && txt && isInvite(txt)) {
            await applyAction(
              invConf.action,
              message,
              'Invite link tespit edildi',
              invConf,
              cfg,
            );
            return true;
          }

          const linkConf = cfg.features.antilink || {};
          if (linkConf.enabled && txt && isUrl(txt)) {
            await applyAction(
              linkConf.action,
              message,
              'Link tespit edildi',
              linkConf,
              cfg,
            );
            return true;
          }

          const attConf = cfg.features.antiattachment || {};
          if (
            attConf.enabled &&
            message.attachments &&
            message.attachments.size > 0
          ) {
            await applyAction(
              attConf.action,
              message,
              'Attachment/ek tespit edildi',
              attConf,
              cfg,
            );
            return true;
          }

          const mmConf = cfg.features.massmention || {};
          if (mmConf.enabled) {
            const mentionCount =
              message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount >= (mmConf.threshold || 5)) {
              await applyAction(
                mmConf.action,
                message,
                `Çoklu mention: ${mentionCount}`,
                mmConf,
                cfg,
              );
              return true;
            }
          }

          const ac = cfg.features.anticaps || {};
          if (ac.enabled && txt && txt.length >= (ac.minLength || 8)) {
            const pct = capsPercent(txt);
            if (pct >= (ac.thresholdPercent || 70)) {
              await applyAction(
                ac.action,
                message,
                `Büyük harf spamı (%${pct})`,
                ac,
                cfg,
              );
              return true;
            }
          }

          const es = cfg.features.emojiSpam || {};
          if (es.enabled && txt) {
            const ecount = countEmojis(txt);
            if (ecount >= (es.threshold || 10)) {
              await applyAction(
                es.action,
                message,
                `Emoji spam: ${ecount}`,
                es,
                cfg,
              );
              return true;
            }
          }

          const rep = cfg.features.repeated || {};
          if (rep.enabled && txt) {
            const key = `${guildId}-${userId}`;
            const last = lastMessage.get(key);
            if (last && last.content === txt) {
              last.count = (last.count || 1) + 1;
              last.ids = last.ids || [];
              last.ids.push(message.id);
            } else {
              lastMessage.set(key, {
                content: txt,
                count: 1,
                ts: Date.now(),
                ids: [message.id],
              });
            }
            const nowLast = lastMessage.get(key);
            if (nowLast.count >= (rep.repeats || 3)) {
              const need = rep.repeats || 3;
              const fetched = await message.channel.messages.fetch({
                limit: 100,
              });
              const matched = fetched.filter(
                (m) =>
                  m.author.id === userId &&
                  (m.content || '').trim() === txt.trim(),
              );
              const matchedArray = Array.from(matched.values())
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
                .slice(0, need);

              if (matchedArray.length) {
                const fourteenDays = 14 * 24 * 60 * 60 * 1000;
                const bulk = matchedArray.filter(
                  (m) => Date.now() - m.createdTimestamp < fourteenDays,
                );
                const old = matchedArray.filter(
                  (m) => Date.now() - m.createdTimestamp >= fourteenDays,
                );

                if (bulk.length > 1) {
                  try {
                    await message.channel.bulkDelete(
                      bulk.map((m) => m.id),
                      true,
                    );
                  } catch (err) {
                    for (const m of bulk) {
                      try {
                        const fetchedMsg = await message.channel.messages
                          .fetch(m.id)
                          .catch(() => null);
                        if (fetchedMsg)
                          await fetchedMsg.delete().catch(() => {});
                      } catch {}
                    }
                  }
                } else {
                  for (const m of bulk) {
                    try {
                      const fetchedMsg = await message.channel.messages
                        .fetch(m.id)
                        .catch(() => null);
                      if (fetchedMsg) await fetchedMsg.delete().catch(() => {});
                    } catch {}
                  }
                }

                for (const m of old) {
                  try {
                    const fetchedMsg = await message.channel.messages
                      .fetch(m.id)
                      .catch(() => null);
                    if (fetchedMsg) await fetchedMsg.delete().catch(() => {});
                  } catch {}
                }
              }

              await applyAction(
                rep.action || 'delete',
                message,
                `Tekrar eden mesaj: ${matchedArray.length} kez`,
                rep,
                cfg,
              );

              lastMessage.set(key, { content: null, count: 0, ids: [] });
              return true;
            }
          }

          const spam = cfg.features.antispam || {};
          if (spam.enabled) {
            const key = `${guildId}-${userId}`;
            const arr = recentMessages.get(key) || [];
            arr.push({ ts: Date.now(), id: message.id });
            const intervalMs = (spam.interval || 7) * 1000;
            const windowStart = Date.now() - intervalMs;
            const cleaned = arr.filter((t) => t.ts > windowStart);
            recentMessages.set(key, cleaned);
            if (cleaned.length >= (spam.messages || 5)) {
              const fetched = await message.channel.messages.fetch({
                limit: 100,
              });
              const toDeleteCollection = fetched.filter(
                (m) =>
                  m.author.id === userId && m.createdTimestamp > windowStart,
              );
              const toDelete = Array.from(toDeleteCollection.values());
              if (toDelete.length) {
                const fourteenDays = 14 * 24 * 60 * 60 * 1000;
                const bulk = toDelete.filter(
                  (m) => Date.now() - m.createdTimestamp < fourteenDays,
                );
                const old = toDelete.filter(
                  (m) => Date.now() - m.createdTimestamp >= fourteenDays,
                );

                if (bulk.length) {
                  try {
                    await message.channel.bulkDelete(
                      bulk.map((m) => m.id),
                      true,
                    );
                  } catch (err) {
                    for (const m of bulk) {
                      try {
                        const fetchedMsg = await message.channel.messages
                          .fetch(m.id)
                          .catch(() => null);
                        if (fetchedMsg)
                          await fetchedMsg.delete().catch(() => {});
                      } catch {}
                    }
                  }
                }

                for (const m of old) {
                  try {
                    const fetchedMsg = await message.channel.messages
                      .fetch(m.id)
                      .catch(() => null);
                    if (fetchedMsg) await fetchedMsg.delete().catch(() => {});
                  } catch {}
                }
              }

              await applyAction(
                spam.action || 'mute',
                message,
                `Spam tespit: ${cleaned.length} mesaj/${spam.interval || 7}s`,
                spam,
                cfg,
              );

              recentMessages.set(key, []);
              return true;
            }
          }

          const mAge = cfg.features.minAccountAge || {};
          if (mAge.enabled) {
            const createdAt = message.author.createdTimestamp;
            const days = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
            if (days < (mAge.days || 3)) {
              await applyAction(
                mAge.action,
                message,
                `Hesap yaşı ${Math.floor(days)} gün < required`,
                mAge,
                cfg,
              );
              return true;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('otomod hata:', err);
    try {
      await message.channel
        .send(
          `${
            emojis.bot.error
          } | ✨ Hata yakalandı — otomod çalışırken beklenmedik bir hata oluştu.\nDetay: ${
            err.message || 'Bilinmeyen hata'
          }\nLütfen logları kontrol et veya geliştiriciye bildir, sempai~`,
        )
        .catch(() => {});
    } catch {}
  }

  return false;
};
