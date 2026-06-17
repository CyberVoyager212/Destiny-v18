const {
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
} = require("discord.js");

const emojis = require("../emoji.json");

function chooseEmoji(amount) {
  const money = emojis.money || {};
  if (amount > 100000) return money.high || "💰";
  if (amount > 10000) return money.medium || "💵";
  return money.low || "🪙";
}

exports.execute = async (client, message) => {
  const isVip = !!(await client.db.get(`vips.${message.author.id}`));
  const displayName = message.member?.displayName || message.author.username;
  let balData;
  try {
    balData = await client.eco.fetchMoney(message.author.id);
  } catch (e) {
    console.error("fetchMoney hata:", e);
    return message.channel.send(`${emojis.bot?.error || "❌"} | Bakiyen alınamadı, sonra tekrar dene.`);
  }

  let userBalance =
    typeof balData === "object" && balData.amount != null
      ? balData.amount
      : Number(balData) || 0;

  if (userBalance < 10) {
    return message.channel.send(
      `${emojis.bot?.error || "❌"} | **${displayName}**, oynamak için en az 10 ${chooseEmoji(
        10
      )} gerekiyor~ Biraz daha biriktir, tamam mı~ :c`
    );
  }

  const embed = new MessageEmbed()
    .setTitle(`${emojis.bot?.succes || "✅"} Rus Ruleti`)
    .setDescription(
      `Mevcut bakiyen: **${userBalance.toLocaleString()}** ${chooseEmoji(
        userBalance
      )}\n\nLütfen bahis miktarınızı seçin: (min: 10 • max: 250.000 veya All)`
    )
    .setColor("BLUE");

  const row = new MessageActionRow().addComponents(
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

  let gameMessage = await message.channel.send({
    embeds: [embed],
    components: [row],
  });

  const filter = (i) => i.user.id === message.author.id && i.customId === "bet_amount";

  let selectionInteraction;
  let betAmount;

  while (true) {
    try {
      selectionInteraction = await gameMessage.awaitMessageComponent({
        filter,
        componentType: "SELECT_MENU",
        time: 60000,
      });

      const rawChoice = selectionInteraction.values[0];

      const refreshed = await client.eco.fetchMoney(message.author.id);
      userBalance =
        typeof refreshed === "object" && refreshed.amount != null
          ? refreshed.amount
          : Number(refreshed) || 0;

      betAmount = rawChoice === "all" ? Math.min(userBalance, 250000) : parseInt(rawChoice, 10);

      if (isNaN(betAmount) || betAmount < 10 || betAmount > 250000) {
        await selectionInteraction.reply({
          content: `${emojis.bot?.error || "❌"} | **${displayName}**, geçersiz miktar seçtin~ Lütfen 10 ile 250.000 arasında bir değer seç, tamam mı~?`,
          ephemeral: true,
        });
        continue;
      }

      if (betAmount > userBalance) {
        await selectionInteraction.reply({
          content: `${emojis.bot?.error || "❌"} | **${displayName}**, yeterli bakiye yok~ Bahis menüsünü sana tekrar açıyorum, lütfen yeniden seç~`,
          ephemeral: true,
        });
        continue;
      }

      break;
    } catch (err) {
      try {
        await gameMessage.edit({
          content: `${emojis.bot?.error || "❌"} | **${displayName}**, süre doldu~ Bahis yapılmadı, istersen tekrar deneyebilirsin~`,
          embeds: [],
          components: [],
        });
      } catch (e) {
        console.error("menu edit hata:", e);
      }
      return;
    }
  }

  const gameEmbed = new MessageEmbed()
    .setTitle(`${emojis.bot?.succes || "✅"} Rus Ruleti`)
    .setDescription(
      `Bahis başlıyor! İlk bahis: **${betAmount.toLocaleString()}** ${chooseEmoji(
        betAmount
      )}\n\nTetiği çekmek için "Tetik Çek" butonuna bas!`
    )
    .setColor("DARK_RED");

  const gameRow = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("shoot").setLabel("Tetik Çek").setStyle("DANGER"),
    new MessageButton().setCustomId("leave").setLabel("Çekil").setStyle("SECONDARY")
  );

  try {
    await selectionInteraction.update({ embeds: [gameEmbed], components: [gameRow] });
  } catch (e) {
    console.error("selectionInteraction.update hata:", e);
    try {
      await gameMessage.edit({ embeds: [gameEmbed], components: [gameRow] });
    } catch (e2) {
      console.error("gameMessage.edit fallback hata:", e2);
      return message.channel.send(`${emojis.bot?.error || "❌"} | Bir şeyler ters gitti, tekrar dene.`);
    }
  }

  const gameFilter = (i) => i.user.id === message.author.id;
  const gameCollector = gameMessage.createMessageComponentCollector({
    filter: gameFilter,
    time: 60000,
  });

  let roundsSurvived = 0;

  gameCollector.on("collect", async (gameInteraction) => {
    if (gameInteraction.customId === "leave") {
      gameCollector.stop("user_left");
      try {
        return await gameInteraction.update({
          content: `${emojis.bot?.succes || "✅"} | **${displayName}**, oyundan çekildin~ Bahisin güvende, istersen tekrar dene~`,
          embeds: [],
          components: [],
        });
      } catch (e) {
        return await gameInteraction.reply({ content: "Oyundan çekildin.", ephemeral: true });
      }
    }

    await gameInteraction.deferUpdate();

    const shot = Math.random() < (isVip ? 0.35 : 0.5); 

    if (shot) {
      gameCollector.stop("shot");
      try {
        await client.eco.removeMoney(message.author.id, betAmount);
      } catch (e) {
        console.error("removeMoney hata:", e);
      }
      return gameInteraction.editReply({
        content: `${emojis.bot?.error || "❌"} ${emojis.guns?.ates || ""} **BANG!** Öldün .38 Special tam isabet ve **${betAmount.toLocaleString()}** ${chooseEmoji(
          betAmount
        )} kaybettin... Üzgünüm~ :c`,
        embeds: [],
        components: [],
      });
    } else {
      roundsSurvived++;
      betAmount *= 2;

      if (roundsSurvived >= 3) {
        gameCollector.stop("won");
        const winnings = betAmount * 5;
        try {
          await client.eco.addMoney(message.author.id, winnings);
        } catch (e) {
          console.error("addMoney hata:", e);
        }
        return gameInteraction.editReply({
          content: isVip
            ? `👑 **[VIP] Tebrikler ${displayName}!** VIP şansınızla ${roundsSurvived} tur boyunca hayatta kalmayı başardınız! 👑✨\n> Kazanılan Ödül: **${winnings.toLocaleString()}** ${chooseEmoji(winnings)}`
            : `${emojis.bot?.succes || "✅"} **Tebrikler ${displayName}! ${roundsSurvived} tur hayatta kaldın.** Ödül: **${winnings.toLocaleString()}** ${chooseEmoji(winnings)} kazandın~`,
          embeds: [],
          components: [],
        });
      }

      const newGameEmbed = new MessageEmbed()
        .setTitle(`${emojis.bot?.succes || "✅"} Rus Ruleti`)
        .setDescription(
          `${emojis.guns?.bos || ""} Tetiği çektin, şarjör boş! Yeni bahis: **${betAmount.toLocaleString()}** ${chooseEmoji(
            betAmount
          )}\n\nDevam etmek ister misin?`
        )
        .setColor("GOLD");

      const newGameRow = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("shoot").setLabel("Tetik Çek").setStyle("DANGER"),
        new MessageButton().setCustomId("leave").setLabel("Çekil").setStyle("SECONDARY")
      );

      return gameInteraction.editReply({
        embeds: [newGameEmbed],
        components: [newGameRow],
      });
    }
  });

  gameCollector.on("end", async (_, reason) => {
    if (reason === "time") {
      try {
        await gameMessage.edit({
          content: `${emojis.bot?.error || "❌"} | **${displayName}**, süre doldu, oyun iptal edildi~`,
          embeds: [],
          components: [],
        });
      } catch (e) {
        console.error("gameMessage.edit end hata:", e);
      }
    }
  });
};
