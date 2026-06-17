const emojis = require("../emoji.json");
const vipAd = require("../utils/vipAd");

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

function chooseAmountEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

function chooseTotalEmoji(total) {
  if (total > 500000) return emojis.money.high;
  if (total > 50000) return emojis.money.medium;
  return emojis.money.low;
}

exports.execute = async (client, message, args) => {
  const db = client.db;
  const userId = message.author.id;
  const isVip = !!(await db.get(`vips.${userId}`));
  const moneyKey = `money_${userId}`;
  const lastWeeklyKey = `lastWeekly_${userId}`;
  const weeklyStreakKey = `weeklyStreak_${userId}`;

  try {
    const now = Date.now();
    const lastWeekly = (await db.get(lastWeeklyKey)) || 0;
    let currentStreak = (await db.get(weeklyStreakKey)) || 0;

    if (lastWeekly && now - lastWeekly > ONE_WEEK) {
      currentStreak = 0;
    }

    const newStreak = currentStreak + 1;

    const baseAmount = isVip
      ? Math.floor(Math.random() * 2000) + 1500
      : Math.floor(Math.random() * 1000) + 500;
    const streakBonus = isVip
      ? (newStreak - 1) * 500
      : (newStreak - 1) * 250;
    const totalGain = baseAmount + streakBonus;

    const currentMoney = (await db.get(moneyKey)) || 0;
    const newMoney = currentMoney + totalGain;

    await db.set(moneyKey, newMoney);
    await db.set(lastWeeklyKey, now);
    await db.set(weeklyStreakKey, newStreak);

    const amountEmoji = chooseAmountEmoji(totalGain);
    const totalEmoji = chooseTotalEmoji(newMoney);

    let streakText = newStreak > 1 
      ? `\n🔥 **Haftalık Seri:** \`${newStreak}\`. hafta! (Bonus: +${streakBonus})` 
      : `\n✨ Yeni bir haftalık seriye başladın!`;

    if (isVip) {
      return message.channel.send(
        `👑 **[VIP]** | Harika, sevgili **${message.member.displayName}**! Değerli VIP üyemizin haftalık kredisi hazırlandı~ 👑✨\n` +
        `> Aldığın VIP Kredi: **${totalGain}** ${amountEmoji}\n` +
        `> Toplam Yeni Bakiyen: **${newMoney}** ${totalEmoji}` +
        `${streakText}\n*Desteğin bizim için paha biçilemez!* 💖`
      );
    } else {
      vipAd.sendAd(message);
      return message.channel.send(
        `${emojis.bot.succes} | **${message.member.displayName}**, haftalık kredin başarıyla verildi~ ✨\n` +
        `> Aldığın miktar: **${totalGain}** ${amountEmoji}\n` +
        `> Şu an toplam paran: **${newMoney}** ${totalEmoji}` +
        `${streakText}`
      );
    }
  } catch (err) {
    console.error("weekly hata:", err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, ödül verilirken bir şeyler ters gitti qwq~ \n> Hata: \`${err?.message || "Bilinmeyen hata"}\``
    );
  }
};

exports.help = {
  name: "weekly",
  aliases: ["haftalık"],
  usage: "weekly",
  description: "Haftalık ödülünüzü almanızı sağlar (Seri bonusu içerir).",
  category: "Ekonomi",
  cooldown: 604800 
};
