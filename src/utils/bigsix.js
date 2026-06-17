const {
  MessageEmbed,
  MessageActionRow,
  MessageSelectMenu,
  MessageButton,
} = require("discord.js");

const emojis = require("../emoji.json");

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

const wheelSegments = [
  { label: "⚀", payout: 1 },
  { label: "⚁", payout: 2 },
  { label: "⚂", payout: 5 },
  { label: "⚃", payout: 10 },
  { label: "⚄", payout: 20 },
  { label: "⚅", payout: 50 },
  { label: "$", payout: 100 },
];

const betMapping = {
  "1x": "⚀",
  "2x": "⚁",
  "5x": "⚂",
  "10x": "⚃",
  "20x": "⚄",
  "50x": "⚅",
  "100x": "$",
};

function spinWheel() {
  const weighted = [];
  wheelSegments.forEach((seg) => {
    const weight = Math.round(100 / seg.payout);
    for (let i = 0; i < weight; i++) weighted.push(seg);
  });
  const choice = weighted[Math.floor(Math.random() * weighted.length)];
  return choice;
}

async function spinWheelWithEffect(message, selectedSymbol) {
  const spinningMessage = await message.channel.send(
    `🎡 Çark dönüyor... Seçimin: ${selectedSymbol}`
  );

  const frames = [
    "🎡 Çark dönüyor |",
    "🎡 Çark dönüyor /",
    "🎡 Çark dönüyor -",
    "🎡 Çark dönüyor \\",
  ];
  let idx = 0;
  const iv = setInterval(() => {
    spinningMessage.edit(`${frames[idx]} — Seçimin: ${selectedSymbol}`);
    idx = (idx + 1) % frames.length;
  }, 500);

  const duration = Math.floor(Math.random() * 6000) + 3000;
  await new Promise((r) => setTimeout(r, duration));

  clearInterval(iv);
  await spinningMessage.delete();
}

module.exports.execute = async (client, message) => {
  const userId = message.author.id;
  const isVip = !!(await client.db.get(`vips.${userId}`));
  const displayName = message.member?.displayName || message.author.username;

  const balance = await client.eco.fetchMoney(userId);
  const balanceEmoji = chooseEmoji(balance);

  if (balance < 10) {
    return message.reply(
      `${emojis.bot.error} | **${displayName}**, oynamak için en az 10 ${chooseEmoji(10)} gerekiyor~ Biraz daha biriktir, tamam mı~ :c`
    );
  }

  const betEmbed = new MessageEmbed()
    .setTitle(isVip ? "👑 [VIP] Big Six Wheel Bahis" : `${emojis.bot.succes} | Big Six Wheel Bahis`)
    .setDescription(
      `Mevcut bakiyen: **${balance.toLocaleString()}** ${balanceEmoji}\n\n` +
        "Lütfen bahis miktarını seç:\n(min: 10 • max: 250.000 veya **All**)"
    )
    .setColor(isVip ? "#e1b12c" : "BLUE");

  const betRow = new MessageActionRow().addComponents(
    new MessageSelectMenu()
      .setCustomId("bet_amount")
      .setPlaceholder("Bahis miktarı seçin")
      .addOptions([
        { label: "10", value: "10" },
        { label: "50", value: "50" },
        { label: "100", value: "100" },
        { label: "1.000", value: "1000" },
        { label: "10.000", value: "10000" },
        { label: "50.000", value: "50000" },
        { label: "75.000", value: "75000" },
        { label: "100.000", value: "100000" },
        { label: "250.000", value: "250000" },
        { label: "All", value: "all" },
      ])
  );

  const betMsg = await message.channel.send({ embeds: [betEmbed], components: [betRow] });

  async function promptBet() {
    const overallTimeout = Date.now() + 3 * 60 * 1000;
    let attemptTimeout = 30000;

    while (Date.now() < overallTimeout) {
      try {
        const collected = await betMsg.awaitMessageComponent({
          filter: (i) => i.user.id === userId && i.customId === "bet_amount",
          componentType: "SELECT_MENU",
          time: attemptTimeout,
        });

        await collected.deferUpdate();

        const choice = collected.values[0];
        const betAmount = choice === "all" ? Math.min(balance, 250000) : parseInt(choice, 10);

        if (isNaN(betAmount) || betAmount < 10 || betAmount > 250000) {
          await collected.followUp({
            content: `${emojis.bot.error} | **${displayName}**, geçersiz bahis! Lütfen 10 ile 250.000 arasında bir değer seç, tamam mı~? Senin için tekrar göstereyim, acele etme~`,
            ephemeral: true,
          });
          attemptTimeout = 60000;
          continue;
        }

        if (betAmount > balance) {
          await collected.followUp({
            content: `${emojis.bot.error} | **${displayName}**, bakiyen yetmiyor~ Bu seçimi yapabilmek için yeterli para yok. Lütfen daha küçük bir bahis seç ya da "All" ile kalanını kullanmayı dene~ Senin için menüyü uzattım, sakince seçebilirsin nyaa~`,
            ephemeral: true,
          });
          attemptTimeout = 60000;
          continue;
        }

        return betAmount;
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  const betAmount = await promptBet();

  if (!betAmount) {
    return betMsg.edit({
      content: `${emojis.bot.error} | **${displayName}**, süre doldu veya seçim yapılmadı~ Oyun iptal edildi, tekrar denemek istersen ben buradayım nyaa~`,
      embeds: [],
      components: [],
    });
  }

  await client.eco.removeMoney(userId, betAmount);
  const betEmoji = chooseEmoji(betAmount);

  const row1 = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("segment_1x").setLabel("⚀ (1x)").setStyle("PRIMARY"),
    new MessageButton().setCustomId("segment_2x").setLabel("⚁ (2x)").setStyle("PRIMARY"),
    new MessageButton().setCustomId("segment_5x").setLabel("⚂ (5x)").setStyle("PRIMARY"),
    new MessageButton().setCustomId("segment_10x").setLabel("⚃ (10x)").setStyle("PRIMARY")
  );

  const row2 = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("segment_20x").setLabel("⚄ (20x)").setStyle("PRIMARY"),
    new MessageButton().setCustomId("segment_50x").setLabel("⚅ (50x)").setStyle("PRIMARY"),
    new MessageButton().setCustomId("segment_100x").setLabel("$ (100x)").setStyle("PRIMARY")
  );

  const segEmbed = new MessageEmbed()
    .setTitle(isVip ? "👑 [VIP] Bahis Segmenti Seç" : `${emojis.bot.succes} | Bahis Segmenti Seç`)
    .setDescription(`Bahis: **${betAmount.toLocaleString()}** ${betEmoji}\n\nHangi segment için oynamak istiyorsun?`)
    .setColor(isVip ? "#e1b12c" : "YELLOW");

  const segMsg = await message.channel.send({ embeds: [segEmbed], components: [row1, row2] });

  try {
    const segInteraction = await segMsg.awaitMessageComponent({
      filter: (i) => i.user.id === userId && i.customId.startsWith("segment_"),
      time: 30000,
    });

    await segInteraction.deferUpdate();

    const segmentKey = segInteraction.customId.split("_")[1];
    const selectedSymbol = betMapping[segmentKey];

    await spinWheelWithEffect(message, selectedSymbol);

    let resultSeg = spinWheel();
    if (selectedSymbol !== resultSeg.label && isVip && Math.random() < 0.25) {
      resultSeg = wheelSegments.find((s) => s.label === selectedSymbol) || resultSeg;
    }
    const payoutInfo = wheelSegments.find((s) => s.label === resultSeg.label);
    const winnings = selectedSymbol === resultSeg.label ? Math.floor(betAmount * payoutInfo.payout) : 0;

    if (winnings > 0) {
      await client.eco.addMoney(userId, winnings);
    }

    const resultEmbed = new MessageEmbed()
      .setTitle(
        winnings > 0 
          ? (isVip ? "👑 [VIP] Big Six Wheel Sonuç (Kazandın!)" : `${emojis.bot.succes} | Big Six Wheel Sonuç`) 
          : (isVip ? "👑 [VIP] Big Six Wheel Sonuç" : `${emojis.bot.error} | 🎡 Big Six Wheel Sonuç`)
      )
      .setDescription(
        `Seçimin: **${selectedSymbol}**\nÇark: **${resultSeg.label}**\n\n` +
          `**${winnings > 0 ? "Kazandın, tebrikler~!" : "Kaybettin, üzgünüm~ :c"}**\n` +
          `Bahis: **${betAmount.toLocaleString()}** ${betEmoji}\n` +
          `Kazanç: **${winnings.toLocaleString()}** ${chooseEmoji(winnings)}`
      )
      .setColor(winnings > 0 ? (isVip ? "#FFD700" : "GREEN") : "RED");

    return segInteraction.followUp({ embeds: [resultEmbed] });
  } catch (err) {
    return message.channel.send(`${emojis.bot.error} | **${displayName}**, lütfen biraz yavaş ol~ Süre doldu, segment seçimi yapılmadı, oyun iptal edildi. Tekrar denemek istersen buradayım nyaa~`);
  }
};
