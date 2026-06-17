const emojis = require('../emoji.json');
const vipAd = require('../utils/vipAd');

const ONE_DAY = 24 * 60 * 60 * 1000;

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

module.exports.execute = async (client, message, args) => {
  try {
    const userId = message.author.id;
    const isVip = !!(await client.db.get(`vips.${userId}`));
    const moneyKey = `money_${userId}`;
    const lastDailyKey = `lastDaily_${userId}`;
    const streakKey = `streak_${userId}`;

    const now = Date.now();
    const lastDaily = (await client.db.get(lastDailyKey)) || 0;
    let currentStreak = (await client.db.get(streakKey)) || 0;

    if (lastDaily && now - lastDaily > ONE_DAY) {
      currentStreak = 0;
    }

    const newStreak = currentStreak + 1;

    const baseAmount = isVip 
      ? Math.floor(Math.random() * 1000) + 500 
      : Math.floor(Math.random() * 500) + 100;
    const streakBonus = isVip 
      ? newStreak * 100 
      : newStreak * 50;
    const totalGain = baseAmount + streakBonus;

    const currentMoney = (await client.db.get(moneyKey)) || 0;
    const newBalance = currentMoney + totalGain;

    await client.db.set(moneyKey, newBalance);
    await client.db.set(lastDailyKey, now);
    await client.db.set(streakKey, newStreak);

    const emoji = chooseEmoji(newBalance);

    let streakMessage =
      newStreak > 1
        ? `🔥 **Serin devam ediyor:** \`${newStreak}\` gün!`
        : `✨ Yeni bir seriye başladın!`;

    if (isVip) {
      return message.reply(
        `👑 **[VIP]** | Harika, sevgili **${message.member.displayName}**! Özel VIP Günlük ödülün hazırlandı~ 🌟✨\n\n` +
          `👑 **Kazandığın:** \`${baseAmount}\` + 🎁 **VIP Bonus:** \`${streakBonus}\`\n` +
          `💼 **Yeni Bakiyen:** \`${newBalance}\` ${emoji}\n` +
          `${streakMessage}\n*Desteğin için çok teşekkür ederiz!* 💖`
      );
    } else {
      vipAd.sendAd(message);
      return message.reply(
        `${emojis.bot.succes} | Tebrikler **${message.member.displayName}**! Günlük ödülün hazır~ 💖\n\n` +
          `${emoji} **Kazandığın:** \`${baseAmount}\` + 🎁 **Bonus:** \`${streakBonus}\`\n` +
          `💼 **Toplam:** \`${newBalance}\`\n` +
          `${streakMessage}`
      );
    }
  } catch (error) {
    console.error(`${emojis.bot.error} | daily komutu hata:`, error);
    return message.reply(
      `${emojis.bot.error} | Aaa~ bir hata oluştu! Sunucudaki para ruhları karıştı galiba 😵`,
    );
  }
};

module.exports.help = {
  name: 'daily',
  aliases: ['günlük'],
  usage: 'daily',
  description: 'Günlük para ödülü alırsınız (Seri yaptıkça bonus artar).',
  category: 'Ekonomi',
  cooldown: 86400,
};
