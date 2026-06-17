const { MessageActionRow, MessageButton, MessageEmbed, Permissions } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = async (client, interaction, member) => {
  const { customId, user, channel, guild } = interaction;

  if (customId === 'ticket_open') {
    const base = `ticket-${user.username.toLowerCase()}`.replace(/[^a-z0-9\-]/g, '');
    const existing = guild.channels.cache.find((ch) => ch.name === base || ch.name.startsWith(`${base}-`));
    if (existing) {
      return interaction.reply({ content: `❗ Zaten bir ticket kanalın var: ${existing}`, ephemeral: true });
    }

    let channelName = base;
    let idx = 1;
    while (guild.channels.cache.some((ch) => ch.name === channelName)) {
      idx++;
      channelName = `${base}-${idx}`;
    }

    await interaction.deferReply({ ephemeral: true });

    const ticketChannel = await guild.channels.create(channelName, {
      type: 'GUILD_TEXT',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
        { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
      ],
    });

    await db.set(`ticket_channel_${ticketChannel.id}`, user.id);

    const buttons = new MessageActionRow().addComponents(
      new MessageButton().setCustomId('ticket_close').setLabel('🗑 Kapat').setStyle('DANGER'),
      new MessageButton().setCustomId('ticket_adduser').setLabel('➕ Kullanıcı Ekle').setStyle('PRIMARY')
    );

    const embed = new MessageEmbed()
      .setTitle('🎫 Yeni Ticket Açıldı!')
      .setDescription(`${user}, destek talebin başarıyla oluşturuldu~ \n> Aşağıdaki butonlarla ticket'ını yönetebilirsin.`)
      .setColor('#5865F2')
      .setFooter({ text: `Ticket ID: ${ticketChannel.id}` })
      .setTimestamp();

    await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [buttons] });

    return interaction.editReply({ content: `✅ Ticket oluşturuldu: ${ticketChannel}` });
  }

  const ticketOwnerId = await db.get(`ticket_channel_${channel.id}`);
  if (ticketOwnerId) {
    const isOwner = user.id === ticketOwnerId;
    const isStaff = member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS);

    if (customId === 'ticket_close') {
      if (!isOwner && !isStaff) {
        return interaction.reply({ content: '🚫 *Bu kapıyı kapatmaya yetkin yok, kahraman!*', ephemeral: true });
      }
      if (isOwner && !isStaff) {
        await channel.permissionOverwrites.edit(ticketOwnerId, { VIEW_CHANNEL: false });
        return interaction.reply({ content: '🔒 *Biletini kapattın, artık göremiyorsun...*', ephemeral: true });
      }
      if (isStaff) {
        await interaction.deferReply({ ephemeral: true });

        let archiveCat = guild.channels.cache.find((c) => c.name === 'ticket-arsiv' && c.type === 'GUILD_CATEGORY');
        if (!archiveCat) {
          archiveCat = await guild.channels.create('ticket-arsiv', { type: 'GUILD_CATEGORY' });
        }

        const msgs = await channel.messages.fetch({ limit: 100 });
        const content = msgs.map((m) => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`).reverse().join('\n');

        let arcName = `${channel.name}-arsiv`;
        let idx2 = 1;
        while (guild.channels.cache.find((c) => c.name === arcName)) {
          idx2++;
          arcName = `${channel.name}-arsiv-${idx2}`;
        }

        const arcChannel = await guild.channels.create(arcName, {
          type: 'GUILD_TEXT',
          parent: archiveCat.id,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            { id: member.roles.highest.id, allow: [Permissions.FLAGS.VIEW_CHANNEL] },
          ],
        });

        if (content.length > 2000) {
          for (let i = 0; i < content.length; i += 1990) {
            await arcChannel.send('```' + content.slice(i, i + 1990) + '```');
          }
        } else {
          await arcChannel.send('```' + content + '```');
        }

        await db.delete(`ticket_user_${ticketOwnerId}`);
        await db.delete(`ticket_channel_${channel.id}`);
        await channel.delete().catch(() => {});

        return interaction.editReply({ content: '✅ Bilet arşivlendi ve kapatıldı.' }).catch(() => {});
      }
    }

    if (customId === 'ticket_adduser') {
      if (!isStaff) {
        return interaction.reply({ content: '⚔️ *Buna gücün yetmiyor, sensei...*', ephemeral: true });
      }
      await interaction.reply({ content: '📝 *Eklenecek kişinin **ID**’sini yaz bakalım (60 saniye).*', ephemeral: true });

      const filter = (m) => m.author.id === user.id;
      const collector = channel.createMessageCollector({ filter, max: 1, time: 60000 });

      collector.on('collect', async (msg) => {
        const input = msg.content.trim();
        if (!/^\d{17,19}$/.test(input)) {
          await channel.send({ content: '❌ *Yanlış ID girdin, kahraman adayı!*' });
          msg.delete().catch(() => {});
          return;
        }
        collector.stop('ok');
        msg.delete().catch(() => {});

        let target;
        try { target = await guild.members.fetch(input); } catch { target = null; }
        if (!target) {
          return channel.send({ content: '❌ *Böyle bir kullanıcı bu evrende yok...*' });
        }

        await channel.permissionOverwrites.edit(target.id, { VIEW_CHANNEL: true, SEND_MESSAGES: true });
        channel.send({ content: `🌟 **${target.user.tag}** aramıza katıldı!` });
      });

      collector.on('end', (collected, reason) => {
        if (reason !== 'ok') {
          interaction.followUp({ content: '⌛ *Zaman doldu, fırsat kaçtı...*', ephemeral: true });
        }
      });
    }
  }
};
