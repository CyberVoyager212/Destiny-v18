const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'purge',
  aliases: ['temizle'],
  usage: 'purge <@kullanıcı|kelime> ; [#kanal|all]',
  description:
    'Belirtilen kullanıcının veya kelime içeren mesajları belirtilen kanal(lar)da veya tüm sunucuda toplu siler.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MANAGE_MESSAGES'],
};

exports.execute = async (client, message, args) => {
  if (!args.length) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, lütfen silinecek kullanıcıyı veya kelimeyi gir! Örnek: \`purge @user ; #kanal\` veya \`purge kelime ; all\``,
    );
  }

  try {
    try {
      await message.delete().catch(() => {});
    } catch (errDelMsg) {}

    try {
      const recent = await message.channel.messages.fetch({ limit: 50 });
      const botRelated = recent.filter((m) => {
        if (m.author?.id !== client.user.id) return false;
        if (m.reference && m.reference.messageId === message.id) return true;
        const joinedArgs = args.join(' ').toLowerCase();
        if (
          joinedArgs &&
          m.content &&
          m.content.toLowerCase().includes(joinedArgs)
        )
          return true;
        if (Date.now() - m.createdTimestamp < 30_000) return true;
        return false;
      });

      for (const [, bm] of botRelated) {
        try {
          await bm.delete().catch(() => {});
        } catch {}
      }
    } catch (errBotClean) {}

    const fullArgs = args.join(' ').split(';');
    const searchTerm = (fullArgs[0] || '').trim();
    const targetPart = (fullArgs[1] || '').trim().toLowerCase();

    if (!searchTerm) {
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, arama terimi boş olamaz~ :c`,
      );
    }

    const user =
      message.mentions.users.first() ||
      client.users.cache.get(searchTerm) ||
      message.guild.members.cache.find(
        (m) => m.user.username.toLowerCase() === searchTerm.toLowerCase(),
      )?.user;

    let targetChannels;
    if (targetPart === 'all') {
      targetChannels = message.guild.channels.cache.filter(
        (ch) => ch.type === 'GUILD_TEXT',
      );
    } else if (message.mentions.channels.size > 0) {
      targetChannels = message.mentions.channels;
    } else {
      targetChannels = new Map([[message.channel.id, message.channel]]);
    }

    let totalDeleted = 0;
    const errorChannels = [];

    for (const channel of Array.from(targetChannels.values())) {
      try {
        const fetched = await channel.messages.fetch({ limit: 100 });
        let toDelete;
        if (user) {
          toDelete = fetched.filter((m) => m.author.id === user.id);
        } else {
          const term = searchTerm.toLowerCase();
          toDelete = fetched.filter((m) =>
            m.content ? m.content.toLowerCase().includes(term) : false,
          );
        }

        toDelete = toDelete.filter((m) => m.author.id !== client.user.id);

        if (toDelete.size > 0) {
          const deleted = await channel.bulkDelete(toDelete, true);
          totalDeleted += (deleted && deleted.size) || 0;
        }
      } catch (err) {
        console.error(`[Purge] ${channel.name || channel.id} hata:`, err);
        errorChannels.push(channel.name || channel.id);
      }
    }

    if (totalDeleted === 0) {
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, silinecek uygun mesaj bulunamadı~ belki çok eski veya zaten temizlenmişler :c`,
      );
    }

    const successMsg = await message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, başarıyla toplam **${totalDeleted}** mesaj temizlendi! ✨`,
    );
    setTimeout(() => successMsg.delete().catch(() => {}), 5000);

    if (errorChannels.length) {
      message.channel.send(
        `${emojis.bot.error} | Bazı kanallarda silme sırasında hata oluştu: ${errorChannels
          .map((n) => `\`${n}\``)
          .join(', ')}. Bunları manuel kontrol et lütfen~`,
      );
    }
  } catch (err) {
    console.error('Purge komutu genel hata:', err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, uf! Bir sorun çıktı ve işlem tamamlanamadı... lütfen sonra tekrar dene~ :c`,
    );
  }
};
