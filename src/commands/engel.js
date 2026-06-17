const { QuickDB } = require("quick.db");
const db = new QuickDB();
const emojis = require("../emoji.json");

exports.execute = async (client, message, args) => {
  const sub = args[0]?.toLowerCase();
  if (!["ekle", "sil", "liste"].includes(sub)) {
    return message.reply(
      `${emojis.bot.error} Hımm~ alt komut yanlış gibi görünüyor, **${message.member.displayName}**! Kullanım: \`ekle\`, \`sil\`, \`liste\``
    );
  }

  const guildKey = `mesajEngel_${message.guild.id}`;
  let all = (await db.get(guildKey)) || {};

  if (sub === "ekle") {
    const chan = message.mentions.channels.first() || message.channel;
    const list = args
      .slice(chan === message.channel ? 1 : 2)
      .join(" ")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!list.length) {
      return message.reply(
        `${emojis.bot.error} Hımm~ en az bir filtre girmelisin, **${message.member.displayName}** :c`
      );
    }

    all[chan.id] = Array.from(new Set([...(all[chan.id] || []), ...list]));
    await db.set(guildKey, all);

    return message.reply(
      `${emojis.bot.succes} Başarılı! ${chan} için filtreler kaydedildi:\n\`${all[chan.id].join("`, `")}\``
    );
  }

  if (sub === "sil") {
    const chan = message.mentions.channels.first() || message.channel;
    const cur = all[chan.id];
    if (!cur) {
      return message.reply(
        `${emojis.bot.error} Hımm~ ${chan} için herhangi bir filtre ayarlı değil, **${message.member.displayName}**.`
      );
    }

    const rem = args
      .slice(chan === message.channel ? 1 : 2)
      .join(" ")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (rem.length) {
      all[chan.id] = cur.filter((f) => !rem.includes(f));
      if (!all[chan.id].length) delete all[chan.id];
    } else {
      delete all[chan.id];
    }

    await db.set(guildKey, all);
    return message.reply(
      `${emojis.bot.succes} Tamam oldu~ ${chan} için silme işlemi başarıyla tamamlandı!`
    );
  }

  if (sub === "liste") {
    const chan = message.mentions.channels.first();
    if (chan) {
      const arr = all[chan.id];
      if (!arr) {
        return message.reply(
          `${emojis.bot.error} Hımm~ ${chan} için hiçbir filtre bulunmuyor.`
        );
      }
      return message.reply(
        `${emojis.bot.succes} ${chan} filtreleri:\n\`${arr.join("`, `")}\``
      );
    } else {
      if (!Object.keys(all).length) {
        return message.reply(
          `${emojis.bot.error} Şu an sunucuda hiç filtre ayarlı değil~`
        );
      }
      const lines = Object.entries(all)
        .map(([cid, arr]) => `<#${cid}> → \`${arr.join("`, `")}\``)
        .join("\n");
      return message.reply(
        `${emojis.bot.succes} Sunucu filtreleri:\n${lines}`
      );
    }
  }
};

exports.help = {
  name: "engel",
  aliases: ["mesaj-engel", "mesajengel", "filtre", "filter"],
  usage: "engel <ekle|sil|liste> [#kanal] [filtre1,filtre2,…]",
  description: "Kanallarda özel filtreleme sağlar.",
  category: "Moderasyon",
  cooldown: 5,
  permissions: ["MANAGE_CHANNELS"],
  examples: [
    "engel ekle #sohbet #url#",
    "engel ekle #sayilar !#sayı#",
    "engel ekle !selam",
    "engel liste",
  ],
  extraFields: [
    {
      name: "Alt Komutlar",
      value:
        "`ekle`: Kanala yeni engelleme/izin filtresi ekler.\n" +
        "`sil`: Kanaldaki filtreleri temizler.\n" +
        "`liste`: Kanaldaki veya sunucudaki filtre listesini gösterir.",
      inline: false,
    },
    {
      name: "Filtre Tipleri",
      value:
        "`#sayı#`: Sadece sayı engeller.  |  `!#sayı#`: Sadece sayılara izin verir.\n" +
        "`#kelime#`: Sadece harf engeller.  |  `!#kelime#`: Sadece harflere izin verir.\n" +
        "`#url#`: Link engeller.  |  `!#url#`: Sadece linklere izin verir.\n" +
        "`kelime`: Kelimeyi yasaklar.  |  `!kelime`: Sadece o kelimeye izin verir.",
      inline: false,
    },
  ],
};
