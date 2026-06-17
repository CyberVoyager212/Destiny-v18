const { MessageEmbed } = require("discord.js");
const fetch = require("node-fetch");
const translate = require("translate-google");
const emojis = require("../emoji.json");

module.exports = {
  name: "ülke",
  description: "Girilen ülke hakkında detaylı bilgi verir.",
  aliases: ["ulke", "ülkebilgi", "country"],
  usage: "ülke <ülke adı>",
  category: "Eğlence",
  cooldown: 5,

  execute: async (client, message, args) => {
    const girilenUlke = args.join(" ");
    if (!girilenUlke)
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen bir ülke adı girin~ Örnek: \`ülke almanya\``
      );

    let ulkeEn;
    try {
      ulkeEn = await translate(girilenUlke, { from: "tr", to: "en" });
    } catch (e) {
      console.error("Ülke adı çevirilemedi:", e);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, ülke adı çevrilemedi~ Lütfen tekrar deneyin!`
      );
    }

    const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(
      ulkeEn
    )}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, ülke bulunamadı~ Doğru yazdığınızdan emin olun!`
        );
      }

      const data = await response.json();
      const info = data[0];

      const bayrak = info.flags?.png || "https://via.placeholder.com/150";

      let bolgeTr = info.subregion || info.region;
      try {
        bolgeTr = await translate(bolgeTr, { from: "en", to: "tr" });
      } catch {}

      let baskentTr = info.capital ? info.capital[0] : "Bilgi yok";
      try {
        if (baskentTr !== "Bilgi yok") {
          baskentTr = await translate(baskentTr, { from: "en", to: "tr" });
        }
      } catch {}

      let paraBirimiTr =
        Object.values(info.currencies || {})[0]?.name || "Bilgi yok";
      try {
        if (paraBirimiTr !== "Bilgi yok") {
          paraBirimiTr = await translate(paraBirimiTr, { from: "en", to: "tr" });
        }
      } catch {}

      let dillerTr = "Bilinmiyor";
      try {
        const languageList = Object.values(info.languages || {});
        if (languageList.length > 0) {
          dillerTr = await translate(languageList.join(", "), {
            from: "en",
            to: "tr",
          });
        }
      } catch {
        dillerTr =
          Object.values(info.languages || {}).join(", ") || "Bilinmiyor";
      }

      const embed = new MessageEmbed()
        .setColor("#2ecc71")
        .setTitle(`${emojis.bot.succes} ${info.name.common}`)
        .setThumbnail(bayrak)
        .setFooter({
          text: `Sorgulayan: ${message.member.displayName}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp()
        .addFields(
          {
            name: "🌍 Yerel İsim",
            value: `\`\`\`${
              info.translations?.tur?.common || info.name.common
            }\`\`\``,
            inline: true,
          },
          {
            name: "🏛 Başkent",
            value: `\`\`\`${baskentTr}\`\`\``,
            inline: true,
          },
          {
            name: "📍 Bölge",
            value: `\`\`\`${bolgeTr}\`\`\``,
            inline: true,
          },
          {
            name: "💰 Para Birimi",
            value: `\`\`\`${paraBirimiTr}\`\`\``,
            inline: true,
          },
          {
            name: "👥 Nüfus",
            value: `\`\`\`${info.population.toLocaleString("tr-TR")}\`\`\``,
            inline: true,
          },
          {
            name: "🗺 Yüzölçümü",
            value: `\`\`\`${info.area.toLocaleString("tr-TR")} km²\`\`\``,
            inline: true,
          },
          {
            name: "🗣 Konuşulan Diller",
            value: `\`\`\`${dillerTr}\`\`\``,
          }
        );

      return message.channel.send({ embeds: [embed] });
    } catch (e) {
      console.error("API hatası:", e);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, bilgiler alınırken bir hata oluştu~ Lütfen tekrar deneyin!`
      );
    }
  },
};

module.exports.help = {
  name: "ülke",
  description:
    "Girdiğiniz ülkenin başkentinden nüfusuna kadar birçok bilgisini gösterir.",
  usage: "ülke <ülke adı>",
  aliases: ["ulke", "ülkebilgi", "country"],
  category: "Eğlence",
  cooldown: 5,
};
