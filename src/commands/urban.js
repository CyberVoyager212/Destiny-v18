const { MessageEmbed } = require("discord.js");
const axios = require("axios");
const translate = require("translate-google");
const emojis = require("../emoji.json");

exports.execute = async (client, message, args) => {
  let query = args.join(" ");

  if (!query) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, lütfen aramak istediğin kelimeyi gir~ :c`
    );
  }

  let translatedQuery;
  try {
    translatedQuery = await translate(query, { from: "tr", to: "en" });
  } catch (err) {
    console.error("Çeviri hatası:", err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, kelime çevrilemedi~ Lütfen tekrar dene :c`
    );
  }

  try {
    const { data } = await axios.get(
      `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(
        translatedQuery
      )}`
    );

    if (!data.list.length) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, bu kelime için tanım bulunamadı~`
      );
    }

    const answer = data.list[0];

    let definitionTr = answer.definition;
    let exampleTr = answer.example;

    try {
      definitionTr = await translate(definitionTr, { from: "en", to: "tr" });
    } catch {
      definitionTr = answer.definition;
    }

    try {
      exampleTr = await translate(exampleTr, { from: "en", to: "tr" });
    } catch {
      exampleTr = answer.example;
    }

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} ${query}`)
      .setURL(answer.permalink)
      .setColor("#5865F2")
      .addFields(
        { name: "📖 Tanım (TR)", value: trim(definitionTr) },
        { name: "✍️ Örnek (TR)", value: trim(exampleTr) },
        {
          name: "👍 Beğeniler",
          value: `👍 ${answer.thumbs_up} || 👎 ${answer.thumbs_down}`,
        }
      )
      .setFooter({
        text: `Sorgulayan: ${message.member.displayName}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Urban Dictionary Hata:", error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, bir hata oluştu~ Lütfen daha sonra tekrar dene :c`
    );
  }
};

function trim(input) {
  return input.length > 1024 ? `${input.slice(0, 1020)} ...` : input;
}

exports.help = {
  name: "urban",
  aliases: ["ud", "kelime"],
  usage: "urban <kelime>",
  description:
    "Urban Dictionary'den bir kelimenin tanımını getirir. Türkçe kelime yazabilirsiniz, anlamı ve örneği Türkçeye çevrilir.",
  category: "Eğlence",
  cooldown: 5,
};
