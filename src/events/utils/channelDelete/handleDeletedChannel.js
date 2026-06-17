const { joinVoiceChannel } = require('@discordjs/voice');
const { MessageEmbed } = require('discord.js');

module.exports = async (client, channel) => {
  try {
    if (!channel.guild) return;

    const db = client.db;
    const guild = channel.guild;
    const guildId = guild.id;

    const singularKey = `stickyMessage_${channel.id}`;
    const pluralKey = `stickyMessages_${channel.id}`;

    const singular = (await db.get(singularKey)) || null;
    const plural = (await db.get(pluralKey)) || null;

    const stickiesArr = [];
    let keyType = null;

    if (singular) {
      stickiesArr.push(singular);
      keyType = 'singular';
    } else if (Array.isArray(plural) && plural.length) {
      stickiesArr.push(...plural);
      keyType = 'plural';
    }

    const autoVCKey = `autoVC_${guildId}`;
    const autoVC = await db.get(autoVCKey);
    const isVCTracked = autoVC?.id === channel.id;

    if (!stickiesArr.length && !isVCTracked) return;

    try {
      const permissionOverwrites =
        channel.permissionOverwrites?.cache?.map((ov) => {
          return {
            id: ov.id,
            allow: ov.allow ? ov.allow.toArray() : [],
            deny: ov.deny ? ov.deny.toArray() : [],
            type: ov.type,
          };
        }) || [];

      const newChannel = await channel.guild.channels.create(channel.name, {
        type: channel.type,
        parent: channel.parentId || null,
        permissionOverwrites,
        reason: 'Sticky veya VC sistemi nedeniyle yeniden oluşturuldu.',
      });

      if (stickiesArr.length) {
        const newArr = [];
        for (const s of stickiesArr) {
          try {
            let sent;
            if (s.type && s.type.startsWith('webhook')) {
              let webhook = null;
              try {
                const webhooks = await newChannel.fetchWebhooks();
                if (s.webhook && s.webhook.id)
                  webhook = webhooks.get(s.webhook.id) || null;
              } catch (err) {
                webhook = null;
              }

              const webhookName =
                (s.webhook && s.webhook.name) || client.user.username;
              const webhookOptions = {};
              if (s.profileUrl) webhookOptions.avatar = s.profileUrl;

              if (!webhook) {
                try {
                  webhook = await newChannel.createWebhook(
                    webhookName,
                    webhookOptions
                  );
                } catch (err) {
                  webhook = null;
                }
              }

              if (webhook) {
                if (s.type === 'webhook-embed' && s.embed) {
                  const e = new MessageEmbed();
                  if (s.embed.title) e.setTitle(s.embed.title);
                  if (s.embed.description)
                    e.setDescription(s.embed.description);
                  if (s.embed.image) e.setImage(s.embed.image);
                  e.setColor('#2f3136');
                  sent = await webhook.send({
                    username: webhookName,
                    avatarURL: s.profileUrl || undefined,
                    embeds: [e],
                  });
                } else {
                  const sendOptions = {
                    username: webhookName,
                    avatarURL: s.profileUrl || undefined,
                    content: s.content || undefined,
                  };
                  if (s.webhookImageUrl)
                    sendOptions.files = [s.webhookImageUrl];
                  sent = await webhook.send(sendOptions);
                }
                s.webhook = {
                  id: webhook.id,
                  token: webhook.token || null,
                  name: webhook.name,
                };
              } else {
                if (s.type === 'webhook-embed' && s.embed) {
                  const e = new MessageEmbed();
                  if (s.embed.title) e.setTitle(s.embed.title);
                  if (s.embed.description)
                    e.setDescription(s.embed.description);
                  if (s.embed.image) e.setImage(s.embed.image);
                  e.setColor('#2f3136');
                  sent = await newChannel.send({ embeds: [e] });
                } else {
                  const sendOptions = { content: s.content || undefined };
                  if (s.webhookImageUrl)
                    sendOptions.files = [s.webhookImageUrl];
                  sent = await newChannel.send(sendOptions);
                }
              }
            } else if (s.type === 'bot-embed' && s.embed) {
              const e = new MessageEmbed();
              if (s.embed.title) e.setTitle(s.embed.title);
              if (s.embed.description) e.setDescription(s.embed.description);
              if (s.embed.image) e.setImage(s.embed.image);
              e.setColor('#2f3136');
              sent = await newChannel.send({ embeds: [e] });
            } else {
              const sendOptions = { content: s.content || undefined };
              if (s.plainImageUrl) sendOptions.files = [s.plainImageUrl];
              sent = await newChannel.send(sendOptions);
            }

            if (sent) {
              s.messageId = sent.id;
              s.postedAt = Date.now();
            }
            newArr.push(s);
          } catch (err) {
            console.error('Sticky yeniden gönderme hatası:', err);
            newArr.push(s);
          }
        }

        if (keyType === 'singular') {
          await db.set(`stickyMessage_${newChannel.id}`, newArr[0]);
          if (await db.get(pluralKey)) await db.delete(pluralKey);
          if (await db.get(singularKey)) await db.delete(singularKey);
        } else {
          await db.set(`stickyMessages_${newChannel.id}`, newArr);
          if (await db.get(singularKey)) await db.delete(singularKey);
          if (await db.get(pluralKey)) await db.delete(pluralKey);
        }
      } else {
        if (keyType === 'singular') {
          if (await db.get(singularKey)) await db.delete(singularKey);
        } else {
          if (await db.get(pluralKey)) await db.delete(pluralKey);
        }
      }

      if (isVCTracked) {
        await db.set(autoVCKey, { id: newChannel.id, name: newChannel.name });
        try {
          const connection = joinVoiceChannel({
            channelId: newChannel.id,
            guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
          });
          connection.on('stateChange', () => {});
        } catch (err) {
          console.error('Voice kanalına bağlanırken hata:', err);
        }
      }
    } catch (err) {
      console.error('Kanal yeniden oluşturulurken hata:', err);
    }
  } catch (err) {
    console.error('channelDelete handler hata:', err);
  }
};
