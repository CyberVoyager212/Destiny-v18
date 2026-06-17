const emojis = require("../emoji.json"); 

exports.execute = async (client, message, args) => {
  const db = client.db;
  const userId = message.author.id;

  try {
    const isVip = !!(await db.get(`vips.${userId}`));
    const amount = isVip
      ? Math.floor(Math.random() * 3000) + 2500
      : Math.floor(Math.random() * 1500) + 1000;

    const jobs = [
      "Yazılımcı",
      "Kasiyer",
      "Kurye",
      "Grafiker",
      "Video Editörü",
      "Çaycı",
      "Web Tasarımcısı",
      "Animatör",
      "Stajyer",
      "Anketör",
      "Çevirmen",
    ];
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    const balanceKey = `money_${userId}`;
    await db.add(balanceKey, amount);
    const balance = await db.get(balanceKey);

    function chooseEmoji(amount) {
      if (amount > 100000) return emojis.money.high;
      if (amount > 10000) return emojis.money.medium;
      return emojis.money.low;
    }

    const amountEmoji = chooseEmoji(amount);
    const balanceEmoji = chooseEmoji(balance);

    if (isVip) {
      return message.reply(
        `👑 **[VIP]** | Saygıdeğer VIP üyemiz **${message.member.displayName}**, özel işiniz **${job}** olarak çalıştınız ve yüksek VIP kazancınız verildi~ ✨👑\n` +
          `> Kazanılan VIP Miktar: **${amount} ${amountEmoji}**\n` +
          `> Toplam Bakiyeniz: **${balance} ${balanceEmoji}**`
      );
    } else {
      return message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, ${job} olarak çalıştın ve kazancın verildi~ ✨\n` +
          `> Aldığın miktar: **${amount} ${amountEmoji}**\n` +
          `> Şu an toplam paran: **${balance} ${balanceEmoji}**\n\n` +
          `💡 *VIP üye olarak çalışarak 2-3 kat daha fazla maaş alabileceğinizi biliyor muydunuz?*`
      );
    }
  } catch (err) {
    console.error("work hata:", err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, çalışırken bir şeyler ters gitti qwq~ \n> Hata: \`${err?.message || "Bilinmeyen hata"}\``
    );
  }
};

exports.help = {
  name: "work",
  aliases: [],
  usage: "work",
  description: "Çalışarak para kazanırsınız.",
  category: "Ekonomi",
  cooldown: 60, 
};
