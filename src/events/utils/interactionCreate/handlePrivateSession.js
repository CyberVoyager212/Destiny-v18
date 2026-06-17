module.exports = async (client, interaction, db) => {
  const { customId, user, channel, guild } = interaction;
  
  const listKey = `privateses_list_${guild.id}`;
  const list = (await db.get(listKey)) || [];
  const [prefix, action, voiceId] = customId.split('_');
  const meta = list.find((x) => x.voiceId === voiceId);
  if (!meta) {
    return interaction.reply({ content: '💤 *Bu oda artık yok...*', ephemeral: true });
  }
  const voiceChannel = guild.channels.cache.get(meta.voiceId);
  if (!voiceChannel) {
    return interaction.reply({ content: '💤 *Bu oda kaybolmuş...*', ephemeral: true });
  }
  if (user.id !== meta.ownerId) {
    return interaction.reply({ content: '🚫 *Bu oda sana ait değil, kahraman!*', ephemeral: true });
  }

  if (action === 'rename') {
    await interaction.reply({ content: '✏️ *Yeni oda adını yaz (60 saniye içinde).*', ephemeral: true });
    const filter = (m) => m.author.id === user.id;
    const collector = channel.createMessageCollector({ filter, max: 1, time: 60000 });
    collector.on('collect', async (msg) => {
      const newName = msg.content.trim().slice(0, 90);
      await voiceChannel.setName(newName);
      await interaction.followUp({ content: `✅ *Odanın adı değişti → **${newName}***`, ephemeral: true });
      msg.delete().catch(() => {});
    });
  }

  if (action === 'lock') {
    const listKey = `privateses_list_${guild.id}`;
    const metaList = (await client.db.get(listKey)) || [];
    const meta = metaList.find((x) => x.voiceId === voiceId);

    if (!meta) {
      return interaction.reply({ content: '❌ Bu oda kayıtlarda bulunamadı.', ephemeral: true });
    }
    if (meta.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Sadece oda sahibi bu işlemi yapabilir.', ephemeral: true });
    }

    meta.locked = !meta.locked;
    const updated = metaList.map((x) => (x.voiceId === meta.voiceId ? meta : x));
    await client.db.set(listKey, updated);

    if (meta.locked) {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, { VIEW_CHANNEL: false, CONNECT: false });
      await interaction.reply({ content: '🔒 Oda kilitlendi. Artık kimse göremiyor ve giremiyor.', ephemeral: true });
    } else {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, { VIEW_CHANNEL: true, CONNECT: true });
      await interaction.reply({ content: '🔓 Oda açıldı. Herkes görebilir ve bağlanabilir.', ephemeral: true });
    }
  }

  if (action === 'invite') {
    await interaction.reply({ content: '👥 *Davet etmek istediğin kullanıcının **ID**’sini yaz (60s).*', ephemeral: true });
    const filter = (m) => m.author.id === user.id;
    const collector = channel.createMessageCollector({ filter, max: 1, time: 60000 });
    collector.on('collect', async (msg) => {
      const input = msg.content.trim();
      let target;
      try { target = await guild.members.fetch(input); } catch { target = null; }
      if (!target) {
        return channel.send('❌ *Bu kullanıcı bulunamadı.*');
      }
      await voiceChannel.permissionOverwrites.edit(target.id, { CONNECT: true, VIEW_CHANNEL: true });
      channel.send(`🌸 **${target.user.tag}** davet edildi!`);
      msg.delete().catch(() => {});
    });
  }

  if (action === 'delete') {
    await interaction.reply({ content: '💣 *Odan yok ediliyor...*', ephemeral: true });
    try { await voiceChannel.delete(); } catch {}
    try {
      const textChannel = guild.channels.cache.get(meta.textId);
      if (textChannel) await textChannel.delete();
    } catch {}
    const newList = list.filter((x) => x.voiceId !== meta.voiceId);
    await db.set(listKey, newList);
  }
};
