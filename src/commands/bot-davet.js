const emojis = require("../emoji.json");

exports.execute = async (client, message, args) => {
  try {
    const botId = client.user.id;
    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${botId}&permissions=8&scope=bot`;

    return message.reply(
      `${emojis.bot.succes} | Tebrikler! Botu sunucuna davet etmek için aşağıdaki linke tıkla ✨\n🔗 [Davet Et](${inviteLink})`
    );
  } catch (error) {
    console.error("Davet hatası:", error);
    return message.reply(
      `${emojis.bot.error} | Oops! Davet linki oluşturulurken bir sorun çıktı 😵 Lütfen daha sonra tekrar dene~`
    );
  }
};

exports.help = {
  name: "bot-davet",
  aliases: ["davet"],
  usage: "bot-davet",
  description: "Botun davet linkini anime stili mesajlarla gönderir.",
  category: "Bot",
  cooldown: 10,
};
