const emojis = require("../emoji.json");

module.exports.help = {
  name: "tura",
  aliases: [],
  usage: "tura <bahismiktarı>",
  description: "Tura bahsi atar, tura gelirse kazanırsın.",
  category: "Ekonomi",
  cooldown: 5,
};

module.exports.execute = async (client, message, args) => {
  const db = client.db;
  const userId = message.author.id;

  try {
    const betAmount = parseInt(args[0]);
    if (!betAmount || betAmount <= 0)
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen bahis miktarını doğru gir~ qwq`
      );

    const balanceKey = `money_${userId}`;
    let balance = (await db.get(balanceKey)) || 0;

    if (balance < betAmount)
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, yeterli paran yok~ 😢\n> Şu an toplam paran: ${balance}`
      );

    const spinner = emojis.coinflip.spinner;
    const msg = await message.channel.send(
      `${spinner} | **${message.member.displayName}**, para fırlatılıyor~ 🥺💫`
    );

    const isTura = Math.random() < 0.5; 

    setTimeout(async () => {
      if (isTura) {
        const winnings = betAmount * 2;
        balance += winnings;
        await db.set(balanceKey, balance);

        msg.edit(
          `${emojis.bot.succes} | **${message.member.displayName}**, tura geldi! ✨\n` +
            `${emojis.coinflip.tails} Sonuç: **Tura**\n> Bahsin: ${betAmount} → Kazancın: ${winnings}\n> Toplam paran: ${balance}`
        );
      } else {
        balance -= betAmount;
        await db.set(balanceKey, balance);

        msg.edit(
          `${emojis.bot.error} | **${message.member.displayName}**, tura gelmedi... 😢\n` +
            `${emojis.coinflip.heads} Sonuç: **Yazı**\n> Kaybettiğin bahis: ${betAmount}\n> Kalan paran: ${balance}`
        );
      }
    }, 4000);
  } catch (err) {
    console.error("tura hatası:", err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, bir şeyler ters gitti qwq~\n> Hata: \`${err?.message || "Bilinmeyen hata"}\``
    );
  }
};
