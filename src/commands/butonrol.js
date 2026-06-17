const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const emojis = require('../emoji.json');

module.exports.execute = async (client, message, args) => {
  if (!args[0]) {
    return message.reply(
      `${emojis.bot.error} | Kullanım: \`butonrol kur @rol ; emoji ; @rol2 ; emoji\` veya \`butonrol sil\``
    );
  }

  const action = args[0].toLowerCase();
  const guildId = message.guild.id;

  if (action === 'kur') {
    const input = args.slice(1).join(' ').split(';');
    if (input.length < 2) {
      return message.reply(`${emojis.bot.error} | En az 1 rol & emoji eşleştirmesi yapmalısın!`);
    }

    const pairs = [];
    for (let i = 0; i < input.length; i += 2) {
      const roleMention = input[i]?.trim();
      const emoji = input[i + 1]?.trim();
      if (!roleMention || !emoji) continue;

      const role = message.mentions.roles.find(
        (r) => r.toString() === roleMention
      );
      if (!role) return message.reply(`${emojis.bot.error} | Rol bulunamadı: ${roleMention}`);

      pairs.push({ roleId: role.id, emoji });
    }

    if (pairs.length === 0)
      return message.reply(`${emojis.bot.error} | Geçerli rol-emoji eşleşmesi bulunamadı.`);

    const embed = new MessageEmbed()
      .setTitle('🎭 Rol Seçim Menüsü')
      .setDescription(
        'Aşağıdaki butonlara basarak istediğiniz rolleri alabilirsiniz.\n\n' +
          pairs.map((p) => `${p.emoji} → <@&${p.roleId}>`).join('\n')
      )
      .setColor('#5865F2');

    const row = new MessageActionRow();
    pairs.forEach((p, idx) => {
      row.addComponents(
        new MessageButton()
          .setCustomId(`butonrol_${p.roleId}`)
          .setLabel(' ')
          .setEmoji(p.emoji)
          .setStyle('SECONDARY')
      );
    });

    const sent = await message.channel.send({
      embeds: [embed],
      components: [row],
    });
    await db.set(`butonrol_${guildId}`, {
      channelId: sent.channel.id,
      messageId: sent.id,
      pairs,
    });

    return message.reply(`${emojis.bot.succes} | Buton rol sistemi kuruldu!`);
  }

  if (action === 'sil') {
    const data = await db.get(`butonrol_${guildId}`);
    if (!data) return message.reply(`${emojis.bot.error} | Zaten kurulmamış.`);

    try {
      const ch = await message.guild.channels.fetch(data.channelId);
      const msg = await ch.messages.fetch(data.messageId);
      await msg.delete().catch(() => {});
    } catch {}

    await db.delete(`butonrol_${guildId}`);
    return message.reply(`${emojis.bot.succes} | Buton rol mesajı silindi.`);
  }
};

module.exports.help = {
  name: 'butonrol',
  description: 'Emoji ile rol alma sistemi kurar',
  usage: 'butonrol kur @rol ; 😀 ; @rol2 ; 🔥 | butonrol sil',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MANAGE_ROLES'],
};
