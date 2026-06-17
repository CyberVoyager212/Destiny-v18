const {
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  Permissions,
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const emojis = require('../emoji.json');

exports.help = {
  name: 'ticket',
  aliases: ['destek', 'talep'],
  usage: 'ticket',
  description: 'Destek talebi oluşturur ve butonlarla yönetilir.',
  category: 'Araçlar',
  cooldown: 10,
};

exports.execute = async (client, message, args) => {
  const guild = message.guild;
  const user = message.author;
  const member = message.member;

  try {
    const isAdmin = member.permissions.has(Permissions.FLAGS.ADMINISTRATOR);
    if (isAdmin) {
      await message.delete().catch(() => {});

      const ask = async (question, defaultVal) => {
        const qMsg = await message.channel.send(question);
        try {
          const collected = await message.channel.awaitMessages({
            filter: (m) => m.author.id === user.id,
            max: 1,
            time: 60000,
            errors: ['time'],
          });
          const answer = collected.first().content.trim();
          await qMsg.delete().catch(() => {});
          await collected
            .first()
            .delete()
            .catch(() => {});
          if (!answer || answer.toLowerCase() === 'geç') return defaultVal;
          return answer;
        } catch {
          await qMsg.delete().catch(() => {});
          return defaultVal;
        }
      };

      const defaultTitle = '🎫 Destek Paneli';
      const defaultDesc = `${emojis.bot.succes} | Aşağıdaki butona basarak yeni bir ticket açabilirsiniz.\n> Bu mesaj bir paneldir.`;
      const defaultFooter = `Panel oluşturan: ${member.user.tag}`;

      const title = await ask(
        '🛠️ **Menü Başlığı** ne olsun? (geç yazarak varsayılan bırakabilirsiniz)',
        defaultTitle,
      );
      const description = await ask(
        '📝 **Menü Açıklaması** ne olsun? (geç yazarak varsayılan bırakabilirsiniz)',
        defaultDesc,
      );
      let footerText = await ask(
        '📌 **Footer** ne yazsın? (`?saat` yazarak saat ekleyebilirsiniz, geç yazarak varsayılan)',
        defaultFooter,
      );
      if (footerText.includes('?saat')) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        footerText = footerText.replace('?saat', timeStr);
      }

      const panelButtons = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('ticket_open')
          .setLabel('🎫 Ticket Aç')
          .setStyle('PRIMARY'),
      );

      const panelEmbed = new MessageEmbed()
        .setTitle(title)
        .setDescription(description)
        .setColor('#57F287')
        .setFooter({ text: footerText })
        .setTimestamp();

      await message.channel.send({
        embeds: [panelEmbed],
        components: [panelButtons],
      });
      return;
    }

    const base = `ticket-${user.username.toLowerCase()}`.replace(
      /[^a-z0-9\-]/g,
      '',
    );
    const existing = guild.channels.cache.find(
      (ch) => ch.name === base || ch.name.startsWith(`${base}-`),
    );
    if (existing) {
      return message.channel
        .send(
          `${emojis.bot.error} | **${message.member.displayName}**, zaten bir ticket kanalın var~ (${existing}) \n> Fazladan açmana gerek yok, yoksa sihirli kapılar karışır qwq`,
        )
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
    }

    const prompt = await message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, ticket açmak için **onayla**, iptal için **iptal** yazmalısın. (30s)`,
    );

    const filter = (m) =>
      m.author.id === user.id &&
      ['onayla', 'iptal'].includes(m.content.toLowerCase()) &&
      m.channel.id === message.channel.id;

    let collected;
    try {
      collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 30000,
        errors: ['time'],
      });
    } catch {
      await prompt.delete().catch(() => {});
      return message.channel
        .send(
          `${emojis.bot.error} | **${message.member.displayName}**, zaman doldu :c \n> Biraz daha hızlı olsan harika olurdu~`,
        )
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
    }

    const reply = collected.first();
    await prompt.delete().catch(() => {});
    await message.delete().catch(() => {});
    await reply.delete().catch(() => {});

    if (reply.content.toLowerCase() === 'iptal') {
      return message.channel
        .send(
          `${emojis.bot.error} | **${message.member.displayName}**, ticket açma işlemini iptal ettin~ \n> Belki başka zaman tekrar denersin ^-^`,
        )
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
    }

    let channelName = base;
    let idx = 1;
    while (guild.channels.cache.some((ch) => ch.name === channelName)) {
      idx++;
      channelName = `${base}-${idx}`;
    }

    const ticketChannel = await guild.channels.create(channelName, {
      type: 'GUILD_TEXT',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
        {
          id: user.id,
          allow: [
            Permissions.FLAGS.VIEW_CHANNEL,
            Permissions.FLAGS.SEND_MESSAGES,
          ],
        },
      ],
    });

    await db.set(`ticket_channel_${ticketChannel.id}`, user.id);

    const buttons = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId('ticket_close')
        .setLabel('🗑 Kapat')
        .setStyle('DANGER'),
      new MessageButton()
        .setCustomId('ticket_adduser')
        .setLabel('➕ Kullanıcı Ekle')
        .setStyle('PRIMARY'),
    );

    const embed = new MessageEmbed()
      .setTitle('🎫 Yeni Ticket Açıldı!')
      .setDescription(
        `${emojis.bot.succes} | ${user}, destek talebin başarıyla oluşturuldu~ \n> Aşağıdaki butonlarla ticket'ını yönetebilirsin.`,
      )
      .setColor('#5865F2')
      .setFooter({ text: `Ticket ID: ${ticketChannel.id}` })
      .setTimestamp();

    await ticketChannel.send({
      content: `${user}`,
      embeds: [embed],
      components: [buttons],
    });

    message.channel
      .send(
        `${emojis.bot.succes} | **${message.member.displayName}**, ticket kanalın hazır! ${ticketChannel} \n> Haydi, sorularını orada paylaşabilirsin :3`,
      )
      .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
  } catch (err) {
    console.error(err);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, ticket açılırken beklenmedik bir hata oldu >~< \n> Hata: \`${err.message}\``,
    );
  }
};
