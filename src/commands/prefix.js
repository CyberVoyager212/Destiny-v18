const emojis = require("../emoji.json");

exports.help = {
  name: "prefix",
  aliases: [],
  usage: "prefix <yeni prefix>",
  description: "Sunucu için prefix ayarlar veya mevcut prefixi gösterir.",
  category: "Araçlar",
  cooldown: 10,
  permissions: ["MANAGE_GUILD"],
};

exports.execute = async (client, message, args) => {
  try {
    const guildId = message.guild.id;
    const db = client.db;

    const currentPrefix =
      (await db.get(`prefix_${guildId}`)) || client.config.prefix;

    const newPrefix = args[0];

    if (!newPrefix) {
      return message.channel.send(
        `ℹ️ | **${message.member.displayName}**, mevcut prefix: \`${currentPrefix}\`\n✨ | Yeni prefix ayarlamak için: \`${currentPrefix}prefix <yeni prefix>\``
      );
    }

    if (newPrefix.length > 5) {
      return message.channel.send(
        `⏱ | **${message.member.displayName}**, wow~ prefix çok uzun! En fazla 5 karakter olabilir :c`
      );
    }

    await db.set(`prefix_${guildId}`, newPrefix);
    client.config.prefix = newPrefix;

    return message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, prefix başarıyla \`${newPrefix}\` olarak ayarlandı! Hadi kullanmaya başla ✨`
    );
  } catch (error) {
    console.error(error);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, bir şeyler ters gitti~ 😢 Prefix ayarlanamadı!`
    );
  }
};
