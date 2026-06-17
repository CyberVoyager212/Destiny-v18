const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'yapiskanmesaj',
  aliases: ['sticky', 'sabit', 'yapışkanmesaj', 'yapiskan'],
  usage: 'yapiskanmesaj <ekle|sil|list> [inline args]',
  description: 'Belirtilen kanala yapışkan mesaj ekler, siler veya listeler.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['ADMINISTRATOR'],
};

exports.execute = async (client, message, args) => {
  const sub = args[0]?.toLowerCase();
  const db = client.db;
  const guild = message.guild;
  const channel = message.channel;
  const filter = (m) => m.author.id === message.author.id;

  const safeDelete = (m, delay = 5000) => {
    if (!m) return;
    setTimeout(() => {
      try {
        m.delete().catch(() => {});
      } catch {}
    }, delay);
  };

  const ensureAssetsChannel = async (targetChannelId, authorId) => {
    const preferredName = `sticky-assets-${targetChannelId}-${Date.now()}`;
    let assets = guild.channels.cache.find(
      (c) => c.name === preferredName && c.type === 'GUILD_TEXT',
    );
    if (!assets) {
      assets = guild.channels.cache.find(
        (c) => c.name === 'sticky-assets' && c.type === 'GUILD_TEXT',
      );
    }
    if (assets) return assets;

    try {
      const ch = await guild.channels.create(preferredName, {
        type: 'GUILD_TEXT',
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: ['VIEW_CHANNEL'] },
          {
            id: authorId,
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'],
          },
          {
            id: client.user.id,
            allow: [
              'VIEW_CHANNEL',
              'SEND_MESSAGES',
              'ATTACH_FILES',
              'MANAGE_WEBHOOKS',
            ],
          },
        ],
        reason: 'Sticky assets kanalı (yapışkan mesaj görselleri) oluşturuldu.',
      });
      return ch;
    } catch (err) {
      console.error('Assets kanalı oluşturulamadı:', err);
      try {
        const ch2 = await guild.channels.create('sticky-assets', {
          type: 'GUILD_TEXT',
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: ['VIEW_CHANNEL'] },
            {
              id: authorId,
              allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'],
            },
            {
              id: client.user.id,
              allow: [
                'VIEW_CHANNEL',
                'SEND_MESSAGES',
                'ATTACH_FILES',
                'MANAGE_WEBHOOKS',
              ],
            },
          ],
          reason:
            'Sticky assets kanalı (yapışkan mesaj görselleri) oluşturuldu.',
        });
        return ch2;
      } catch (err2) {
        console.error('Assets kanalı (fallback) oluşturulamadı:', err2);
        return null;
      }
    }
  };

  const saveAttachmentToAssets = async (assetsChannel, attachmentUrl) => {
    if (!assetsChannel) return null;
    const m = await assetsChannel.send({ files: [attachmentUrl] });
    const att = m.attachments.first();
    return att ? { url: att.url, messageId: m.id } : null;
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const tryDeleteDbKey = async (key, attempts = 3, delay = 400) => {
    for (let i = 0; i < attempts; i++) {
      try {
        if (db && typeof db.delete === 'function') {
          await db.delete(key);
        } else if (db && typeof db.del === 'function') {
          await db.del(key);
        } else if (db && typeof db.set === 'function') {
          await db.set(key, null);
        }
      } catch (e) {
        console.warn('DB delete attempt failed', e);
      }
      try {
        const check = await db.get(key).catch(() => null);
        if (!check) return true;
      } catch {}
      await wait(delay);
    }
    return false;
  };

  if (sub === 'ekle') {
    const inlineText = args.slice(1).join(' ');
    const inlineParts =
      inlineText && inlineText.includes(';')
        ? inlineText
            .split(';')
            .map((p) => p.trim())
            .filter(Boolean)
        : null;

    const cleanup = [];
    const pushCleanup = (m) => {
      if (m) cleanup.push(m);
    };

    try {
      if (inlineParts) {
        const channelPart = inlineParts[0];
        const chMatch =
          channelPart.match(/<#(\d+)>/) || channelPart.match(/(\d{17,19})/);
        if (!chMatch) throw new Error('Inline: geçersiz kanal belirtimi.');
        const targetChannelId = chMatch[1];
        const targetChannel = guild.channels.cache.get(targetChannelId);
        if (!targetChannel || targetChannel.type !== 'GUILD_TEXT')
          throw new Error('Inline: hedef yazı kanalı bulunamadı.');

        const typePart = (inlineParts[1] || 'düz').toLowerCase();
        const stored = {
          channelId: targetChannel.id,
          createdBy: message.author.id,
          createdAt: Date.now(),
        };

        let assetsChannel = null;
        const maybeCreateAssets = async (needs) => {
          if (!needs) return null;
          if (!assetsChannel)
            assetsChannel = await ensureAssetsChannel(
              targetChannel.id,
              message.author.id,
            );
          if (assetsChannel) stored.assetsChannelId = assetsChannel.id;
          return assetsChannel;
        };

        if (typePart === 'webhook') {
          let cursor = 2;
          const webhookNameCandidate = inlineParts[cursor] || '';
          let webhookName =
            webhookNameCandidate.toLowerCase() === 'geç' ||
            webhookNameCandidate.trim() === ''
              ? message.author.username
              : webhookNameCandidate;
          cursor++;

          const webhookModeCandidate = (
            inlineParts[cursor] || 'plain'
          ).toLowerCase();
          const webhookMode = ['embed', 'plain', 'düz'].includes(
            webhookModeCandidate,
          )
            ? webhookModeCandidate
            : 'plain';
          if (['embed', 'plain', 'düz'].includes(webhookModeCandidate))
            cursor++;

          if (webhookMode === 'embed') {
            const embedTitle =
              (inlineParts[cursor] || '').toLowerCase() === 'geç'
                ? null
                : inlineParts[cursor] || null;
            cursor++;
            const embedDesc = inlineParts[cursor] || '';
            cursor++;
            const profileUrlPart = inlineParts[cursor] || 'geç';
            cursor++;
            const imageUrlPart = inlineParts[cursor] || 'geç';
            cursor++;

            const needsAssets =
              (profileUrlPart && profileUrlPart !== 'geç') ||
              (imageUrlPart && imageUrlPart !== 'geç');
            await maybeCreateAssets(needsAssets);
            if (profileUrlPart && profileUrlPart !== 'geç' && assetsChannel) {
              const saved = await saveAttachmentToAssets(
                assetsChannel,
                profileUrlPart,
              );
              if (saved) {
                stored.profileUrl = saved.url;
                stored.profileAssetMessageId = saved.messageId;
              }
            }
            if (imageUrlPart && imageUrlPart !== 'geç' && assetsChannel) {
              const saved = await saveAttachmentToAssets(
                assetsChannel,
                imageUrlPart,
              );
              if (saved) {
                stored.webhookImageUrl = saved.url;
                stored.webhookImageAssetMessageId = saved.messageId;
              }
            }

            const embed = new MessageEmbed();
            if (embedTitle) embed.setTitle(embedTitle);
            embed.setDescription(embedDesc);
            if (stored.webhookImageUrl) embed.setImage(stored.webhookImageUrl);
            embed.setColor('#2f3136');

            const webhookOptions = {};
            if (stored.profileUrl) webhookOptions.avatar = stored.profileUrl;
            const createdWebhook = await targetChannel.createWebhook(
              webhookName,
              webhookOptions,
            );
            stored.webhook = {
              id: createdWebhook.id,
              token: createdWebhook.token || null,
              name: createdWebhook.name,
            };
            const sent = await createdWebhook.send({
              username: webhookName,
              avatarURL: stored.profileUrl || undefined,
              embeds: [embed],
            });

            stored.type = 'webhook-embed';
            stored.embed = {
              title: embedTitle,
              description: embedDesc,
              image: stored.webhookImageUrl || null,
            };
            stored.messageId = sent.id;
            stored.postedAt = Date.now();
          } else {
            const text = inlineParts[cursor] || '';
            cursor++;
            const profileUrlPart = inlineParts[cursor] || 'geç';
            cursor++;
            const imageUrlPart = inlineParts[cursor] || 'geç';
            cursor++;

            const needsAssets =
              (profileUrlPart && profileUrlPart !== 'geç') ||
              (imageUrlPart && imageUrlPart !== 'geç');
            await maybeCreateAssets(needsAssets);
            if (profileUrlPart && profileUrlPart !== 'geç' && assetsChannel) {
              const saved = await saveAttachmentToAssets(
                assetsChannel,
                profileUrlPart,
              );
              if (saved) {
                stored.profileUrl = saved.url;
                stored.profileAssetMessageId = saved.messageId;
              }
            }
            if (imageUrlPart && imageUrlPart !== 'geç' && assetsChannel) {
              const saved = await saveAttachmentToAssets(
                assetsChannel,
                imageUrlPart,
              );
              if (saved) {
                stored.webhookImageUrl = saved.url;
                stored.webhookImageAssetMessageId = saved.messageId;
              }
            }

            const webhookOptions = {};
            if (stored.profileUrl) webhookOptions.avatar = stored.profileUrl;
            const createdWebhook = await targetChannel.createWebhook(
              webhookName,
              webhookOptions,
            );
            stored.webhook = {
              id: createdWebhook.id,
              token: createdWebhook.token || null,
              name: createdWebhook.name,
            };
            const sendOptions = {
              username: webhookName,
              avatarURL: stored.profileUrl || undefined,
              content: text || undefined,
            };
            if (stored.webhookImageUrl)
              sendOptions.files = [stored.webhookImageUrl];
            const sent = await createdWebhook.send(sendOptions);

            stored.type = 'webhook-plain';
            stored.content = text;
            stored.messageId = sent.id;
            stored.postedAt = Date.now();
          }
        } else if (typePart === 'embed') {
          const title =
            (inlineParts[2] || '').toLowerCase() === 'geç'
              ? null
              : inlineParts[2] || null;
          const desc = inlineParts[3] || '';
          const imagePart = inlineParts[4] || 'geç';
          if (imagePart && imagePart !== 'geç') {
            const assets = await ensureAssetsChannel(
              targetChannel.id,
              message.author.id,
            );
            if (assets) {
              const saved = await saveAttachmentToAssets(assets, imagePart);
              if (saved) {
                stored.embedImageUrl = saved.url;
                stored.embedImageAssetMessageId = saved.messageId;
                stored.assetsChannelId = assets.id;
              }
            }
          }
          const embed = new MessageEmbed();
          if (title) embed.setTitle(title);
          embed.setDescription(desc);
          if (stored.embedImageUrl) embed.setImage(stored.embedImageUrl);
          embed.setColor('#2f3136');
          const sent = await targetChannel.send({ embeds: [embed] });
          stored.type = 'bot-embed';
          stored.embed = {
            title: title || null,
            description: desc,
            image: stored.embedImageUrl || null,
          };
          stored.messageId = sent.id;
          stored.postedAt = Date.now();
        } else {
          const text = inlineParts[2] || '';
          const imagePart = inlineParts[3] || 'geç';
          if (imagePart && imagePart !== 'geç') {
            const assets = await ensureAssetsChannel(
              targetChannel.id,
              message.author.id,
            );
            if (assets) {
              const saved = await saveAttachmentToAssets(assets, imagePart);
              if (saved) {
                stored.plainImageUrl = saved.url;
                stored.plainImageAssetMessageId = saved.messageId;
                stored.assetsChannelId = assets.id;
              }
            }
          }
          const sent = stored.plainImageUrl
            ? await targetChannel.send({
                content: text,
                files: [stored.plainImageUrl],
              })
            : await targetChannel.send({ content: text });
          stored.type = 'bot-plain';
          stored.content = text;
          stored.messageId = sent.id;
          stored.postedAt = Date.now();
        }

        await db.set(`stickyMessage_${targetChannel.id}`, stored);

        const ok = await channel.send(
          `${emojis.bot.succes} | **${message.member.displayName}**, yapışkan mesaj inline olarak eklendi.`,
        );
        pushCleanup(ok);
        safeDelete(ok, 5000);
        safeDelete(message, 5000);
        return;
      }

      const prompts = [];
      const replies = [];
      const ask = async (text, time = 60000) => {
        const q = await channel.send(text);
        prompts.push(q);
        const collected = await channel.awaitMessages({
          filter,
          max: 1,
          time,
          errors: ['time'],
        });
        const r = collected.first();
        replies.push(r);
        return r;
      };

      let targetReply = null;
      if (message.mentions.channels.first()) {
        targetReply = { content: `<#${message.mentions.channels.first().id}>` };
      } else {
        targetReply = await ask(
          `${emojis.bot.succes} | **${message.member.displayName}**, hangi kanala yapışkan mesaj gönderilecek? Kanalı etiketleyin (örn. #genel) veya kanal ID'si girin.`,
        );
      }
      pushCleanup(targetReply);

      const channelIdMatch =
        targetReply.content.match(/<#(\d+)>/) ||
        targetReply.content.match(/(\d{17,19})/);
      if (!channelIdMatch) throw new Error('Geçersiz kanal.');
      const targetChannelId = channelIdMatch[1];
      const targetChannel = guild.channels.cache.get(targetChannelId);
      if (!targetChannel || targetChannel.type !== 'GUILD_TEXT')
        throw new Error('Geçersiz veya yazı kanalı değil.');

      const typeReply = await ask(
        `${emojis.bot.succes} | **${message.member.displayName}**, gönderim tipi seçin: \`webhook\`, \`embed\` veya \`düz\` (sadece yazı). \`geç\` yazarsanız varsayılan \`düz\` seçilir.`,
      );
      pushCleanup(typeReply);
      const rawType = (typeReply.content || 'düz').trim().toLowerCase();
      const sendType = rawType === 'geç' || !rawType ? 'düz' : rawType;

      const stored = {
        channelId: targetChannel.id,
        createdBy: message.author.id,
        createdAt: Date.now(),
      };
      let assetsChannel = null;
      const maybeCreateAssetsChannel = async () => {
        if (assetsChannel) return assetsChannel;
        assetsChannel = await ensureAssetsChannel(
          targetChannel.id,
          message.author.id,
        );
        if (assetsChannel) stored.assetsChannelId = assetsChannel.id;
        return assetsChannel;
      };

      if (sendType === 'webhook') {
        const webhookNameReply = await ask(
          `${emojis.bot.succes} | Webhook adı ne olsun? (boş bırakırsanız veya 'geç' yazarsanız kullanıcı adınız kullanılacak)`,
        );
        pushCleanup(webhookNameReply);
        const webhookNameRaw = (webhookNameReply.content || '').trim();
        const webhookName =
          !webhookNameRaw || webhookNameRaw.toLowerCase() === 'geç'
            ? message.author.username
            : webhookNameRaw;

        const profileReply = await ask(
          `${emojis.bot.succes} | Webhook için profil fotoğrafı atın veya \`geç\` yazın.`,
        );
        pushCleanup(profileReply);
        const profileNormalized = (profileReply.content || '')
          .trim()
          .toLowerCase();
        if (
          profileNormalized !== 'geç' &&
          profileReply.attachments &&
          profileReply.attachments.size
        ) {
          await maybeCreateAssetsChannel();
          const att = profileReply.attachments.first();
          const saved = await saveAttachmentToAssets(assetsChannel, att.url);
          if (saved) {
            stored.profileUrl = saved.url;
            stored.profileAssetMessageId = saved.messageId;
          }
        }

        const imageReply = await ask(
          `${emojis.bot.succes} | Webhook için görsel atmak istiyorsanız atın, yoksa \`geç\` yazın.`,
        );
        pushCleanup(imageReply);
        const imageNormalized = (imageReply.content || '').trim().toLowerCase();
        if (
          imageNormalized !== 'geç' &&
          imageReply.attachments &&
          imageReply.attachments.size
        ) {
          await maybeCreateAssetsChannel();
          const att = imageReply.attachments.first();
          const saved = await saveAttachmentToAssets(assetsChannel, att.url);
          if (saved) {
            stored.webhookImageUrl = saved.url;
            stored.webhookImageAssetMessageId = saved.messageId;
          }
        }

        const webhookModeReply = await ask(
          `${emojis.bot.succes} | Webhook ile gönderim nasıl olsun? \`embed\` mi yoksa \`düz\` mesaj mı? (geç yazılabilir, varsayılan: düz)`,
        );
        pushCleanup(webhookModeReply);
        const webhookModeRaw = (webhookModeReply.content || 'düz')
          .trim()
          .toLowerCase();
        const webhookMode =
          webhookModeRaw === 'geç' || !webhookModeRaw ? 'düz' : webhookModeRaw;

        if (webhookMode === 'embed') {
          const titleReply = await ask(
            `${emojis.bot.succes} | Embed başlığı ne olsun? Başlık yoksa \`geç\` yazın.`,
          );
          pushCleanup(titleReply);
          const descReply = await ask(
            `${emojis.bot.succes} | Embed mesajını yazın.`,
          );
          pushCleanup(descReply);

          const embed = new MessageEmbed();
          const titleNorm = (titleReply.content || '').trim();
          if (titleNorm && titleNorm.toLowerCase() !== 'geç')
            embed.setTitle(titleNorm);
          const descNorm = (descReply.content || '').trim();
          embed.setDescription(descNorm || '');
          if (stored.webhookImageUrl) embed.setImage(stored.webhookImageUrl);
          embed.setColor('#2f3136');

          const webhookOptions = {};
          if (stored.profileUrl) webhookOptions.avatar = stored.profileUrl;
          const createdWebhook = await targetChannel.createWebhook(
            webhookName,
            webhookOptions,
          );
          stored.webhook = {
            id: createdWebhook.id,
            token: createdWebhook.token || null,
            name: createdWebhook.name,
          };
          const sent = await createdWebhook.send({
            username: webhookName,
            avatarURL: stored.profileUrl || undefined,
            embeds: [embed],
          });

          stored.type = 'webhook-embed';
          stored.embed = {
            title:
              titleNorm && titleNorm.toLowerCase() !== 'geç' ? titleNorm : null,
            description: descNorm || '',
            image: stored.webhookImageUrl || null,
          };
          stored.messageId = sent.id;
          stored.postedAt = Date.now();
        } else {
          const textReply = await ask(
            `${emojis.bot.succes} | Düz yazı mesajını yazın. (geç yazabilirsiniz)`,
          );
          pushCleanup(textReply);
          const textNorm = (textReply.content || '').trim();
          const webhookOptions = {};
          if (stored.profileUrl) webhookOptions.avatar = stored.profileUrl;
          const createdWebhook = await targetChannel.createWebhook(
            webhookName,
            webhookOptions,
          );
          stored.webhook = {
            id: createdWebhook.id,
            token: createdWebhook.token || null,
            name: createdWebhook.name,
          };

          const sendOptions = {
            username: webhookName,
            avatarURL: stored.profileUrl || undefined,
            content:
              textNorm && textNorm.toLowerCase() !== 'geç'
                ? textNorm
                : undefined,
          };
          if (stored.webhookImageUrl)
            sendOptions.files = [stored.webhookImageUrl];
          const sent = await createdWebhook.send(sendOptions);

          stored.type = 'webhook-plain';
          stored.content =
            textNorm && textNorm.toLowerCase() !== 'geç' ? textNorm : '';
          stored.messageId = sent.id;
          stored.postedAt = Date.now();
        }
      } else if (sendType === 'embed') {
        const titleReply = await ask(
          `${emojis.bot.succes} | Embed başlığı ne olsun? Başlık yoksa \`geç\` yazın.`,
        );
        pushCleanup(titleReply);
        const descReply = await ask(
          `${emojis.bot.succes} | Embed mesajını yazın.`,
        );
        pushCleanup(descReply);
        const imageReply = await ask(
          `${emojis.bot.succes} | Embed için görsel atmak istiyorsanız şimdi atın, yoksa \`geç\` yazın.`,
        );
        pushCleanup(imageReply);

        const imgNorm = (imageReply.content || '').trim().toLowerCase();
        if (
          imgNorm !== 'geç' &&
          imageReply.attachments &&
          imageReply.attachments.size
        ) {
          await maybeCreateAssetsChannel();
          const att = imageReply.attachments.first();
          const saved = await saveAttachmentToAssets(assetsChannel, att.url);
          if (saved) {
            stored.embedImageUrl = saved.url;
            stored.embedImageAssetMessageId = saved.messageId;
          }
        }

        const embed = new MessageEmbed();
        const titleNorm = (titleReply.content || '').trim();
        if (titleNorm && titleNorm.toLowerCase() !== 'geç')
          embed.setTitle(titleNorm);
        const descNorm = (descReply.content || '').trim();
        embed.setDescription(descNorm || '');
        if (stored.embedImageUrl) embed.setImage(stored.embedImageUrl);
        embed.setColor('#2f3136');
        const sent = await targetChannel.send({ embeds: [embed] });
        stored.type = 'bot-embed';
        stored.embed = {
          title:
            titleNorm && titleNorm.toLowerCase() !== 'geç' ? titleNorm : null,
          description: descNorm || '',
          image: stored.embedImageUrl || null,
        };
        stored.messageId = sent.id;
        stored.postedAt = Date.now();
      } else {
        const textReply = await ask(
          `${emojis.bot.succes} | Düz yazı mesajını yazın. (geç yazabilirsiniz)`,
        );
        pushCleanup(textReply);
        const imageReply = await ask(
          `${emojis.bot.succes} | Bu düz mesaj için görsel atmak istiyorsanız şimdi atın, yoksa \`geç\` yazın.`,
        );
        pushCleanup(imageReply);

        const imgNorm = (imageReply.content || '').trim().toLowerCase();
        if (
          imgNorm !== 'geç' &&
          imageReply.attachments &&
          imageReply.attachments.size
        ) {
          await maybeCreateAssetsChannel();
          const att = imageReply.attachments.first();
          const saved = await saveAttachmentToAssets(assetsChannel, att.url);
          if (saved) {
            stored.plainImageUrl = saved.url;
            stored.plainImageAssetMessageId = saved.messageId;
          }
        }

        const textNorm = (textReply.content || '').trim();
        const sent = stored.plainImageUrl
          ? await targetChannel.send({
              content:
                textNorm && textNorm.toLowerCase() !== 'geç' ? textNorm : '',
              files: [stored.plainImageUrl],
            })
          : await targetChannel.send({
              content:
                textNorm && textNorm.toLowerCase() !== 'geç' ? textNorm : '',
            });
        stored.type = 'bot-plain';
        stored.content =
          textNorm && textNorm.toLowerCase() !== 'geç' ? textNorm : '';
        stored.messageId = sent.id;
        stored.postedAt = Date.now();
      }

      await db.set(`stickyMessage_${targetChannel.id}`, stored);

      const ok = await channel.send(
        `${emojis.bot.succes} | **${message.member.displayName}**, yapışkan mesaj başarıyla ayarlandı ve saklandı.`,
      );
      safeDelete(ok, 5000);
      for (const m of prompts) safeDelete(m, 5000);
      for (const r of replies) safeDelete(r, 5000);
      safeDelete(message, 5000);
      return;
    } catch (err) {
      console.error('yapiskanmesaj ekle hata:', err);
      const errMsg = await channel.send(
        `${emojis.bot.error} | İşlem iptal edildi veya hata oluştu: ${
          err.message || err
        }`,
      );
      safeDelete(errMsg, 5000);
      safeDelete(message, 5000);
      return;
    }
  } else if (sub === 'sil') {
    const target = message.mentions.channels.first();
    if (!target) {
      const m = await message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen silinecek yapışkan mesajın bulunduğu kanalı etiketle~`,
      );
      safeDelete(m, 5000);
      safeDelete(message, 5000);
      return;
    }

    const key = `stickyMessage_${target.id}`;
    const data = await db.get(key);
    if (!data) {
      const m = await message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, bu kanalda ayarlanmış bir yapışkan mesaj yok qwq~`,
      );
      safeDelete(m, 5000);
      safeDelete(message, 5000);
      return;
    }

    try {
      const deletedOk = await tryDeleteDbKey(key, 4, 300);
      if (!deletedOk) {
        const m = await message.reply(
          `${emojis.bot.error} | Veritabanından silme işlemi başarısız oldu — işlem iptal edildi.`,
        );
        safeDelete(m, 7000);
        safeDelete(message, 7000);
        return;
      }

      if (data.messageId) {
        try {
          const m = await target.messages
            .fetch(data.messageId)
            .catch(() => null);
          if (m) await m.delete().catch(() => {});
        } catch (err) {
          console.warn('Yapışkan mesaj silinirken (mesaj) hata:', err);
        }
      }

      if (data.webhook && data.webhook.id) {
        try {
          const webhooks = await target.fetchWebhooks();
          const w = webhooks.get(data.webhook.id);
          if (w) await w.delete().catch(() => {});
        } catch (err) {
          console.warn('Yapışkan webhook silinirken hata:', err);
        }
      }

      if (data.assetsChannelId) {
        try {
          const assets = guild.channels.cache.get(data.assetsChannelId);
          if (assets && assets.id !== target.id) {
            await assets.delete().catch(() => {});
          } else if (assets && assets.id === target.id) {
            console.warn('Assets kanalı hedef kanal ile aynı, silme atlandı.');
          }
        } catch (err) {
          console.warn('Assets kanalı silinirken hata:', err);
        }
      }

      const ok = await message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, ${target} kanalındaki yapışkan mesaj başarıyla silindi ve DB'den kaldırıldı.`,
      );
      safeDelete(ok, 5000);
      safeDelete(message, 5000);
      return;
    } catch (err) {
      console.error('yapiskanmesaj sil hata:', err);
      const m = await message.reply(
        `${emojis.bot.error} | Silme sırasında bir hata oluştu: ${
          err.message || err
        }`,
      );
      safeDelete(m, 5000);
      safeDelete(message, 5000);
      return;
    }
  } else if (sub === 'list') {
    try {
      const all = await db.all();
      const stickyEntries = all.filter(
        (e) => e.id && e.id.startsWith('stickyMessage_'),
      );
      if (!stickyEntries.length) {
        const m = await message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, ayarlanmış yapışkan mesaj bulunamadı qwq~`,
        );
        safeDelete(m, 5000);
        safeDelete(message, 5000);
        return;
      }

      let txt = `📌 **Ayarlanmış Yapışkan Mesajlar:**\n`;
      for (const entry of stickyEntries) {
        const channelId = entry.id.split('_')[1];
        const val = entry.value || {};
        txt += `<#${channelId}>: ${val.type || 'bilinmiyor'} — oluşturuldu: ${
          val.createdAt ? new Date(val.createdAt).toLocaleString() : '?'
        }\n`;
      }

      if (txt.length > 2000) {
        const m = await message.reply(
          `${emojis.bot.succes} | Listede çok fazla öğe var, DB'ye bakın.`,
        );
        safeDelete(m, 5000);
        safeDelete(message, 5000);
        return;
      }

      const m = await message.reply(`${emojis.bot.succes} | ${txt}`);
      safeDelete(m, 5000);
      safeDelete(message, 5000);
      return;
    } catch (err) {
      console.error('yapiskanmesaj list hata:', err);
      const m = await message.reply(
        `${emojis.bot.error} | Listeleme sırasında hata oluştu: ${
          err.message || err
        }`,
      );
      safeDelete(m, 5000);
      safeDelete(message, 5000);
      return;
    }
  } else {
    const m = await message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, geçersiz alt komut! \`ekle\`, \`sil\` veya \`list\` kullanın qwq~`,
    );
    safeDelete(m, 5000);
    safeDelete(message, 5000);
    return;
  }
};
