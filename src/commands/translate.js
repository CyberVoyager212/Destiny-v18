const translate = require("translate-google");
const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "translate",
  aliases: ["çeviri", "tercüme", "tr"],
  usage: "translate <hedef-dil-kodu> <metin>",
  description: "Metni istediğin dile çevirir.",
  category: "Araçlar",
  cooldown: 5,
  permissions: [],
  examples: [
    "translate TR Hello world",
    "translate EN Merhaba dünya",
  ],
  extraFields: [
    {
      name: "Desteklenen Dil Kodları",
      value:
        "`TR` - Türkçe | `EN` - İngilizce | `DE` - Almanca | `FR` - Fransızca\n" +
        "`ES` - İspanyolca | `IT` - İtalyanca | `NL` - Flemenkçe | `PL` - Lehçe\n" +
        "`PT` - Portekizce | `RU` - Rusça | `JA` - Japonca | `KO` - Korece\n" +
        "`ZH` - Çince (Basit.) | `ZH_TW` - Çince (Gel.) | `AR` - Arapça\n" +
        "`SV` - İsveççe | `NO` - Norveççe | `DA` - Danca | `FI` - Fince | `CS` - Çekçe",
      inline: false,
    },
  ],
};

const languageCodes = {
  EN: "İngilizce",
  TR: "Türkçe",
  DE: "Almanca",
  FR: "Fransızca",
  ES: "İspanyolca",
  IT: "İtalyanca",
  NL: "Flemenkçe",
  PL: "Lehçe",
  PT: "Portekizce",
  RU: "Rusça",
  JA: "Japonca",
  ZH: "Çince (Basitleştirilmiş)",
  ZH_TW: "Çince (Geleneksel)",
  KO: "Korece",
  AR: "Arapça",
  SV: "İsveççe",
  NO: "Norveççe",
  DA: "Danca",
  FI: "Fince",
  CS: "Çekçe",
};

exports.execute = async (client, message, args) => {
  try {
    if (!args.length) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen hedef dil kodunu ve çevrilecek metni girin~ Örnek: \`translate TR Hello world\``
      );
    }

    const targetLang = args.shift().toLowerCase();
    const text = args.join(" ");

    if (!languageCodes[targetLang.toUpperCase()]) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, geçersiz dil kodu girilmiş~ Desteklenen kodları öğrenmek için \`help translate\` yazın.`
      );
    }

    if (!text) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, çevrilecek metni girmeniz gerekiyor~`
      );
    }

    const res = await translate(text, { to: targetLang });

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} Çeviri Başarılı!`)
      .addFields(
        { name: "📥 Orijinal", value: text },
        { name: "📤 Çevrilen", value: res },
        { name: "🌍 Dil", value: `${targetLang.toUpperCase()}` }
      )
      .setColor("#00FF00")
      .setFooter({ text: message.member.displayName })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, çeviri yapılırken bir hata oluştu qwq~ Lütfen tekrar deneyin!`
    );
  }
};
