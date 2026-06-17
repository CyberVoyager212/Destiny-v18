const { MessageEmbed, Permissions } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const emojis = require('../emoji.json');

exports.help = {
  name: 'advancedmute',
  aliases: ['amute'],
  usage:
    'advancedmute <@kullanıcı|id|isim> <süre(dk)> | kaldır | süre <@kullanıcı>',
  description:
    'Gelişmiş mute sistemi: kurulum, susturma, süre sorgulama ve sistemi kaldırma.',
  category: 'Moderasyon',
  cooldown: 5,
  extraFields: [
    {
      name: 'Alt Komutlar',
      value:
        '`advancedmute <kullanıcı> <süre>`: Belirtilen kullanıcıyı verilen dakika kadar susturur.\n' +
        '`advancedmute kaldır`: Sunucudaki mute rolünü ve muted-only kanalını silerek sistemi temizler.\n' +
        '`advancedmute süre <kullanıcı>`: Belirtilen kullanıcının kalan mute süresini gösterir.',
      inline: false,
    },
    {
      name: 'Özellikler',
      value:
        '• Susturulan kullanıcının rolleri kaydedilir ve mute bitiminde geri verilir.\n' +
        '• İlk çalıştırmada otomatik `mute` rolü oluşturulur ve kanallar kısıtlanır.\n' +
        '• Susturulanların yazabilmesi için otomatik `#muted-only` kanalı açılır.\n' +
        '• Maksimum mute süresi 1440 dakikadır (24 saat).',
      inline: false,
    },
  ],
};

exports.execute = async (client, message, args) => {
  const guild = message.guild;
  const me = message.member;

  try {
    if (args[0]?.toLowerCase() === 'kaldır') {

      const muteRole = guild.roles.cache.find((r) => r.name === 'mute');
      const muteChannel = guild.channels.cache.find(
        (c) => c.name === 'muted-only',
      );

      if (muteRole) {
        const mutedMembers = guild.members.cache.filter((m) =>
          m.roles.cache.has(muteRole.id),
        );
        for (const member of mutedMembers.values()) {
          const oldRoles = await db.get(`mute_roles_${guild.id}_${member.id}`);
          if (oldRoles) {
            await member.roles.set(oldRoles).catch(() => {});
            await db.delete(`mute_roles_${guild.id}_${member.id}`);
            await db.delete(`mute_end_${guild.id}_${member.id}`);
          }
        }
        await muteRole.delete().catch(() => {});
      }

      if (muteChannel) await muteChannel.delete().catch(() => {});

      return message.channel.send(
        `${emojis.bot.succes} | **${me.displayName}**, mute sistemi başarıyla kaldırıldı~ ✨`,
      );
    }

    if (args[0]?.toLowerCase() === 'süre') {
      const targetArg = args[1];
      const target =
        message.mentions.members.first() ||
        guild.members.cache.get(targetArg) ||
        guild.members.cache.find((m) => m.user.username === targetArg);

      if (!target)
        return message.channel.send(
          `${emojis.bot.error} | **${me.displayName}**, kullanıcı bulunamadı~ owo`,
        );

      const end = await db.get(`mute_end_${guild.id}_${target.id}`);
      if (!end)
        return message.channel.send(
          `${emojis.bot.error} | **${me.displayName}**, ${target.user.tag} muteli değil~ 😢`,
        );

      const now = Date.now();
      if (now >= end)
        return message.channel.send(
          `${emojis.bot.succes} | **${target.user.tag}** kullanıcısının mute süresi bitmiş~ >_<`,
        );

      const timestamp = Math.floor(end / 1000);
      return message.channel.send(
        `${emojis.bot.succes} | **${target.user.tag}** adlı kullanıcının mutesi bitmesine <t:${timestamp}:R> kaldı~ ⏱`,
      );
    }

    let muteRole = guild.roles.cache.find((r) => r.name === 'mute');

    if (!muteRole) {
      muteRole = await guild.roles.create({
        name: 'mute',
        permissions: [],
        reason: 'Otomatik mute rolü oluşturma',
      });

      guild.channels.cache.forEach((c) => {
        if (
          c.name !== 'muted-only' &&
          (c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE')
        ) {
          c.permissionOverwrites
            .edit(muteRole, {
              VIEW_CHANNEL: false,
              SEND_MESSAGES: false,
              ADD_REACTIONS: false,
              SPEAK: false,
              CONNECT: false,
            })
            .catch(() => {});
        }
      });

      await message.channel.send(
        `${emojis.bot.succes} | Mute rolü oluşturuldu ve tüm kanallara izinleri ayarlandı~ ✨`,
      );
    }

    let muteChannel = guild.channels.cache.find((c) => c.name === 'muted-only');
    if (!muteChannel) {
      try {
        muteChannel = await guild.channels.create('muted-only', {
          type: 'GUILD_TEXT',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ['VIEW_CHANNEL'],
            },
            {
              id: muteRole.id,
              allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'],
            },
          ],
          reason: 'Mute kullanıcılar için özel kanal',
        });
        await message.channel
          .send(
            `${emojis.bot.succes} | **muted-only** kanalı oluşturuldu ve izinleri ayarlandı~ ✨`,
          )
          .catch(() => {});
      } catch (err) {
        console.error('Kanal oluşturma hatası:', err);
      }
    }

    const targetArg = args[0];
    const minutes = parseInt(args[1]);
    const member =
      message.mentions.members.first() ||
      guild.members.cache.get(targetArg) ||
      guild.members.cache.find((m) => m.user.username === targetArg);

    if (!member)
      return message.channel.send(
        `${emojis.bot.error} | Susturulacak kullanıcıyı belirt~ owo`,
      );
    if (!minutes || minutes < 1)
      return message.channel.send(
        `${emojis.bot.error} | Lütfen geçerli bir süre (dk) gir~ ⏱`,
      );
    if (minutes > 1440)
      return message.channel.send(
        `${emojis.bot.error} | Maksimum süre 1440 dakikadır~ >_<`,
      );

    const now = Date.now();
    const endTimestamp = now + minutes * 60000;
    const existingEnd = await db.get(`mute_end_${guild.id}_${member.id}`);

    if (existingEnd && now < existingEnd) {
      const timestampLeft = Math.floor(existingEnd / 1000);
      return message.channel.send(
        `${emojis.bot.error} | **${member.user.tag}** zaten muteli~ Mute bitişi: <t:${timestampLeft}:R>~ 😵`,
      );
    }

    const currentRoles = member.roles.cache
      .filter((r) => r.id !== guild.id && r.id !== muteRole.id)
      .map((r) => r.id);

    await db.set(`mute_roles_${guild.id}_${member.id}`, currentRoles);
    await db.set(`mute_end_${guild.id}_${member.id}`, endTimestamp);
    await member.roles.set([muteRole.id]);

    const timestampEnd = Math.floor(endTimestamp / 1000);
    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} Kullanıcı Susturuldu`)
      .setDescription(
        `**${member.user.tag}** susturuldu~ ✨\n**Süre:** ${minutes} dakika (<t:${timestampEnd}:R>)`,
      )
      .setColor('DARK_GREY')
      .setTimestamp();

    message.channel.send({ embeds: [embed] });

    setTimeout(
      async () => {
        const checkEnd = await db.get(`mute_end_${guild.id}_${member.id}`);
        if (checkEnd && Date.now() >= checkEnd) {
          const oldRoles =
            (await db.get(`mute_roles_${guild.id}_${member.id}`)) || [];
          await member.roles.set(oldRoles).catch(() => {});
          await db.delete(`mute_roles_${guild.id}_${member.id}`);
          await db.delete(`mute_end_${guild.id}_${member.id}`);
        }
      },
      minutes * 60000 + 5000,
    );
  } catch (err) {
    console.error('advancedmute hata:', err);
    message.channel.send(
      `${emojis.bot.error} | **${me.displayName}**, komut çalıştırılırken bir hata oluştu~ 😢`,
    );
  }
};
