const { MessageActionRow, MessageButton } = require("discord.js");
const emojis = require("../emoji.json");

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

exports.execute = async (client, message, args) => {
  try {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!member)
      return message.channel.send(`${emojis.bot.error} | **${message.member.displayName}**, lütfen kişiyi etiketleyin veya ID'sini girin~`);

    let amount = args[1];
    if (!amount || isNaN(amount) || amount <= 0)
      return message.channel.send(`${emojis.bot.error} | Geçerli pozitif bir miktar girin pls~`);

    amount = Math.floor(amount);

    const authordata = (await client.db.get(`money_${message.author.id}`)) || 0;
    const loanData = (await client.db.get(`loan_${message.author.id}`)) || { amount: 0 };

    if (loanData.amount > 0)
      return message.channel.send(`${emojis.bot.error} | Borcunuz varken transfer yapamazsınız qwq~ Önce ödeyin lütfen.`);

    if (authordata < amount)
      return message.channel.send(`${emojis.bot.error} | Bakiye yetersiz~`);

    await client.db.add(`money_${member.id}`, amount);
    await client.db.add(`money_${message.author.id}`, -amount);

    const emoji = chooseEmoji(amount);

    const row = new MessageActionRow().addComponents(
      new MessageButton().setCustomId("confirm").setLabel("Onayla ✅").setStyle("SUCCESS"),
      new MessageButton().setCustomId("cancel").setLabel("İptal et ❌").setStyle("DANGER")
    );

    const sentMessage = await message.channel.send({
      content: `${emojis.bot.succes} | **${message.member.displayName}**, ${emoji} **${amount}** miktarı **${member.user.tag}**'ye transfer edildi! Onaylamak için ✅, iptal için ❌ butonuna tıkla~`,
      components: [row],
    });

    const filter = (i) => i.user.id === message.author.id;
    const collector = sentMessage.createMessageComponentCollector({ filter, time: 15000 });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "confirm") {
        await interaction.reply({ content: `${emojis.bot.succes} | Transfer başarıyla onaylandı! 🎉`, ephemeral: true });
      } else if (interaction.customId === "cancel") {
        await client.db.add(`money_${member.id}`, -amount);
        await client.db.add(`money_${message.author.id}`, amount);
        await interaction.reply({ content: `${emojis.bot.error} | Transfer iptal edildi qwq~`, ephemeral: true });
      }
      collector.stop();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        message.channel.send(`${emojis.bot.error} | ⏱ Süre doldu, transfer işlemi onaylanmadı~`);
        client.db.add(`money_${member.id}`, -amount);
        client.db.add(`money_${message.author.id}`, amount);
      }
    });
  } catch (error) {
    console.error(error);
    return message.channel.send(`${emojis.bot.error} | Bir hata oluştu qwq~ lütfen tekrar dene.`);
  }
};

exports.help = {
  name: "transfer",
  aliases: ["give", "share"],
  description: "Belirtilen kullanıcıya para transfer eder. Borcunuz varsa yapamazsınız.",
  usage: "transfer <üye> <miktar>",
  category: "Ekonomi",
  cooldown: 5,
};
