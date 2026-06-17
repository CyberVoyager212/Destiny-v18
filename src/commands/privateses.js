const { MessageEmbed } = require('discord.js');

module.exports = {
  help: {
    name: 'privateses',
    aliases: ['ozel-ses', 'privatevoice'],
    usage: 'privateses <oluştur|sil|dinle|setup> [hub-ismi] [kategori-ismi]',
    description: 'Özel ses kanalı sistemi: oluştur, sil, dinle veya setup.',
    category: 'Moderasyon',
    cooldown: 5,
    permissions: ['MANAGE_CHANNELS'],
  },

  execute: async (client, message, args) => {
    const sub = args[0]?.toLowerCase();
    if (!sub)
      return message.channel.send(
        'Kullanım: `privateses <oluştur|sil|dinle|setup> [hub-ismi] [kategori-ismi]`',
      );

    const actions = {
      oluştur: ['oluştur', 'ekle', 'create', 'kur'],
      sil: ['sil', 'remove', 'delete', 'kapat'],
      dinle: ['dinle', 'takip', 'listen', 'watch'],
      setup: ['setup', 'ayarla', 'configure'],
    };

    let resolvedAction = null;
    for (const [key, aliases] of Object.entries(actions))
      if (aliases.includes(sub)) resolvedAction = key;
    if (!resolvedAction) return message.reply('Geçersiz alt komut!');

    const guild = message.guild;

    const hubName = args.slice(1, 2).join(' ') || '➕ Özel Oda Oluştur';
    const categoryName = args.slice(2).join(' ') || 'Özel Ses Odaları';

    if (resolvedAction === 'setup' || resolvedAction === 'oluştur') {
      let category = guild.channels.cache.find(
        (c) => c.type === 'GUILD_CATEGORY' && c.name === categoryName,
      );
      if (!category)
        category = await guild.channels.create(categoryName, {
          type: 'GUILD_CATEGORY',
          reason: 'Özel ses sistemi kategori oluşturuldu',
        });

      let hub = guild.channels.cache.find(
        (c) =>
          c.type === 'GUILD_VOICE' &&
          c.name === hubName &&
          c.parentId === category.id,
      );

      if (resolvedAction === 'oluştur' && hub)
        return message.channel.send('Hub kanalı zaten mevcut!');

      if (!hub)
        hub = await guild.channels.create(hubName, {
          type: 'GUILD_VOICE',
          parent: category.id,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, allow: ['CONNECT', 'VIEW_CHANNEL'] },
          ],
          reason: 'Özel ses sistemi hub kanalı',
        });

      await client.db.set(`privateses_${guild.id}`, {
        categoryId: category.id,
        hubId: hub.id,
      });

      if (resolvedAction === 'setup') {
        const embed = new MessageEmbed()
          .setTitle('Özel Ses Sistemi Kuruldu')
          .setDescription(
            `Kategori: **${category.name}**\nHub: **${hub.name}**\nHub kanalına giren kullanıcı için otomatik özel oda oluşturulacaktır.`,
          )
          .setColor('#2f3136');

        return message.channel.send({ embeds: [embed] });
      } else {
        return message.channel.send(
          `Hub kanalı oluşturuldu ve dinlemeye hazır: <#${hub.id}>`,
        );
      }
    }

    if (resolvedAction === 'sil') {
      const data = await client.db.get(`privateses_${guild.id}`);
      if (!data?.hubId)
        return message.channel.send('Silinecek hub kanalı bulunamadı!');
      const hub = guild.channels.cache.get(data.hubId);
      if (hub) await hub.delete('Özel ses hub silindi');
      await client.db.delete(`privateses_${guild.id}`);
      return message.channel.send('Hub kanalı ve DB kaydı silindi.');
    }

    if (resolvedAction === 'dinle') {
      let hub;

      if (args[1] && /^\d{17,19}$/.test(args[1])) {
        hub = guild.channels.cache.get(args[1]);
      }

      if (!hub) {
        const hubNameFull = args.slice(1).join(' ');
        hub = guild.channels.cache.find(
          (c) =>
            c.type === 'GUILD_VOICE' &&
            c.name.toLowerCase().includes(hubNameFull.toLowerCase()),
        );
      }

      if (!hub) {
        return message.channel.send(
          'Dinlenecek hub kanalı bulunamadı! (id yazdıysanız isim deneyin isim yazdıysanız id deneyin)',
        );
      }

      await client.db.set(`privateses_${guild.id}`, {
        hubId: hub.id,
        categoryId: hub.parentId,
      });

      return message.channel.send(`Hub kanalı artık dinleniyor: <#${hub.id}>`);
    }
  },
};
