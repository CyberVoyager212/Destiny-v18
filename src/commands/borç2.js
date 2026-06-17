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
  const isVip = !!(await client.db.get(`vips.${userId}`));

  if (!args[0] || isNaN(args[0]) || parseInt(args[0]) <= 0) {
    return message.reply(
      `${emojis.bot.error} | Huhuhu! Geçerli bir ödeme miktarı girmelisin 😵 Sıfır veya negatif rakamlar çalışmaz~`
    );
  }

  let paymentAmount = parseInt(args[0]);
  let userBalance = (await client.db.get(`money_${userId}`)) || 0;
  let loanData = (await client.db.get(`loan_${userId}`)) || { amount: 0, time: null };
  let creditScore = (await client.db.get(`credit_${userId}`)) || 100;

  if (loanData.amount <= 0) {
    return message.reply(
      isVip
        ? `👑 **[VIP]** | Harika! Şu anda borcunuz bulunmuyor, keyfinize bakın sevgili VIP üyemiz 😎`
        : `${emojis.bot.succes} | Yatta! Şu anda borcun yok 😎 Artık rahatça takılabilirsin~`
    );
  }

  const lastLoanTime = moment(loanData.time);
  const currentTime = moment().tz("Europe/Istanbul");
  const daysPassed = currentTime.diff(lastLoanTime, "days");

  const interestRate = isVip ? 0.02 : 0.05;
  const totalInterest = Math.floor(
    loanData.amount * Math.pow(1 + interestRate, daysPassed) - loanData.amount
  );

  if (daysPassed > 0) {
    loanData.amount += totalInterest;
    creditScore -= daysPassed * (isVip ? 1 : 2);
  }

  paymentAmount = Math.min(paymentAmount, loanData.amount, userBalance);

  if (paymentAmount <= 0) {
    return message.reply(
      `${emojis.bot.error} | Aaah! Yeterli paran yok 😖 Biraz daha biriktir, sonra tekrar dene~`
    );
  }

  userBalance -= paymentAmount;
  await client.db.set(`money_${userId}`, userBalance);

  const remainingLoan = loanData.amount - paymentAmount;

  if (remainingLoan <= 0) {
    await client.db.set(`loan_${userId}`, { amount: 0, time: null });

    const loanDuration = currentTime.diff(lastLoanTime, "hours");

    if (loanDuration < 24 && loanData.amount >= 100000) creditScore += 15;
    else if (loanDuration < 48) creditScore += 10;

    if (paymentAmount >= loanData.amount / 2) creditScore += 5;
    if (daysPassed === 0) creditScore += 10;

    await client.db.set(`credit_${userId}`, creditScore);

    if (isVip) {
      return message.reply(
        `👑 **[VIP]** | Harika! VIP ayrıcalıklarınızla borcunuzu tamamen kapattınız ✨\n` +
          `Ödeme (Faiz dahil): **${paymentAmount + totalInterest}** ${chooseEmoji(paymentAmount + totalInterest)}.\n` +
          `📈 Kredi puanınız: **${creditScore}** 💖`
      );
    } else {
      vipAd.sendAd(message);
      return message.reply(
        `${emojis.bot.succes} | Müthiş! Borcunu tamamen ödedin ✨ Faiz dahil toplam ödeme: **${
          paymentAmount + totalInterest
        }** ${chooseEmoji(paymentAmount + totalInterest)}.\n` +
          `📈 Kredi puanın: **${creditScore}** 💖 Artık gönül rahatlığıyla takılabilirsin~`
      );
    }
  } else {
    await client.db.set(`loan_${userId}`, { amount: remainingLoan, time: loanData.time });
    await client.db.set(`credit_${userId}`, creditScore);

    if (isVip) {
      return message.reply(
        `👑 **[VIP]** | Değerli VIP üyemiz, **${paymentAmount}** ${chooseEmoji(paymentAmount)} ödeme yapıldı 💪\n` +
          `💸 Kalan borcunuz: **${remainingLoan}** ${chooseEmoji(remainingLoan)}\n` +
          `📊 Kredi puanınız: **${creditScore}** 💖`
      );
    } else {
      vipAd.sendAd(message);
      return message.reply(
        `${emojis.bot.succes} | Bravo! **${paymentAmount}** ${chooseEmoji(
          paymentAmount
        )} ödedin 💪\n` +
          `💸 Kalan borcun: **${remainingLoan}** ${chooseEmoji(remainingLoan)}\n` +
          `📊 Güncel kredi puanın: **${creditScore}** 💖 Hadi devam et, yakında borcunu bitireceksin~`
      );
    }
  }
};

exports.help = {
  name: "ödeme",
  aliases: [],
  usage: "ödeme <miktar>",
  description:
    "Mevcut borcundan ödeme yaparak bakiyenden düşersin. Ödeme geciktikçe faiz işler ve kredi puanın düşer.",
  category: "Ekonomi",
  cooldown: 15,
};
