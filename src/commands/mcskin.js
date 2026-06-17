const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.execute = async (client, message, args) => {
  const name = args.join(" ");

  if (!name) {
    const errorEmbed = new MessageEmbed()
      .setColor("#ff0000")
      .setDescription(`${emojis.bot.error} | **${message.member.displayName}**, lütfen skinini görmek istediğin Minecraft oyuncusunun adını belirtir misin? UwU 🎮`);

    return message.channel.send({ embeds: [errorEmbed] });
  }

  try {
    const skinUrl = `https://minotar.net/armor/body/${name}/700.png`;
    
    const response = await fetch(skinUrl, { method: 'HEAD' });
    
    if (!response.ok || response.status !== 200) {
      throw new Error("Skin bulunamadı");
    }

    const skinEmbed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`🎮 ${name}'ın Skin'i 🎮`)
      .setImage(skinUrl)
      .setDescription(`İşte ${name} adlı oyuncunun skin'i! Harika bir skin seçmiş ^w^`)
      .setFooter("Minecraft skinini görüntülediniz.");

    message.channel.send({ embeds: [skinEmbed] });
  } catch (error) {
    const errorEmbed = new MessageEmbed()
      .setColor("#ff0000")
      .setDescription(`${emojis.bot.error} | **${message.member.displayName}**, aradığın Minecraft skini bulunamadı 😢 Belki yanlış yazdın? Oyuncu adını kontrol edip tekrar dene~`);

    message.channel.send({ embeds: [errorEmbed] });
  }
};

exports.help = {
  name: "mcskin",
  aliases: ["skin"],
  usage: "mcskin <oyuncu adı>",
  description: "Belirtilen Minecraft oyuncusunun skin'ini görüntüler.",
  category: "Eğlence",
  cooldown: 10
};