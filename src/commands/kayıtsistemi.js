const emojis = require('../emoji.json');

exports.execute = async (client, message, args) => {
  try {
    const subCommand = args[0]?.toLowerCase();

    if (!subCommand || !['kur', 'sil', 'otoisim'].includes(subCommand)) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, geçersiz alt komut girdin! Kullanılabilir: \`kur\`, \`sil\`, \`otoisim\`.\nÖrnek: \`kayıtsistemi kur cinsiyet\``,
      );
    }

    if (subCommand === 'kur') {
      const mode = args[1]?.toLowerCase();
      if (!['cinsiyet', 'normal'].includes(mode)) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, kurulum modu eksik veya hatalı! \`cinsiyet\` veya \`normal\` seçmelisin~`,
        );
      }

      const parts = args
        .slice(2)
        .join(' ')
        .split(',')
        .map((s) => s.trim());
      let [
        kayitsizRolName,
        yetkiliRolName,
        kayitsizKanalName,
        maleRolName,
        femaleRolName,
      ] = [
        parts[0] || 'Kayıtsız',
        parts[1] || 'Yetkili',
        parts[2] || 'kayıtsızlar',
        parts[3] || 'Erkek',
        parts[4] || 'Kadın',
      ];

      const startTime = Date.now();

      let kayitsizRol =
        message.guild.roles.cache.find((r) => r.name === kayitsizRolName) ||
        (await message.guild.roles.create({
          name: kayitsizRolName,
          color: '#808080',
          permissions: [],
        }));

      let yetkiliRol =
        message.guild.roles.cache.find((r) => r.name === yetkiliRolName) ||
        (await message.guild.roles.create({
          name: yetkiliRolName,
          color: '#0000FF',
          permissions: [
            'MANAGE_ROLES',
            'MANAGE_CHANNELS',
            'KICK_MEMBERS',
            'BAN_MEMBERS',
          ],
        }));

      let kayitsizKanal =
        message.guild.channels.cache.find(
          (c) => c.name === kayitsizKanalName,
        ) ||
        (await message.guild.channels.create(kayitsizKanalName, {
          type: 'GUILD_TEXT',
          permissionOverwrites: [
            { id: message.guild.id, deny: ['VIEW_CHANNEL'] },
            { id: kayitsizRol.id, allow: ['VIEW_CHANNEL'] },
            { id: yetkiliRol.id, allow: ['VIEW_CHANNEL'] },
          ],
        }));

      const feedbackMessage = await message.channel.send(
        `⏳ **Kayıtsız rolü izinleri güncelleniyor...**`,
      );

      for (const ch of message.guild.channels.cache.values()) {
        if (ch.id !== kayitsizKanal.id) {
          await ch.permissionOverwrites
            .edit(kayitsizRol, { VIEW_CHANNEL: false })
            .catch(() => {});
        }
      }

      let maleRol = null;
      let femaleRol = null;
      if (mode === 'cinsiyet') {
        maleRol =
          message.guild.roles.cache.find((r) => r.name === maleRolName) ||
          (await message.guild.roles.create({
            name: maleRolName,
            color: '#3498db',
            permissions: [],
          }));

        femaleRol =
          message.guild.roles.cache.find((r) => r.name === femaleRolName) ||
          (await message.guild.roles.create({
            name: femaleRolName,
            color: '#e91e63',
            permissions: [],
          }));
      }

      await client.db.set(`kayitsizRol_${message.guild.id}`, kayitsizRol.id);
      await client.db.set(
        `kayitsizKanal_${message.guild.id}`,
        kayitsizKanal.id,
      );
      await client.db.set(`yetkiliRol_${message.guild.id}`, yetkiliRol.id);

      if (mode === 'cinsiyet') {
        await client.db.set(`maleRol_${message.guild.id}`, maleRol.id);
        await client.db.set(`femaleRol_${message.guild.id}`, femaleRol.id);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      return feedbackMessage.edit(
        `${emojis.bot.succes} | **Kayıt Sistemi (${mode.toUpperCase()}) Başarıyla Kuruldu!** 🎉\n` +
          `👤 Kayıtsız Rol: ${kayitsizRol.name}\n` +
          `🔧 Yetkili Rol: ${yetkiliRol.name}\n` +
          `📢 Kanal: ${kayitsizKanal.name}\n` +
          (mode === 'cinsiyet'
            ? `🚹 Erkek Rol: ${maleRol.name}\n🚺 Kadın Rol: ${femaleRol.name}\n`
            : '') +
          `🕒 Süre: ${duration} saniye\n👤 Komutu kullanan: ${message.member.displayName}`,
      );
    } else if (subCommand === 'sil') {
      const guildId = message.guild.id;

      const kayitsizRolID = await client.db.get(`kayitsizRol_${guildId}`);
      const kayitsizKanalID = await client.db.get(`kayitsizKanal_${guildId}`);
      const yetkiliRolID = await client.db.get(`yetkiliRol_${guildId}`);
      const maleRolID = await client.db.get(`maleRol_${guildId}`);
      const femaleRolID = await client.db.get(`femaleRol_${guildId}`);
      const otoIsim = await client.db.get(`autoName_${guildId}`);

      if (!kayitsizRolID && !kayitsizKanalID && !yetkiliRolID && !otoIsim) {
        return message.reply(
          `${emojis.bot.error} | **Kayıt sistemi zaten kurulu değil~**`,
        );
      }

      let kayitsizRolName = 'Kayıtsız';
      let kayitsizKanalName = 'kayıtsızlar';
      let yetkiliRolName = 'Yetkili';
      let maleRolName = 'Erkek';
      let femaleRolName = 'Kadın';

      if (kayitsizRolID) {
        const r = message.guild.roles.cache.get(kayitsizRolID);
        if (r) {
          kayitsizRolName = r.name;
          await r.delete().catch(() => {});
        }
        await client.db.delete(`kayitsizRol_${guildId}`);
      }

      if (kayitsizKanalID) {
        const c = message.guild.channels.cache.get(kayitsizKanalID);
        if (c) {
          kayitsizKanalName = c.name;
          await c.delete().catch(() => {});
        }
        await client.db.delete(`kayitsizKanal_${guildId}`);
      }

      if (yetkiliRolID) {
        const r = message.guild.roles.cache.get(yetkiliRolID);
        if (r) {
          yetkiliRolName = r.name;
          await r.delete().catch(() => {});
        }
        await client.db.delete(`yetkiliRol_${guildId}`);
      }

      if (maleRolID) {
        const r = message.guild.roles.cache.get(maleRolID);
        if (r) {
          maleRolName = r.name;
          await r.delete().catch(() => {});
        }
        await client.db.delete(`maleRol_${guildId}`);
      }

      if (femaleRolID) {
        const r = message.guild.roles.cache.get(femaleRolID);
        if (r) {
          femaleRolName = r.name;
          await r.delete().catch(() => {});
        }
        await client.db.delete(`femaleRol_${guildId}`);
      }

      if (otoIsim) {
        await client.db.delete(`autoName_${guildId}`);
      }

      let mesaj =
        `${emojis.bot.succes} | **Kayıt sistemi başarıyla sıfırlandı!**\n` +
        `👤 Komutu kullanan: ${message.member.displayName}\n` +
        `👥 Silinen Rol: ${kayitsizRolName}\n` +
        `📢 Silinen Kanal: ${kayitsizKanalName}\n` +
        `🔧 Yetkili Rol: ${yetkiliRolName}`;

      if (maleRolID || femaleRolID) {
        mesaj += `\n🚹 Erkek Rol: ${maleRolName}\n🚺 Kadın Rol: ${femaleRolName}`;
      }

      if (otoIsim) {
        mesaj += `\n📝 Oto İsim: Aktifti ve kaldırıldı.`;
      }

      return message.channel.send(mesaj);
    } else if (subCommand === 'otoisim') {
      const defaultName = args.slice(1).join(' ');
      if (!defaultName) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, geçerli bir varsayılan isim belirtmelisin~\nÖrnek: \`kayıtsistemi otoisim YeniÜye\``,
        );
      }

      client.db.set(`autoName_${message.guild.id}`, defaultName);
      return message.channel.send(
        `${emojis.bot.succes} | **Otomatik isim başarıyla ayarlandı!**\n📌 Komutu kullanan: ${message.member.displayName}\n👤 Yeni varsayılan isim: ${defaultName}`,
      );
    }
  } catch (err) {
    console.error(err);
    if (err.message.includes('Missing Permissions')) {
      return message.reply(
        `${emojis.bot.error} | Botun gerekli yetkileri yok!`,
      );
    }
    return message.reply(
      `${emojis.bot.error} | Bir hata oluştu, lütfen tekrar dene :c`,
    );
  }
};

exports.help = {
  name: 'kayıtsistemi',
  aliases: ['ks'],
  usage:
    'kayıtsistemi kur <normal|cinsiyet> [Kayıtsız,Yetkili,Kanal[,Erkek,Kadın]]\n' +
    'kayıtsistemi sil\n' +
    'kayıtsistemi otoisim <varsayılan isim>',
  description: 'Kayıt sistemi kurar, siler veya otomatik isim ayarlar.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['ADMINISTRATOR'],
};
