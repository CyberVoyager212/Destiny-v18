const moment = require("moment-timezone");
const emojis = require("../emoji.json");
const vipAd = require("../utils/vipAd");

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

exports.execute = async (client, message, args) => {
  const userId = message.author.id;

  if (!args[0] || isNaN(args[0]) || parseInt(args[0]) <= 0) {
    return message.reply(
      `${emojis.bot.error} | Oof! Lütfen geçerli bir sayı gir 😖 Sıfır veya negatif rakamlar geçerli değil~`
    );
  }

  const borrowAmount = parseInt(args[0]);
  const isVip = !!(await client.db.get(`vips.${userId}`));
  const userCredit = (await client.db.get(`credit_${userId}`)) || 100;
  const existingLoan = (await client.db.get(`loan_${userId}`)) || {
    amount: 0,
    time: null,
  };

  const maxLoan = isVip ? userCredit * 2000 : userCredit * 1000;

  if (existingLoan.amount > 0) {
    return message.reply(
      `${emojis.bot.error} | Hups! Mevcut borcun var 😵 Önce onu öde, sonra yeni borç alabilirsin~`
    );
  }

  if (borrowAmount > maxLoan) {
    return message.reply(
      `${emojis.bot.error} | Aman dikkat! Maksimum çekebileceğin miktar **${maxLoan}** ${chooseEmoji(
        maxLoan
      )} 😳 Bu rakamı aşamazsın~`
    );
  }

  await client.db.set(`loan_${userId}`, {
    amount: borrowAmount,
    time: moment().tz("Europe/Istanbul").format(),
  });

  await client.eco.addMoney(userId, borrowAmount);

  let creditScore = userCredit;
  if (isVip) {
    if (borrowAmount >= 100000) creditScore -= 2;
    else if (borrowAmount >= 50000) creditScore -= 1;
  } else {
    if (borrowAmount >= 100000) creditScore -= 10;
    else if (borrowAmount >= 50000) creditScore -= 5;
  }

  await client.db.set(`credit_${userId}`, creditScore);

  if (isVip) {
    return message.reply(
      `👑 **[VIP]** | Tebrikler, değerli VIP üyemiz! **${borrowAmount}** ${chooseEmoji(
        borrowAmount
      )} başarıyla hesabınıza aktarıldı ✨👑\n` +
        `Kredi puanınız korundu/güncellendi: **${creditScore}** 💎\n` +
        `*Geri ödemeyi dilediğiniz zaman yapabilirsiniz.*`
    );
  } else {
    vipAd.sendAd(message);
    return message.reply(
      `${emojis.bot.succes} | Tebrikler! **${borrowAmount}** ${chooseEmoji(
        borrowAmount
      )} başarıyla hesabına eklendi ✨\n` +
        `Kredi puanın şimdi: **${creditScore}** 💖\n` +
        `Borcunu zamanında ödemeyi unutma, yoksa botu kullanamayabilirsin~ 😵`
    );
  }
};

exports.help = {
  name: "paraçek",
  aliases: [],
  usage: "paraçek <miktar>",
  description:
    "Borç alarak bakiyeni artırırsın. Kredi puanına göre maksimum çekebileceğin miktar değişir.",
  category: "Ekonomi",
  cooldown: 30,
};
