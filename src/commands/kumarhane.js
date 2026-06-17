const {
  MessageEmbed,
  MessageActionRow,
  MessageButton,
} = require("discord.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "kumarhane",
  description: "Kumarhane oyunlarına katılmanızı sağlar.",
  usage: "kumarhane",
  category: "Ekonomi",
  cooldown: 5,
};

exports.execute = async (client, message, args) => {
  const isVip = !!(await client.db.get(`vips.${message.author.id}`));
  const userBalance = await client.eco.fetchMoney(message.author.id);
  let entryFee = 500 + Math.floor(userBalance * 0.007);
  if (isVip) entryFee = Math.floor(entryFee * 0.5);

  let feeEmoji =
    entryFee >= 100000
      ? emojis.money.high
      : entryFee >= 10000
      ? emojis.money.medium
      : emojis.money.low;

  if (userBalance < entryFee) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, kumarhaneye girmek için yeterli paran yok... Ücret: **${entryFee}** ${feeEmoji} ~ :c`
    );
  }

  const confirmationEmbed = new MessageEmbed()
    .setTitle(isVip ? "👑 [VIP] Kumarhane Girişi" : "🎰 Kumarhane Girişi")
    .setColor(isVip ? "#FFD700" : "#E2583E")
    .setThumbnail("https://cdn-icons-png.flaticon.com/512/2166/2166829.png")
    .setDescription(
      isVip
        ? `Değerli VIP üyemiz, sizin için giriş ücretinde %50 indirim uygulandı!\n` +
          `Giriş ücreti: **${entryFee}** ${feeEmoji}.\n\n` +
          `👑 **${message.member.displayName}**, kumarhaneye giriş yapmaya hazır mısınız?`
        : `Giriş ücreti **${entryFee}** ${feeEmoji}.\n\n${emojis.bot.succes} | **${message.member.displayName}**, girmeye hazır mısın~?\n\n` +
          `💡 *VIP üye olarak giriş ücretinde %50 indirim kazanabilir ve oyunlarda daha şanslı olabilirsiniz!*`
    )
    .setFooter({
      text: `${client.user.username} Casino™`,
      iconURL: client.user.displayAvatarURL(),
    });

  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("accept")
      .setLabel("✅ Giriş Yap")
      .setStyle("SUCCESS"),
    new MessageButton()
      .setCustomId("decline")
      .setLabel("❌ Vazgeç")
      .setStyle("DANGER")
  );

  const confirmMessage = await message.channel.send({
    embeds: [confirmationEmbed],
    components: [row],
  });

  const filter = (i) => i.user.id === message.author.id;
  const collector = confirmMessage.createMessageComponentCollector({
    filter,
    time: 30000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "accept") {
      await client.eco.removeMoney(message.author.id, entryFee);

      const gamesEmbed = new MessageEmbed()
        .setTitle(isVip ? "👑 [VIP] Kumarhane Oyunları Menüsü" : "🎲 Kumarhane Oyunları Menüsü")
        .setColor(isVip ? "#FFD700" : "#32CD32")
        .setThumbnail("https://cdn-icons-png.flaticon.com/512/2884/2884564.png")
        .setDescription(
          isVip 
            ? "👑 Değerli VIP üyemiz, oynamak istediğiniz oyunu seçin. VIP şansınız tüm oyunlarda etkindir! ✨" 
            : "🃏 Oynamak istediğin oyunu seç lütfen~"
        )
        .addFields(
          { name: "🃏 Poker", value: "`Texas Hold'em` oynayın.", inline: true },
          { name: "🎡 Rulet", value: "`Bahis yaparak` rulet çevirin.", inline: true },
          { name: "🎲 Craps", value: "`Zar atarak` kazanmaya çalışın.", inline: true },
          { name: "🎴 Baccarat", value: "`Kartlarla` baccarat oynayın.", inline: true },
          { name: "🔢 Keno", value: "`Sayı seçerek` ödül kazanın.", inline: true },
          { name: "🎲 Sic Bo", value: "`Zar kombinasyonlarına` bahis yapın.", inline: true },
          { name: "🤑 Big Six Wheel", value: "`Çarkı çevirin` ve kazanın.", inline: true }
        );

      const row1 = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("poker").setLabel("🃏 Poker").setStyle("PRIMARY"),
        new MessageButton().setCustomId("roulette").setLabel("🎡 Rulet").setStyle("PRIMARY"),
        new MessageButton().setCustomId("craps").setLabel("🎲 Craps").setStyle("PRIMARY")
      );

      const row2 = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("baccarat").setLabel("🎴 Baccarat").setStyle("PRIMARY"),
        new MessageButton().setCustomId("keno").setLabel("🔢 Keno").setStyle("PRIMARY"),
        new MessageButton().setCustomId("sicbo").setLabel("🎲 Sic Bo").setStyle("PRIMARY"),
        new MessageButton().setCustomId("bigsix").setLabel("🤑 Big Six").setStyle("PRIMARY")
      );

      await interaction.update({
        embeds: [gamesEmbed],
        components: [row1, row2],
      });

      const gameCollector = confirmMessage.createMessageComponentCollector({
        filter,
        time: 60000,
      });

      gameCollector.on("collect", async (gameInteraction) => {
        const selectedGame = gameInteraction.customId;

        const gameNames = {
          poker: "🃏 Poker",
          roulette: "🎡 Rulet",
          craps: "🎲 Craps",
          baccarat: "🎴 Baccarat",
          keno: "🔢 Keno",
          sicbo: "🎲 Sic Bo",
          bigsix: "🤑 Big Six Wheel",
        };

        await gameInteraction.update({
          content: `${emojis.bot.succes} | **${message.member.displayName}**, ${gameNames[selectedGame]} oyununa katıldın~ bol şans sana! >w<`,
          embeds: [],
          components: [],
        });

        try {
          require(`../utils/${selectedGame}.js`).execute(client, message);
        } catch (err) {
          message.channel.send(
            `${emojis.bot.error} | Auu~ oyun başlatılamadı... **${message.member.displayName}**, sanırım sistemim çöktü :c`
          );
          console.error(err);
        }
      });
    } else if (interaction.customId === "decline") {
      await interaction.update({
        content: `${emojis.bot.error} | **${message.member.displayName}**, giriş iptal edildi~ belki sonra gelirsin :<`,
        embeds: [],
        components: [],
      });
    }
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      confirmMessage.edit({
        content: `⏱ | **${message.member.displayName}**, lütfen biraz yavaş ol~ bana göre çok hızlısın :c`,
        embeds: [],
        components: [],
      });
    }
  });
};
