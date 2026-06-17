const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.execute = async (client, message, args) => {
  if (!args.length) {
    return message.reply(
      `${emojis.bot.error} | Hımm~ geçerli bir işlem belirtmedin, **${message.member.displayName}**! Lütfen \`aç\` veya \`kapat\` alt komutunu kullanın. Yardım için \`help gelengidensistemi\` yazabilirsin~`
    );
  }

  const subCommand = args.shift().toLowerCase();
  if (subCommand === "kapat") {
    try {
      await client.db.delete(`welcomegoodbye_${message.guild.id}`);
      return message.channel.send(
        `${emojis.bot.succes} | Gelen-Çıkış sistemi başarıyla devre dışı bırakıldı~ huzurla uyuyabilirsin ^^`
      );
    } catch (err) {
      console.error(err);
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, bir şeyler yanlış gitti~ Ayarları silerken hata oldu :c\n\`\`\`js\n${String(err).slice(0, 1000)}\n\`\`\``
      );
    }
  } else if (subCommand !== "aç") {
    return message.channel.send(
      `${emojis.bot.error} | Geçersiz alt komut kullandın~ Lütfen \`aç\` veya \`kapat\` kullan :3`
    );
  }

  const fullArgs = args.join(" ");
  const parts = fullArgs
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 4) {
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, eksik bilgi var~ Lütfen: \`<#gelenkanal> ; <#gidenkanal> ; giriş mesajı ; çıkış mesajı [; otorol ...] [; otoisim ...]\` şeklinde gir :c`
    );
  }

  const incomingChannelParam = parts[0];
  const outgoingChannelParam = parts[1];
  const entryMessage = parts[2];
  const exitMessage = parts[3];

  function resolveChannel(param) {
    let channel = null;
    const idMatch = param.match(/^<#(\d+)>$/);
    if (idMatch) channel = message.guild.channels.cache.get(idMatch[1]);
    if (!channel) channel = message.guild.channels.cache.get(param);
    if (!channel)
      channel = message.guild.channels.cache.find(
        (ch) => ch.name === param.replace("#", "")
      );
    return channel;
  }

  const incomingChannel = resolveChannel(incomingChannelParam);
  if (!incomingChannel)
    return message.channel.send(
      `${emojis.bot.error} | Gelen kanal bulunamadı~ Kanalı doğru yazdığından emin ol :c`
    );

  const outgoingChannel = resolveChannel(outgoingChannelParam);
  if (!outgoingChannel)
    return message.channel.send(
      `${emojis.bot.error} | Giden kanal bulunamadı~ Kanal parametresini kontrol et lütfen :3`
    );

  let otorolConfig = {};
  let otoisimConfig = {};

  for (let i = 4; i < parts.length; i++) {
    const part = parts[i];
    const lowerPart = part.toLowerCase();
    if (lowerPart.startsWith("otorol")) {
      const tokens = part.split(" ").filter((t) => t.trim() !== "");
      if (tokens.length < 3) continue;
      const type = tokens[1].toLowerCase();
      const roles = tokens.slice(2);
      roles.forEach((roleStr) => {
        let role = null;
        const roleIdMatch = roleStr.match(/^<@&(\d+)>$/);
        if (roleIdMatch) role = message.guild.roles.cache.get(roleIdMatch[1]);
        if (!role) {
          role =
            message.guild.roles.cache.get(roleStr) ||
            message.guild.roles.cache.find(
              (r) => r.name.toLowerCase() === roleStr.toLowerCase()
            );
        }
        if (role) {
          if (!otorolConfig[type]) otorolConfig[type] = [];
          otorolConfig[type].push(role.id);
        }
      });
    } else if (lowerPart.startsWith("otoisim")) {
      const tokens = part.split(" ").filter((t) => t.trim() !== "");
      if (tokens.length < 3) continue;
      const type = tokens[1].toLowerCase();
      const name = tokens.slice(2).join(" ");
      otoisimConfig[type] = name;
    }
  }

  let inviteTracking = false;
  if (entryMessage.includes("$davet") || exitMessage.includes("$davet")) {
    inviteTracking = true;
  }

  const configData = {
    incomingChannel: incomingChannel.id,
    outgoingChannel: outgoingChannel.id,
    entryMessage: entryMessage,
    exitMessage: exitMessage,
    otorol: otorolConfig,
    otoisim: otoisimConfig,
    inviteTracking: inviteTracking,
    enabled: true,
  };

  try {
    await client.db.set(`welcomegoodbye_${message.guild.id}`, configData);
    return message.channel.send(
      `${emojis.bot.succes} | Gelen-Çıkış sistemi başarıyla ayarlandı~ Yeni misafirleri güzelce karşıla :3`
    );
  } catch (err) {
    console.error(err);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, ayarları kaydederken uğraştım ama hata çıktı~ Biraz sonra tekrar dene lütfen :c\n\`\`\`js\n${String(err).slice(0, 1000)}\n\`\`\``
    );
  }
};

exports.help = {
  name: "gelengidensistemi",
  aliases: ["ggs"],
  usage: "gelengidensistemi aç/kapat <kanal parametreleri> ; <mesaj parametreleri> ; [otorol <tür> @rol ...] ; [otoisim <tür> <isim> ...]",
  description: "Giriş/Çıkış sistemini ayarlar. aç ve kapat olmak üzere 2 alt komuttan oluşur.",
  category: "Moderasyon",
  cooldown: 3,
  permissions: ["MANAGE_GUILD"],
  examples: [
    "ggs aç #ggs  ; #ggs  ; Merhaba $etiket senle beraber $sayı kişi olduk ; Görüşürüz $etiket ; otorol kullanıcı @Members",
    "ggs kapat",
  ],
  extraFields: [
    {
      name: "Değişkenler",
      value:
        "`$etiket`: Katılan/ayrılan kullanıcıyı etiketler.\n" +
        "`$sayı`: Güncel sunucu üye sayısını gösterir.\n" +
        "`$katılım`: Kullanıcının Discord'a katılım tarihini gösterir.\n" +
        "`$davet`: Üyeyi davet eden kişiyi ve davet sayısını gösterir.\n" +
        "`$embed;başlık`: Mesajı embed olarak gönderir.",
      inline: false,
    },
    {
      name: "Ek Özellikler",
      value:
        "`otorol <tür> @rol`: Katılınca verilecek rol (tür: `kullanıcı` veya `bot`).\n" +
        "`otoisim <tür> isim`: Katılınca ayarlanacak isim (tür: `kullanıcı` veya `bot`).",
      inline: false,
    },
  ],
};
