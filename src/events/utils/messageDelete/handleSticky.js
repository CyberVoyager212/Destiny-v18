const { MessageEmbed } = require('discord.js');

module.exports = async (client, message) => {
  if (!message.channel) return;

  const singularKey = `stickyMessage_${message.channel.id}`;
  const pluralKey = `stickyMessages_${message.channel.id}`;

  const singular = (await client.db.get(singularKey)) || null;
  const plural = (await client.db.get(pluralKey)) || null;

  let stickies = [];
  let keyType = null;

  if (singular) {
    stickies = [singular];
    keyType = 'singular';
  } else if (Array.isArray(plural) && plural.length) {
    stickies = plural;
    keyType = 'plural';
  } else {
    return;
  }

  const idx = stickies.findIndex((s) => s && s.messageId === message.id);
  if (idx === -1) return;

  const sticky = stickies[idx];

  try {
    let sent;
    if (sticky.type && sticky.type.startsWith('webhook')) {
      let webhook = null;
      try {
        const webhooks = await message.channel.fetchWebhooks();
        if (sticky.webhook && sticky.webhook.id) {
          webhook = webhooks.get(sticky.webhook.id) || null;
        }
      } catch (err) {
        webhook = null;
      }

      const webhookName =
        (sticky.webhook && sticky.webhook.name) ||
        message.guild?.me?.displayName ||
        client.user.username;
      const webhookOptions = {};
      if (sticky.profileUrl) webhookOptions.avatar = sticky.profileUrl;

      if (!webhook) {
        try {
          webhook = await message.channel.createWebhook(
            webhookName,
            webhookOptions
          );
        } catch (err) {
          webhook = null;
        }
      }

      if (webhook) {
        if (sticky.type === 'webhook-embed' && sticky.embed) {
          const e = new MessageEmbed();
          if (sticky.embed.title) e.setTitle(sticky.embed.title);
          if (sticky.embed.description)
            e.setDescription(sticky.embed.description);
          if (sticky.embed.image) e.setImage(sticky.embed.image);
          e.setColor('#2f3136');
          sent = await webhook.send({
            username: webhookName,
            avatarURL: sticky.profileUrl || undefined,
            embeds: [e],
          });
        } else {
          const sendOptions = {
            username: webhookName,
            avatarURL: sticky.profileUrl || undefined,
            content: sticky.content || undefined,
          };
          if (sticky.webhookImageUrl)
            sendOptions.files = [sticky.webhookImageUrl];
          sent = await webhook.send(sendOptions);
        }

        sticky.webhook = {
          id: webhook.id,
          token: webhook.token || null,
          name: webhook.name,
        };
      } else {
        if (sticky.type === 'webhook-embed' && sticky.embed) {
          const e = new MessageEmbed();
          if (sticky.embed.title) e.setTitle(sticky.embed.title);
          if (sticky.embed.description)
            e.setDescription(sticky.embed.description);
          if (sticky.embed.image) e.setImage(sticky.embed.image);
          e.setColor('#2f3136');
          sent = await message.channel.send({ embeds: [e] });
        } else {
          const sendOptions = { content: sticky.content || undefined };
          if (sticky.webhookImageUrl)
            sendOptions.files = [sticky.webhookImageUrl];
          sent = await message.channel.send(sendOptions);
        }
      }
    } else if (sticky.type === 'bot-embed' && sticky.embed) {
      const e = new MessageEmbed();
      if (sticky.embed.title) e.setTitle(sticky.embed.title);
      if (sticky.embed.description)
        e.setDescription(sticky.embed.description);
      if (sticky.embed.image) e.setImage(sticky.embed.image);
      e.setColor('#2f3136');
      sent = await message.channel.send({ embeds: [e] });
    } else {
      const sendOptions = { content: sticky.content || undefined };
      if (sticky.plainImageUrl) sendOptions.files = [sticky.plainImageUrl];
      sent = await message.channel.send(sendOptions);
    }

    if (sent) {
      stickies[idx].messageId = sent.id;
      stickies[idx].postedAt = Date.now();
      if (keyType === 'singular') {
        await client.db.set(singularKey, stickies[0]);
        if (await client.db.get(pluralKey)) await client.db.delete(pluralKey);
      } else {
        await client.db.set(pluralKey, stickies);
        if (await client.db.get(singularKey))
          await client.db.delete(singularKey);
      }
    }
  } catch (error) {
    console.error('Yapışkan mesaj tekrar gönderilirken hata oluştu:', error);
  }
};
