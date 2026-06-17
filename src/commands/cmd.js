const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');
const botConfig = require('../botConfig.js');

module.exports.help = {
  name: 'bakım',
  aliases: ['bakim', 'cmd', 'komut'],
  description:
    'Botun global bakım durumunu, yapay zekayı ve global komut durumlarını yönetmeye yarar.',
  usage: 'bakım <durum | ai | bot | komut> ...',
  category: 'Bot',
  admin: true,
};

module.exports.execute = async (client, message, args) => {
  const db = client.db;

  const prefix =
    (await db.get(`prefix_${message.guild.id}`)) ||
    (client.config && client.config.prefix) ||
    '!';
  const ilkArg = args[0]?.toLowerCase();
  const legacyKomutYonetimi = ['aç', 'kapat', 'list', 'liste'].includes(ilkArg);
  const kategori = legacyKomutYonetimi ? 'komut' : ilkArg;
  const islem = legacyKomutYonetimi ? ilkArg : args[1]?.toLowerCase();
  const komutArgIndex = legacyKomutYonetimi ? 1 : 2;

  if (!kategori) {
    return message.channel.send(
      `${emojis.bot.error} | Kullanım: \`${prefix}bakım durum\`, \`${prefix}bakım ai aç\`, \`${prefix}bakım bot kapat\` veya \`${prefix}bakım komut kapat help\``,
    );
  }

  if (kategori === 'durum') {
    const botKapali = Boolean(await db.get('bakim_botKapali'));
    const aiKapali = Boolean(await db.get('bakim_aiKapali'));
    const allRows = await db.all();
    const kapaliKomutlar = allRows
      .filter((row) => row.id.startsWith('kapaliKomut_'))
      .map((row) => row.id.replace('kapaliKomut_', ''));

    const embed = new MessageEmbed()
      .setTitle('🛠️ Bakım Durumu')
      .setColor(botKapali || aiKapali ? 'ORANGE' : 'GREEN')
      .addField('Bot Durumu', botKapali ? 'Kapalı' : 'Açık', true)
      .addField('Yapay Zeka', aiKapali ? 'Kapalı' : 'Açık', true)
      .addField(
        'Kapalı Komutlar',
        kapaliKomutlar.length
          ? kapaliKomutlar.map((c) => `\`${c}\``).join(', ')
          : 'Yok',
      )
      .setFooter({ text: `${client.user.username} - Bakım Yönetimi` });

    return message.channel.send({ embeds: [embed] });
  }

  if (kategori === 'ai') {
    if (!['aç', 'kapat'].includes(islem)) {
      return message.channel.send(
        `${emojis.bot.error} | Kullanım: \`${prefix}bakım ai aç\` veya \`${prefix}bakım ai kapat\``,
      );
    }

    if (islem === 'kapat') {
      await db.set('bakim_aiKapali', true);
      return message.channel.send(
        `${emojis.bot.succes} | Yapay zeka sistemi kapatıldı. Artık AI cevapları verilmeyecek.`,
      );
    }

    await db.delete('bakim_aiKapali');
    return message.channel.send(
      `${emojis.bot.succes} | Yapay zeka sistemi yeniden aktif edildi.`,
    );
  }

  if (kategori === 'bot') {
    if (!['aç', 'kapat'].includes(islem)) {
      return message.channel.send(
        `${emojis.bot.error} | Kullanım: \`${prefix}bakım bot aç\` veya \`${prefix}bakım bot kapat\``,
      );
    }

    if (islem === 'kapat') {
      await db.set('bakim_botKapali', true);
      return message.channel.send(
        `${emojis.bot.succes} | Bot kullanıcı mesajlarına kapatıldı. Bundan sonra sadece owner ve admins mesajları işlenecek.`,
      );
    }

    await db.delete('bakim_botKapali');
    return message.channel.send(
      `${emojis.bot.succes} | Bot yeniden tüm kullanıcılara açıldı.`,
    );
  }

  if (kategori !== 'komut') {
    return message.channel.send(
      `${emojis.bot.error} | Geçersiz bakım alanı. Kullanılabilir alanlar: \`durum\`, \`ai\`, \`bot\`, \`komut\``,
    );
  }

  if (islem === 'list' || islem === 'liste') {
    const allRows = await db.all();
    const kapaliKomutlar = allRows
      .filter((row) => row.id.startsWith('kapaliKomut_'))
      .map((row) => row.id.replace('kapaliKomut_', ''));

    if (kapaliKomutlar.length === 0) {
      return message.channel.send(
        `${emojis.bot.succes} | Şu anda kapalı olan hiçbir komut bulunmuyor.`,
      );
    }

    const embed = new MessageEmbed()
      .setTitle('🚫 Kapalı Komutlar Listesi')
      .setDescription(kapaliKomutlar.map((c) => `• \`${c}\``).join('\n'))
      .setColor('RED')
      .setFooter({ text: `${client.user.username} - Komut Yönetimi` });

    return message.channel.send({ embeds: [embed] });
  }

  const girdiKomutAdi = args[komutArgIndex]?.toLowerCase();

  if (!islem || !['aç', 'kapat'].includes(islem)) {
    return message.channel.send(
      `${emojis.bot.error} | Hatalı kullanım! Örnek: \`${prefix}bakım komut kapat help\`, \`${prefix}bakım komut aç help\` veya \`${prefix}bakım komut list\``,
    );
  }

  if (!girdiKomutAdi) {
    return message.channel.send(
      `${emojis.bot.error} | Lütfen işlem yapmak istediğin komutun adını yaz!`,
    );
  }

  let hedefKomut = null;
  client.commands.forEach((cmd, origName) => {
    if (origName.toLowerCase() === girdiKomutAdi) hedefKomut = cmd;
    const aliases = cmd.help?.aliases || [];
    if (
      Array.isArray(aliases) &&
      aliases.map((a) => a.toLowerCase()).includes(girdiKomutAdi)
    ) {
      hedefKomut = cmd;
    }
  });

  if (!hedefKomut || !hedefKomut.help) {
    return message.channel.send(
      `${emojis.bot.error} | Bot sisteminde \`${girdiKomutAdi}\` adında bir komut bulunamadı!`,
    );
  }

  const anaKomutAdi = hedefKomut.help.name.toLowerCase();
  const aliasListesi = hedefKomut.help.aliases || [];

  if (islem === 'kapat') {
    if (anaKomutAdi === 'bakım') {
      return message.channel.send(
        `${emojis.bot.error} | Yönetim komutunu kapatamazsınız!`,
      );
    }

    await db.set(`kapaliKomut_${anaKomutAdi}`, true);
    for (const alias of aliasListesi) {
      await db.set(`kapaliKomut_${alias.toLowerCase()}`, true);
    }

    return message.channel.send(
      `${emojis.bot.succes} | **${anaKomutAdi}** komutu ve takma adları **kapatıldı**.`,
    );
  }

  await db.delete(`kapaliKomut_${anaKomutAdi}`);
  for (const alias of aliasListesi) {
    await db.delete(`kapaliKomut_${alias.toLowerCase()}`);
  }

  return message.channel.send(
    `${emojis.bot.succes} | **${anaKomutAdi}** komutu yeniden **aktif edildi**.`,
  );
};
