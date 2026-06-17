function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const emojis = require("../emoji.json");

exports.help = {
  name: "bal",
  aliases: ["para", "bakiye"],
  usage: "bal [@kullanıcı]",
  description: "Kullanıcının bakiyesini gösterir ve sıralamadaki yerini verir.",
  category: "Ekonomi",
  cooldown: 5,
};

exports.execute = async (client, message, args) => {
  const db = client.db;
  const user = message.mentions.users.first() || message.author;

  try {
    const balance = await client.eco.fetchMoney(user.id);

    let balanceEmoji = emojis.money.low;
    if (balance > 100000) balanceEmoji = emojis.money.high;
    else if (balance > 10000) balanceEmoji = emojis.money.medium;

    const allEntries = await db.all();
    const moneyEntries = allEntries
      .filter((e) => e.id.startsWith("money_"))
      .map((e) => ({ id: e.id.split("_")[1], bal: Number(e.value) }));

    moneyEntries.sort((a, b) => b.bal - a.bal);
    const position = moneyEntries.findIndex((e) => e.id === user.id) + 1 || "?";

    const formattedBalance = formatNumber(balance);

    return message.channel.send(
      ` 💰 **Bakiye Bilgisi**\n` +
        `📌 **Kullanıcı:** <@${user.id}>\n` +
        `💳 **Bakiye:** \`${formattedBalance}\` ${balanceEmoji}\n` +
        `🏆 **Sıralama:** \`${position}\``
    );
  } catch (error) {
    console.error(error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, bakiye alınırken bir hata oluştu~ Lütfen biraz sabırlı ol ve tekrar dene :c`
    );
  }
};
