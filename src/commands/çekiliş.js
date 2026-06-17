const { MessageEmbed } = require("discord.js");
const ms = require("ms");
const emojis = require("../emoji.json"); 

exports.help = {
  name: "cekilis",
  aliases: ["çekiliş", "giveaway"],
  usage:
    "cekilis başlat <süre> <kazanan sayısı> <ödül> | cekilis bitir <mesajId> | cekilis iptal <mesajId> | cekilis liste",
  description: "Çekiliş başlatır, bitirir, iptal eder veya liste gösterir.",
  category: "Moderasyon",
  cooldown: 5,
  permissions: ["MANAGE_GUILD"],
};

function formatDate(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

exports.execute = async (client, message, args) => {
  const db = client.db;

  const subcommand = args[0]?.toLowerCase();
  const validSub = ["başlat", "bitir", "iptal", "liste"];
  if (!subcommand || !validSub.includes(subcommand)) {
    return message.reply(
      `${emojis.bot.error} | Ooops! **${message.member.displayName}**, geçersiz komut girdin~ Lütfen doğru kullan:\n` +
        "`cekilis başlat <süre> <kazanan sayısı> <ödül>`\n" +
        "`cekilis bitir <mesajId>`\n" +
        "`cekilis iptal <mesajId>`\n" +
        "`cekilis liste`"
    );
  }

  if (subcommand === "başlat") {
    if (args.length < 4)
      return message.reply(
        `${emojis.bot.error} | Hımm~ Eksik argümanlar var gibi 😳\nKullanım: \`cekilis başlat <süre> <kazanan sayısı> <ödül>\``
      );

    const duration = ms(args[1]);
    if (!duration)
      return message.reply(
        `${emojis.bot.error} | Hııı? **${args[1]}** geçerli bir süre değil~ lütfen düzgün bir zaman gir 😅`
      );

    const winnerCount = parseInt(args[2]);
    if (isNaN(winnerCount) || winnerCount < 1)
      return message.reply(
        `${emojis.bot.error} | Kazanan sayısı en az 1 olmalı~`
      );

    const prize = args.slice(3).join(" ");
    if (!prize)
      return message.reply(`${emojis.bot.error} | Ödül boş olamaz~`);

    const embed = new MessageEmbed()
      .setTitle("🎉 Yeni Çekiliş Başladı! 🎉")
      .setDescription(
        `Ödül: **${prize}**\nKazanan Sayısı: **${winnerCount}**\nSüre: **${args[1]}**`
      )
      .setFooter({ text: `Başlatan: ${message.member.displayName}` })
      .setTimestamp(Date.now() + duration)
      .setColor("GREEN");

    const sentMessage = await message.channel.send({ embeds: [embed] });
    await sentMessage.react("🎉");

    const giveaways = (await db.get(`cekilisler_${message.guild.id}`)) || [];
    giveaways.push({
      messageId: sentMessage.id,
      channelId: message.channel.id,
      prize,
      winnerCount,
      endTime: Date.now() + duration,
      winners: [],
      ended: false,
    });
    await db.set(`cekilisler_${message.guild.id}`, giveaways);

    message.reply(
      `${emojis.bot.succes} | Harika! Çekiliş başladı! Mesaj ID: \`${sentMessage.id}\``
    );

    setTimeout(async () => {
      const storedGiveaways =
        (await db.get(`cekilisler_${message.guild.id}`)) || [];
      const giveaway = storedGiveaways.find(
        (g) => g.messageId === sentMessage.id
      );
      if (!giveaway || giveaway.ended) return;

      const channel = message.guild.channels.cache.get(giveaway.channelId);
      if (!channel) return;

      const giveawayMessage = await channel.messages
        .fetch(giveaway.messageId)
        .catch(() => null);
      if (!giveawayMessage) return;

      const reaction = giveawayMessage.reactions.cache.get("🎉");
      if (!reaction) {
        channel.send(
          `${emojis.bot.error} | Çekiliş sona erdi ama hiç katılım olmadı: **${giveaway.prize}** 😢`
        );
        giveaway.ended = true;
        await db.set(`cekilisler_${message.guild.id}`, storedGiveaways);
        return;
      }

      const users = await reaction.users.fetch();
      const participants = users.filter((u) => !u.bot).map((u) => u.id);
      if (participants.length === 0) {
        channel.send(
          `${emojis.bot.error} | Üzgünüm~ hiç katılan yokmuş: **${giveaway.prize}** 😭`
        );
        giveaway.ended = true;
        await db.set(`cekilisler_${message.guild.id}`, storedGiveaways);
        return;
      }

      const winners = [];
      while (winners.length < giveaway.winnerCount && participants.length > 0) {
        const randIndex = Math.floor(Math.random() * participants.length);
        winners.push(participants.splice(randIndex, 1)[0]);
      }

      giveaway.winners = winners;
      giveaway.ended = true;
      await db.set(`cekilisler_${message.guild.id}`, storedGiveaways);

      const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
      const endEmbed = new MessageEmbed()
        .setTitle("🎉 Çekiliş Sona Erdi! 🎉")
        .setDescription(
          `Ödül: **${giveaway.prize}**\nKazananlar: ${winnerMentions}`
        )
        .setColor("BLUE")
        .setTimestamp();

      channel.send({
        content: `${emojis.bot.succes} | Tebrikler ${winnerMentions}! 🥳`,
        embeds: [endEmbed],
      });
    }, duration);
  }

  else if (subcommand === "bitir") {
    const messageId = args[1];
    if (!messageId)
      return message.reply(
        `${emojis.bot.error} | Bir mesaj ID girmen gerekiyor~`
      );

    const giveaways = (await db.get(`cekilisler_${message.guild.id}`)) || [];
    const giveaway = giveaways.find((g) => g.messageId === messageId);
    if (!giveaway)
      return message.reply(`${emojis.bot.error} | Bu ID ile çekiliş bulunamadı 😖`);
    if (giveaway.ended)
      return message.reply(`${emojis.bot.error} | Çekiliş zaten sona ermiş~`);

    const channel = message.guild.channels.cache.get(giveaway.channelId);
    if (!channel)
      return message.reply(`${emojis.bot.error} | Çekiliş kanalı bulunamadı 😢`);

    const giveawayMessage = await channel.messages
      .fetch(messageId)
      .catch(() => null);
    if (!giveawayMessage)
      return message.reply(`${emojis.bot.error} | Çekiliş mesajı bulunamadı 😭`);

    const reaction = giveawayMessage.reactions.cache.get("🎉");
    if (!reaction)
      return message.reply(`${emojis.bot.error} | Çekilişe katılım yok :c`);

    const users = await reaction.users.fetch();
    const participants = users.filter((u) => !u.bot).map((u) => u.id);
    if (participants.length === 0)
      return message.reply(`${emojis.bot.error} | Üzgünüm, kimse katılmamış 😿`);

    const winners = [];
    while (winners.length < giveaway.winnerCount && participants.length > 0) {
      const randIndex = Math.floor(Math.random() * participants.length);
      winners.push(participants.splice(randIndex, 1)[0]);
    }

    giveaway.winners = winners;
    giveaway.ended = true;
    await db.set(`cekilisler_${message.guild.id}`, giveaways);

    const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
    const endEmbed = new MessageEmbed()
      .setTitle("🎉 Çekiliş Sona Erdi! 🎉")
      .setDescription(
        `Ödül: **${giveaway.prize}**\nKazananlar: ${winnerMentions}`
      )
      .setColor("BLUE")
      .setTimestamp();

    channel.send({
      content: `${emojis.bot.succes} | Tebrikler ${winnerMentions}! 🎊`,
      embeds: [endEmbed],
    });

    message.reply(`${emojis.bot.succes} | Çekiliş başarıyla bitirildi! 🏆`);
  }

  else if (subcommand === "iptal") {
    const messageId = args[1];
    if (!messageId)
      return message.reply(`${emojis.bot.error} | Mesaj ID girmen lazım~`);

    const giveaways = (await db.get(`cekilisler_${message.guild.id}`)) || [];
    const index = giveaways.findIndex((g) => g.messageId === messageId);

    if (index === -1)
      return message.reply(`${emojis.bot.error} | Bu ID ile çekiliş bulunamadı 😿`);

    if (giveaways[index].ended)
      return message.reply(
        `${emojis.bot.error} | Çekiliş zaten sona ermiş~ iptal edilemez`
      );

    const channel = message.guild.channels.cache.get(giveaways[index].channelId);
    if (channel) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) await msg.delete().catch(() => {});
    }

    giveaways.splice(index, 1);
    await db.set(`cekilisler_${message.guild.id}`, giveaways);

    message.reply(`${emojis.bot.succes} | Çekiliş iptal edildi~ 😌`);
  }

  else if (subcommand === "liste") {
    const giveaways = (await db.get(`cekilisler_${message.guild.id}`)) || [];
    if (giveaways.length === 0)
      return message.reply(`${emojis.bot.error} | Sunucuda aktif çekiliş yok~`);

    const embed = new MessageEmbed()
      .setTitle("🎉 Aktif Çekilişler")
      .setColor("YELLOW")
      .setDescription(
        giveaways
          .map(
            (g) =>
              `• Ödül: **${g.prize}**\n  Mesaj ID: \`${g.messageId}\`\n  Bitiş: ${formatDate(
                new Date(g.endTime)
              )}\n  Kazanan Sayısı: ${g.winnerCount}\n  Durum: ${
                g.ended ? "Bitti 😵" : "Devam Ediyor 😎"
              }`
          )
          .join("\n\n")
      );

    message.channel.send({ embeds: [embed] });
  }
};
