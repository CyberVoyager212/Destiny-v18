const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "bot-aktiflik",
  aliases: ["ba", "aktiflik"],
  usage: "bot-aktiflik",
  description: "Botun aktiflik durumunu gösterir.",
  category: "Bot",
  cooldown: 5,
};

exports.execute = async (client, message, args) => {
  try {
    const uptime = client.uptime;

    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);

    const timeParts = [];
    if (days > 0) timeParts.push(`**${days}** gün`);
    if (hours > 0) timeParts.push(`**${hours}** saat`);
    if (minutes > 0) timeParts.push(`**${minutes}** dakika`);
    
    if (seconds > 0 || timeParts.length === 0) {
      timeParts.push(`**${seconds}** saniyedir`);
    } else {
      timeParts[timeParts.length - 1] += "dir";
    }

    const uptimeString = timeParts.join(", ");

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | ${client.user.username} Aktiflik Bilgisi`)
      .setColor("#5865F2")
      .setDescription(`Bot ${uptimeString} aktif~ ⏱`)
      .setFooter({
        text: `İsteyen: ${
          message.member ? message.member.displayName : message.author.username
        }`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("bot-aktiflik komutu hata:", err);
    
    const displayName = message.member ? message.member.displayName : message.author.username;
    return message.channel.send(
      `${emojis.bot.error} | **${displayName}**, botun aktiflik bilgisini alırken bir hata oluştu~ 😢 Lütfen tekrar dene!`
    );
  }
};