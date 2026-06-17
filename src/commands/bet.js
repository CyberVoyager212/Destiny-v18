const ms = require("ms");
const emojis = require("../emoji.json");  

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

module.exports.execute = async (client, message, args) => {
  try {
    const userId = message.author.id;
    let money = (await client.db.get(`money_${userId}`)) || 0;

    let betAmount;
    if (args[0] === "all") {
      betAmount = Math.min(money, 250000);
    } else {
      betAmount = parseInt(args[0]);
    }

    if (isNaN(betAmount) || betAmount <= 0) {
      return message.reply(`${emojis.bot.error} | **${message.member.displayName}**, lütfen geçerli bir bahis miktarı gir, yoksa top seni çarpar!`);
    }

    betAmount = Math.min(betAmount, 250000);

    if (money < betAmount) {
      return message.reply(`${emojis.bot.error} | Üzgünüm **${message.member.displayName}**, paran yetmiyor! Şu an **${money}** ${chooseEmoji(money)} paran var.`);
    }

    let colorChoice = args[1]?.toLowerCase();
    if (!["kırmızı", "beyaz", "siyah"].includes(colorChoice)) {
      return message.reply(`${emojis.bot.error} | **${message.member.displayName}**, sadece \`kırmızı\`, \`beyaz\` veya \`siyah\` renklerinden birini seçebilirsin~`);
    }

    const bettingMessage = await message.reply(
      `${emojis.bot.succes} | Bahis başlatıldı! **${betAmount}** ${chooseEmoji(betAmount)} yatırdın ve **${colorChoice}** topuna bahis yaptın!`
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const colors = ["🔴","⚪","🔴","⚪","🔴","⚪","🔴","⚫","🔴","⚪","🔴","⚪","🔴","⚪"];
    let currentColors = [...colors];
    let animationSteps = Math.floor(Math.random() * 40) + 1;

    for (let i = 0; i < animationSteps; i++) {
      const lastBall = currentColors.pop();
      currentColors.unshift(lastBall);

      const updatedMessage = `${emojis.bot.succes} | Döndürülüyor... **${betAmount}** ${chooseEmoji(betAmount)} bahis oynandı ve ${colorChoice} topuna bakılıyor...
${currentColors.join(" ")}
⬆️
**Beyaz=2x | Kırmızı=2x | Siyah=3x**`;

      await bettingMessage.edit(updatedMessage);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let firstBall = currentColors[0];
    let multiplier = 0;
    let resultMessage = "";

    if (firstBall === "⚪" && colorChoice === "beyaz") {
      multiplier = 2;
      resultMessage = `⚪ | **Woohoo! ${message.member.displayName}**, beyaz top geldi! Kazancın **2 katı**! ${emojis.bot.succes}`;
    } else if (firstBall === "🔴" && colorChoice === "kırmızı") {
      multiplier = 2;
      resultMessage = `🔴 | **Yatta! ${message.member.displayName}**, kırmızı top geldi! Kazancın **2 katı**! ${emojis.bot.succes}`;
    } else if (firstBall === "⚫" && colorChoice === "siyah") {
      multiplier = 3;
      resultMessage = `⚫ | **Sugoi! ${message.member.displayName}**, siyah top geldi! Kazancın **3 katı**! ${emojis.bot.succes}`;
    } else {
      multiplier = 0;
      resultMessage = `💔 | Ahhh, **${message.member.displayName}**, top **${firstBall}** geldi ve kaybettin... Daha şanslı ol~ ${emojis.bot.error}`;
    }

    let winnings = betAmount * multiplier;

    if (multiplier > 0) {
      money += winnings;
    } else {
      money -= betAmount;
      if (money < 0) money = 0;
    }

    await client.db.set(`money_${userId}`, money);

    resultMessage += `\n💰 | Şu an toplam paran: **${money}** ${chooseEmoji(money)}`;

    await message.channel.send(resultMessage);

  } catch (error) {
    console.error("Bet komutu hatası:", error);
    return message.reply(`${emojis.bot.error} | ⏱ | **${message.member.displayName}**, bir sorun oluştu~ Lütfen biraz yavaş ol :c`);
  }
};

exports.help = {
  name: "bet",
  aliases: [],
  usage: "bet <miktar> <renk> veya bet all <renk>",
  description: "Bahis yapmak için kullanılır. `<miktar>` ile belirli bir miktarda bahis yapılabilir veya `bet all` ile tüm bakiye ile bahis yapılır. Renkler: kırmızı, beyaz, siyah.",
  category: "Ekonomi",
  cooldown: 5,
};
