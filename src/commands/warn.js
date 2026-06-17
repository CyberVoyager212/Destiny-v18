const { Collection } = require('discord.js');
const emojis = require('../emoji.json');

module.exports = {
  help: {
    name: 'warn',
    aliases: ['uyar'],
    usage: 'warn <ver|list|clear> <@kullanıcı / ID / isim> [sebep]',
    description:
      'Kullanıcıya uyarı verme, uyarıları listeleme veya temizleme komutu.',
    category: 'Moderasyon',
    cooldown: 5,
    permissions: ['MANAGE_MESSAGES'],
  },

  execute: async (client, message, args) => {
    const db = client.db;

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'ver') {
      const idx = sub === 'ver' ? 1 : 0;
      const user =
        message.mentions.members?.first() ||
        message.guild.members.cache.get(args[idx]) ||
        message.guild.members.cache.find(
          (m) => m.user.username.toLowerCase() === args[idx]?.toLowerCase(),
        );

      if (!user)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, lütfen uyarı vermek istediğin kullanıcıyı belirt~`,
        );

      if (user.user.bot)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, botlara uyarı veremezsin owo`,
        );

      const reason = args.slice(idx + 1).join(' ') || 'Sebep belirtilmedi.';
      let warnings =
        (await db.get(`warnings_${message.guild.id}_${user.id}`)) || [];

      warnings.push({ admin: message.author.id, reason, time: Date.now() });
      await db.set(`warnings_${message.guild.id}_${user.id}`, warnings);

      await message.channel.send(
        `${emojis.bot.succes} | **${user.user.tag}** kullanıcısına uyarı verildi! (Toplam: ${warnings.length})`,
      );

      if (warnings.length >= 5) {
        try {
          const list = warnings
            .map(
              (w, i) =>
                `**${i + 1}.** <@${w.admin}> — ${w.reason} (${new Date(
                  w.time,
                ).toLocaleString()})`,
            )
            .join('\n');

          try {
            await user.send(
              `${emojis.bot.error} | **Sunucuda 5 uyarıya ulaştığın için banlandın.**\n` +
                `İtiraz için yöneticilere başvurabilirsin:\n\n${list}`,
            );
          } catch {}

          await user.ban({ reason: '5 uyarıya ulaştı.' });
          await db.delete(`warnings_${message.guild.id}_${user.id}`);

          message.channel.send(
            `${emojis.bot.succes} | **${user.user.tag}** 5 uyarı sebebiyle banlandı.`,
          );
        } catch (e) {
          console.error('Warn->ban hatası:', e);
          message.channel.send(
            `${emojis.bot.error} | **${message.member.displayName}**, ban uygulanırken bir hata oluştu qwq~ \n> Hata: \`${e.message}\``,
          );
        }
      }

      return;
    }

    if (sub === 'list') {
      const user =
        message.mentions.members?.first() ||
        message.guild.members.cache.get(args[1]) ||
        message.guild.members.cache.find(
          (m) => m.user.username.toLowerCase() === args[1]?.toLowerCase(),
        );

      if (!user)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, uyarılarını görmek istediğin kullanıcıyı belirt lütfen~`,
        );

      const warnings =
        (await db.get(`warnings_${message.guild.id}_${user.id}`)) || [];
      if (!warnings.length)
        return message.reply(
          `${emojis.bot.succes} | **${user.user.tag}** isimli kullanıcının hiç uyarısı yok~`,
        );

      const list = warnings
        .map(
          (w, i) =>
            `**${i + 1}.** <@${w.admin}> — ${w.reason} (${new Date(
              w.time,
            ).toLocaleString()})`,
        )
        .join('\n');

      return message.channel.send(
        `${emojis.bot.succes} | **${user.user.tag}** uyarıları:\n${list}`,
      );
    }

    if (sub === 'clear') {
      const user =
        message.mentions.members?.first() ||
        message.guild.members.cache.get(args[1]) ||
        message.guild.members.cache.find(
          (m) => m.user.username.toLowerCase() === args[1]?.toLowerCase(),
        );

      if (!user)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, uyarılarını silmek istediğin kullanıcıyı belirt~`,
        );

      const warnings =
        (await db.get(`warnings_${message.guild.id}_${user.id}`)) || [];
      if (!warnings.length)
        return message.reply(
          `${emojis.bot.succes} | **${user.user.tag}** zaten hiçbir uyarıya sahip değil~`,
        );

      await db.delete(`warnings_${message.guild.id}_${user.id}`);
      return message.channel.send(
        `${emojis.bot.succes} | **${user.user.tag}** kullanıcısının uyarıları temizlendi~`,
      );
    }

    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, geçersiz alt komut! Kullanabileceğin seçenekler: \`ver\`, \`list\`, \`clear\``,
    );
  },
};
