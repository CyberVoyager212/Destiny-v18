const { MessageEmbed } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const emojis = require('../emoji.json');

module.exports.execute = async (client, message, args) => {
  const guild = message.guild;
  const action = args[0]?.toLowerCase();
  const type = args[1]?.toLowerCase();

  if (!action || !type) {
    return message.reply(
      '🌸 Kullanım: `!oyun <bom|kelime> <oluştur|sil|dinle>`'
    );
  }

  const validActions = {
    oluştur: ['oluştur', 'ekle', 'create', 'kur'],
    sil: ['sil', 'remove', 'delete', 'kapat'],
    dinle: ['dinle', 'takip', 'listen', 'watch'],
  };

  let resolvedAction = null;
  for (const [key, aliases] of Object.entries(validActions)) {
    if (aliases.includes(type)) resolvedAction = key;
  }

  if (!['bom', 'kelime'].includes(action) || !resolvedAction) {
    return message.reply(
      `${emojis.bot.error} Kullanım: \`!oyun bom oluştur\` veya \`!oyun kelime sil\``
    );
  }

  if (action === 'bom') {
    if (resolvedAction === 'oluştur') {
      const existing = await db.get(`bom_${guild.id}`);
      if (existing) return message.reply('💣 BOM kanalı zaten mevcut!');
      const channel = await guild.channels.create('💣-bom', {
        type: 'GUILD_TEXT',
        reason: 'Oyun BOM kanalı oluşturuldu',
        topic:
          '💣 BOM Oyunu — Sayıları sırayla yaz, 5’in katında “BOM” yaz! 🚀',
      });
      await db.set(`bom_${guild.id}`, channel.id);
      const embed = new MessageEmbed()
        .setTitle('💣✨ BOM Oyunu Hazır!')
        .setDescription(
          `🎮 Oyun kanalı: <#${channel.id}>\n\n➡️ Kurallar:\n1️⃣ 1’den başlayarak sırayla sayın\n5️⃣ her 5’in katında **BOM** yazın\n❌ Yanlış yapanın mesajı silinir`
        )
        .setColor('#FF3366')
        .setThumbnail('https://i.imgur.com/0y8Ftya.gif')
        .setFooter({
          text: 'BOM Oyunu • Eğlenmeye Başla!',
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    if (resolvedAction === 'sil') {
      const channelId = await db.get(`bom_${guild.id}`);
      if (!channelId) return message.reply('❌ BOM kanalı zaten yok!');
      const channel = guild.channels.cache.get(channelId);
      if (channel) await channel.delete('BOM oyunu silindi');
      await db.delete(`bom_${guild.id}`);
      return message.reply('💣 BOM kanalı silindi!');
    }
    if (resolvedAction === 'dinle') {
      const channel = guild.channels.cache.find((c) => c.name === '💣-bom');
      if (!channel)
        return message.reply('❌ Dinlenecek BOM kanalı bulunamadı!');
      await db.set(`bom_${guild.id}`, channel.id);
      return message.reply(`👂 Artık BOM kanalı dinleniyor: <#${channel.id}>`);
    }
  }

  if (action === 'kelime') {
    if (resolvedAction === 'oluştur') {
      const existing = await db.get(`kelime_${guild.id}`);
      if (existing) return message.reply('⭐ KELİME kanalı zaten mevcut!');
      const channel = await guild.channels.create('⭐-kelime', {
        type: 'GUILD_TEXT',
        reason: 'Oyun KELİME kanalı oluşturuldu',
        topic:
          '⭐ Kelime Oyunu — Geçerli kelimelerle oynayın, son harfe göre devam edin! ✨',
      });
      await db.set(`kelime_${guild.id}`, channel.id);
      const embed = new MessageEmbed()
        .setTitle('⭐🌸 Kelime Oyunu Hazır!')
        .setDescription(
          `📖 Oyun kanalı: <#${channel.id}>\n\n➡️ Kurallar:\n✨ Sadece geçerli Türkçe kelimeler yazılır\n🔠 Yeni kelime, önceki kelimenin **son harfi** ile başlamalı\n❌ Yanlış yapanın mesajı silinir`
        )
        .setColor('#55FFAA')
        .setThumbnail('https://i.imgur.com/0y8Ftya.gif')
        .setFooter({
          text: 'Kelime Oyunu • En yaratıcı kelimeyi bul!',
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    if (resolvedAction === 'sil') {
      const channelId = await db.get(`kelime_${guild.id}`);
      if (!channelId) return message.reply('❌ KELİME kanalı zaten yok!');
      const channel = guild.channels.cache.get(channelId);
      if (channel) await channel.delete('KELİME oyunu silindi');
      await db.delete(`kelime_${guild.id}`);
      return message.reply('⭐ KELİME kanalı silindi!');
    }
    if (resolvedAction === 'dinle') {
      const channel = guild.channels.cache.find((c) => c.name === '⭐-kelime');
      if (!channel)
        return message.reply('❌ Dinlenecek KELİME kanalı bulunamadı!');
      await db.set(`kelime_${guild.id}`, channel.id);
      return message.reply(
        `👂 Artık KELİME kanalı dinleniyor: <#${channel.id}>`
      );
    }
  }
};

module.exports.help = {
  name: 'oyun',
  description: 'BOM ve KELİME oyun kanallarını oluşturur, siler veya dinler',
  usage: 'oyun <bom|kelime> <oluştur|sil|dinle>',
  category: 'Eğlence',
  cooldown: 5,
  permissions: ['MANAGE_CHANNELS'],
};
