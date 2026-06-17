const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'kanalyönet',
  aliases: ['kyönet'],
  usage:
    'kanalyönet help\n' +
    'kanalyönet <#kanal|id|isim> <izin> <@rol|rolID> [@rol2]...\n\n' +
    '**izin**: view, send, manage\n' +
    'Örnek: kanalyönet #genel view @ÜyeRol send @ModRol',
  description:
    'Belirtilen kanalda rollerin izinlerini ayarlar. `help` ile kullanım bilgisi alırsınız.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MANAGE_CHANNELS'],
};

exports.execute = async (client, message, args) => {
  if (args[0] === 'help')
    return message.channel.send({
      embeds: [
        new MessageEmbed()
          .setTitle('📖 | Kanalyönet Komutu Yardımı')
          .setDescription(this.help.usage)
          .setColor('#00AAFF')
          .setFooter({
            text: `İstediğini bulamadıysan tekrar dene ~ ${message.member.displayName}`,
          }),
      ],
    });

  const [target, izin, ...roles] = args;
  if (!target || !izin || !roles.length)
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, doğru kullanım yapmadın~ Lütfen \`kanalyönet help\` komutuna bak :3`,
    );

  const kanal =
    message.mentions.channels.first() ||
    message.guild.channels.cache.get(target) ||
    message.guild.channels.cache.find((c) => c.name === target);
  if (!kanal)
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, aradığın kanalı bulamadım... belki de hayal ürünü olabilir >~<`,
    );

  const permMap = {
    view: 'VIEW_CHANNEL',
    send: 'SEND_MESSAGES',
    manage: 'MANAGE_CHANNEL',
  };
  const discordPerm = permMap[izin.toLowerCase()];
  if (!discordPerm)
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, girdiğin izin türü geçersiz... sadece \`view\`, \`send\` ve \`manage\` kullanabilirsin~`,
    );

  const ok = [];
  const failed = [];
  for (const r of roles) {
    const rol =
      message.mentions.roles.find((x) => x.id === x.id) ||
      message.guild.roles.cache.get(r) ||
      message.guild.roles.cache.find((x) => x.name === r);
    if (!rol) {
      failed.push(r);
      continue;
    }
    try {
      await kanal.permissionOverwrites.edit(rol, {
        [discordPerm]: true,
      });
      ok.push(rol.name);
    } catch {
      failed.push(rol.name);
    }
  }

  const embed = new MessageEmbed()
    .setTitle(`🔧 | Kanal Yönetimi: ${kanal.name}`)
    .addField(
      `${emojis.bot.succes} Başarılı`,
      ok.length > 0 ? ok.join(', ') : '–',
    )
    .addField(
      `${emojis.bot.error} Hatalı`,
      failed.length > 0
        ? `${failed.join(
            ', ',
          )}\n\n**${message.member.displayName}**, sanırım burada ufak bir hata yaptın... lütfen tekrar dene >_<`
        : '–',
    )
    .setColor(ok.length > 0 ? '#57F287' : '#ED4245')
    .setTimestamp()
    .setFooter({
      text: `İşlem yapan: ${message.member.displayName}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
    });

  message.channel.send({ embeds: [embed] });
};
