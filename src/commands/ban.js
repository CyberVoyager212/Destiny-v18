const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "ban",
  aliases: [],
  usage: "ban <@kullanıcı|id|isim> [sebep]",
  description:
    "Belirttiğin kullanıcıyı sunucudan yasaklar. Öncesinde DM ile detay gönderir.",
  category: "Moderasyon",
  cooldown: 5,
  permissions: ["BAN_MEMBERS"],
};

exports.execute = async (client, message, args) => {
  const target = args[0];
  const member =
    message.mentions.members.first() ||
    message.guild.members.cache.get(target) ||
    message.guild.members.cache.find((m) => m.user.username === target);
  if (!member)
    return message.reply(
      `⏱ | **${message.member.displayName}**, lütfen yasaklanacak kullanıcıyı belirt~`
    );

  const reason = args.slice(1).join(" ") || "Sebep belirtilmedi";

  try {
    const dmEmbed = new MessageEmbed()
      .setTitle(`🚫 Sunucudan Yasaklandın`)
      .setDescription(`**Sunucu:** ${message.guild.name}\n**Sebep:** ${reason}`)
      .setColor("#F04747")
      .setTimestamp();
    await member.send({ embeds: [dmEmbed] }).catch(() => {});

    await member.ban({ reason });

    const successEmbed = new MessageEmbed()
      .setDescription(`${emojis.bot.succes} | **${member.user.tag}** başarıyla banlandı!\n**Sebep:** ${reason}`)
      .setColor("#F04747")
      .setTimestamp();
    return message.channel.send({ embeds: [successEmbed] });
  } catch (error) {
    console.error(error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, ban işlemi sırasında bir sorun çıktı~ Lütfen tekrar dene :c`
    );
  }
};
