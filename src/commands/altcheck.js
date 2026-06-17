const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "altcheck",
  aliases: [],
  usage: "altcheck <@kullanıcı|id|isim> [başka...]",
  description:
    "Kullanıcıların hesap oluşturma ve sunucuya katılma tarihlerini gösterir, güvenli olup olmadıklarına dair basit bir tahminde bulunur.",
  category: "Moderasyon",
  cooldown: 5,
  permissions: ["MODERATE_MEMBERS"],
};

exports.execute = async (client, message, args) => {
  try {
    if (!args.length)
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen kontrol etmek istediğin kullanıcı(ları) belirt~ ⏱`
      );

    for (const target of args) {
      const member =
        message.mentions.members.first() ||
        message.guild.members.cache.get(target) ||
        message.guild.members.cache.find(
          (m) => m.user.username === target
        );

      if (!member) {
        message.channel.send(
          `${emojis.bot.error} | "${target}" bulunamadı~ 😢`
        );
        continue;
      }

      const {
        user,
        joinedAt,
        user: { createdAt },
      } = member;
      const diff = Date.now() - createdAt.getTime();
      const güven = diff > 1000 * 60 * 60 * 24 * 30 ? "Güvenli" : "Şüpheli";

      const embed = new MessageEmbed()
        .setTitle(`${emojis.bot.succes} | ${user.tag} İncelemesi`)
        .addField("Hesap Açılış", createdAt.toUTCString(), true)
        .addField("Sunucu Katılma", joinedAt.toUTCString(), true)
        .addField("Durum", güven, true)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor(güven === "Güvenli" ? "#00FF00" : "#FF9900")
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("altcheck komutu hata:", err);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, altcheck komutu çalışırken bir hata oluştu~ 😢 Lütfen tekrar dene!`
    );
  }
};
