const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const crypto = require("crypto");
const emojis = require("../emoji.json"); 

const cardEmoji = emojis.cards || {}; 
const cardBack = emojis.cardBack || ":black_joker:";

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

function formatHand(hand) {
  return hand
    .map((card) => cardEmoji[card.value] || `${card.value}${card.suit}`)
    .join(" ");
}

exports.execute = async (client, message, args) => {
  try {
    const userEco = await client.eco.fetchMoney(message.author.id);
    let betAmount;
    if (args[0] === "all") {
      betAmount = userEco.amount;
    } else {
      betAmount = parseInt(args[0], 10);
    }

    if (isNaN(betAmount) || betAmount <= 0) {
      return message.reply(
        `${emojis.bot.error} | Ooops, **${message.member.displayName}**, geçerli bir bahis gir lütfen~`
      );
    }

    if (userEco.amount < betAmount) {
      return message.reply(
        `${emojis.bot.error} | Üzgünüm **${message.member.displayName}**, bakiyen yetersizmiş. Şu an **${userEco.amount}** ${chooseEmoji(
          userEco.amount
        )} paran var.`
      );
    }

    await client.eco.removeMoney(message.author.id, betAmount);

    let deck = [];
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    deck = shuffle(deck);

    function calculateHandValue(hand) {
      let value = 0;
      let aceCount = 0;
      for (const card of hand) {
        if (["J", "Q", "K"].includes(card.value)) value += 10;
        else if (card.value === "A") {
          aceCount++;
          value += 11;
        } else value += parseInt(card.value, 10);
      }
      while (value > 21 && aceCount > 0) {
        value -= 10;
        aceCount--;
      }
      return value;
    }

    let userHand = [deck.pop(), deck.pop()];
    let dealerHand = [deck.pop(), deck.pop()];

    const gameId = crypto.randomBytes(3).toString("hex");

    await client.db.set(`blackjack_${gameId}`, {
      userId: message.author.id,
      betAmount,
      deck,
      userHand,
      dealerHand,
      timestamp: Date.now(),
    });

    const embed = new MessageEmbed()
      .setTitle("🃏 Blackjack Başladı")
      .setColor("GREEN")
      .setDescription(
        `Oyun ID: **${gameId}**\n` +
          `Kartların: ${formatHand(userHand)}\n` +
          `Toplam: **${calculateHandValue(userHand)}**\n` +
          `Dağıtıcının açık kartı: ${cardEmoji[dealerHand[0].value] || (dealerHand[0].value + dealerHand[0].suit)}`
      );

    const hitButton = new MessageButton().setCustomId("hit").setLabel("Çek").setStyle("PRIMARY");
    const stayButton = new MessageButton().setCustomId("stay").setLabel("Dur").setStyle("SECONDARY");
    const row = new MessageActionRow().addComponents(hitButton, stayButton);

    const gameMessage = await message.channel.send({
      content: `${emojis.bot.succes} | Hazırsın **${message.member.displayName}**! Oyun başladı, iyi şanslar~`,
      embeds: [embed],
      components: [row],
    });

    const filter = (i) => i.user.id === message.author.id;
    const collector = gameMessage.createMessageComponentCollector({ filter, time: 60000 });

    collector.on("collect", async (interaction) => {
      await interaction.deferUpdate().catch(() => {});

      let gameState = await client.db.get(`blackjack_${gameId}`);
      if (!gameState) {
        await message.channel.send(`${emojis.bot.error} | Eh, oyun zaten sona ermiş gibi görünüyor...`);
        return;
      }

      if (interaction.customId === "hit") {
        const newCard = gameState.deck.pop();
        gameState.userHand.push(newCard);

        const userValue = calculateHandValue(gameState.userHand);
        await client.db.set(`blackjack_${gameId}`, gameState);

        if (userValue > 21) {
          await client.db.delete(`blackjack_${gameId}`);
          const bustEmbed = new MessageEmbed()
            .setTitle("💥 BÜST!")
            .setColor("RED")
            .setDescription(
              `**${message.member.displayName}**, kart çektin: ${cardEmoji[newCard.value] || (newCard.value + newCard.suit)}\n` +
                `Kartların: ${formatHand(gameState.userHand)}\n` +
                `Toplam: **${userValue}**\n\n` +
                `Maalesef kaybettin. Bahsin **${betAmount}** ${chooseEmoji(betAmount)} gitti...`
            )
            .setTimestamp();

          await gameMessage.edit({ embeds: [bustEmbed], components: [] }).catch(() => {});
          return message.channel.send(`${emojis.bot.error} | Ahh, **${message.member.displayName}**, büst oldun... Şansını başka oyunda dene~`);
        } else {
          const updatedEmbed = new MessageEmbed()
            .setTitle("🃏 Blackjack - Devam")
            .setColor("GREEN")
            .setDescription(
              `Kart çektin: ${cardEmoji[newCard.value] || (newCard.value + newCard.suit)}\n` +
                `Kartların: ${formatHand(gameState.userHand)}\n` +
                `Toplam: **${userValue}**\n` +
                `Dağıtıcının açık kartı: ${cardEmoji[gameState.dealerHand[0].value] || (gameState.dealerHand[0].value + gameState.dealerHand[0].suit)}`
            )
            .setTimestamp();

          await gameMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
          return;  
        }
      }

      if (interaction.customId === "stay") {
        let dealerValue = calculateHandValue(gameState.dealerHand);
        while (dealerValue < 17) {
          gameState.dealerHand.push(gameState.deck.pop());
          dealerValue = calculateHandValue(gameState.dealerHand);
        }

        const userValue = calculateHandValue(gameState.userHand);

        if (dealerValue > 21 || userValue > dealerValue) {
          const winnings = gameState.betAmount * 2;
          await client.eco.addMoney(message.author.id, winnings);
          await client.db.delete(`blackjack_${gameId}`);

          const winEmbed = new MessageEmbed()
            .setTitle("🎉 Tebrikler Kazandın!")
            .setColor("GOLD")
            .setDescription(
              `**${message.member.displayName}**, kazandın!\n\n` +
                `Senin kartların: ${formatHand(gameState.userHand)} (Toplam: **${userValue}**)\n` +
                `Dağıtıcının kartları: ${formatHand(gameState.dealerHand)} (Toplam: **${dealerValue}**)\n\n` +
                `Kazancın: **${winnings}** ${chooseEmoji(winnings)} — Afiyet olsun!`
            )
            .setTimestamp();

          await gameMessage.edit({ embeds: [winEmbed], components: [] }).catch(() => {});
          return message.channel.send(`${emojis.bot.succes} | Sugoi! **${message.member.displayName}**, oyunu kazandın, tebrikler~`);
        } else if (userValue === dealerValue) {
          await client.eco.addMoney(message.author.id, gameState.betAmount);
          await client.db.delete(`blackjack_${gameId}`);

          const tieEmbed = new MessageEmbed()
            .setTitle("🔄 Berabere")
            .setColor("YELLOW")
            .setDescription(
              `Berabere! Sen: **${userValue}**, Dağıtıcı: **${dealerValue}**\n` +
                `Bahsin iade edildi: **${gameState.betAmount}** ${chooseEmoji(gameState.betAmount)}`
            )
            .setTimestamp();

          await gameMessage.edit({ embeds: [tieEmbed], components: [] }).catch(() => {});
          return message.channel.send(`${emojis.bot.succes} | Hmm, beraberlik çıktı. Bahsiniz iade edildi, tekrar dene istersen hazırım~`);
        } else {
          await client.db.delete(`blackjack_${gameId}`);
          const loseEmbed = new MessageEmbed()
            .setTitle("😢 Kaybettin")
            .setColor("RED")
            .setDescription(
              `Sen: ${formatHand(gameState.userHand)} (Toplam: **${userValue}**)\n` +
                `Dağıtıcı: ${formatHand(gameState.dealerHand)} (Toplam: **${dealerValue}**)\n\n` +
                `Maalesef bahis miktarın **${gameState.betAmount}** ${chooseEmoji(gameState.betAmount)} kaybedildi.`
            )
            .setTimestamp();

          await gameMessage.edit({ embeds: [loseEmbed], components: [] }).catch(() => {});
          return message.channel.send(`${emojis.bot.error} | Üzgünüm **${message.member.displayName}**, bu sefer olmadı... Bir dahaki sefer daha şanslı olursun~`);
        }
      }

      await client.db.set(`blackjack_${gameId}`, gameState).catch(() => {});
    });

    collector.on("end", () => {
      gameMessage.edit({ components: [] }).catch(() => {});
    });
  } catch (error) {
    console.error("blackjack komutu hatası:", error);
    return message.reply(
      `${emojis.bot.error} | Ayy, bir şeyler ters gitti **${message.member.displayName}**... Lütfen biraz sonra tekrar dene~`
    );
  }
};

exports.help = {
  name: "blackjack",
  aliases: ["bj"],
  usage: "blackjack <miktar> veya blackjack all",
  description:
    "Blackjack oynatır. `<miktar>` ile bahis yap veya `blackjack all` ile tüm bakiyenle oyna.",
  category: "Ekonomi",
  cooldown: 10,
};
