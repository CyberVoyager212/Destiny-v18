const { MessageEmbed } = require('discord.js');
const emojis = require('../../../emoji.json');

module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;
  const content = (message.content || '').trim();

  const otoCevaplar = (await db.get(`otoCevap_${guildId}`)) || [];

  for (const cev of otoCevaplar) {
    const msgLower = content.toLowerCase();
    const triggerLower = (cev.trigger || '').toLowerCase();
    const isMatch =
      cev.exact === 1
        ? msgLower === triggerLower
        : msgLower.includes(triggerLower);

    if (!isMatch) continue;

    const opts = cev.options || {};
    try {
      if (opts.typing) await message.channel.sendTyping().catch(() => {});
      if (opts.delete) await message.delete().catch(() => {});

      if (opts.dm) {
        try {
          if (cev.embed === 1) {
            const embed = new MessageEmbed()
              .setTitle(cev.title || 'Oto-Cevap')
              .setDescription(cev.response)
              .setColor('BLUE');
            await message.author.send({ embeds: [embed] }).catch(() => {});
          } else {
            await message.author
              .send(
                cev.response +
                  (opts.mention ? ` <@${message.author.id}>` : ''),
              )
              .catch(() => {});
          }
        } catch (err) {
          console.error('DM gönderilemedi:', err);
        }
        continue;
      }

      if (opts.webhook) {
        let webhook = (await message.channel.fetchWebhooks()).find(
          (wh) => wh.name === 'OtoCevap',
        );
        if (!webhook) {
          webhook = await message.channel.createWebhook('OtoCevap', {
            avatar: client.user.displayAvatarURL(),
          });
        }
        const username =
          message.member?.displayName || message.author.username;
        const avatar = message.author.displayAvatarURL({ dynamic: true });

        if (cev.embed === 1) {
          const embed = new MessageEmbed()
            .setTitle(cev.title || 'Oto-Cevap')
            .setDescription(cev.response)
            .setColor('BLUE');
          const sent = await webhook
            .send({
              embeds: [embed],
              username,
              avatarURL: avatar,
            })
            .catch(() => {});
          if (opts.ephemeral && sent) {
            const ephemeralDuration = Number(opts.ephemeralSec) || 8;
            setTimeout(
              () => sent.delete().catch(() => {}),
              ephemeralDuration * 1000,
            );
          }
        } else {
          const text =
            cev.response + (opts.mention ? ` <@${message.author.id}>` : '');
          const sent = await webhook
            .send({
              content: text,
              username,
              avatarURL: avatar,
            })
            .catch(() => {});
          if (opts.ephemeral && sent) {
            const ephemeralDuration = Number(opts.ephemeralSec) || 8;
            setTimeout(
              () => sent.delete().catch(() => {}),
              ephemeralDuration * 1000,
            );
          }
        }
      } else {
        if (cev.embed === 1) {
          const embed = new MessageEmbed()
            .setTitle(cev.title || 'Oto-Cevap')
            .setDescription(cev.response)
            .setColor('BLUE');
          const sent = await message.channel
            .send({ embeds: [embed] })
            .catch(() => {});
          if (opts.ephemeral && sent) {
            const ephemeralDuration = Number(opts.ephemeralSec) || 8;
            setTimeout(
              () => sent.delete().catch(() => {}),
              ephemeralDuration * 1000,
            );
          }
        } else {
          const text =
            cev.response + (opts.mention ? ` <@${message.author.id}>` : '');
          const sent = await message.channel.send(text).catch(() => {});
          if (opts.ephemeral && sent) {
            const ephemeralDuration = Number(opts.ephemeralSec) || 8;
            setTimeout(
              () => sent.delete().catch(() => {}),
              ephemeralDuration * 1000,
            );
          }
        }
      }
    } catch (err) {
      console.error('Oto-Cevap Hata:', err);
      try {
        await message.channel
          .send(
            `${
              emojis.bot.error
            } | ✨ Oto-cevap çalıştırılırken hata oluştu: ${
              err.message || 'Bilinmeyen'
            }`,
          )
          .catch(() => {});
      } catch {}
    }
  }

  return false;
};
