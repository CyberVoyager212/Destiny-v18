const { MessageEmbed } = require("discord.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "vip",
  aliases: [],
  usage: "vip <tanımla|sil|liste> [kullanıcı] [süre (örn: 5g, 5s, 5h)]",
  description: "VIP kullanıcı ekleme, silme ve listeleme işlemlerini yapar.",
  category: "Bot",
  admin: true,
  cooldown: 5,
  permissions: [],
  examples: [
    "vip tanımla @User 5g",
    "vip tanımla 123456789012345678 12s",
    "vip sil @User",
    "vip liste"
  ],
  extraFields: [
    {
      name: "Alt Komutlar",
      value:
        "`tanımla`: Belirtilen kullanıcıyı belirtilen süre kadar VIP yapar.\n" +
        "`sil`: Belirtilen kullanıcının VIP kaydını siler.\n" +
        "`liste`: Tüm aktif VIP kullanıcılarını listeler.",
      inline: false,
    },
    {
      name: "Süre Formatı",
      value:
        "`g`: Gün (Örn: `5g`)\n" +
        "`s`: Saat (Örn: `3s`)\n" +
        "`h`: Hafta (Örn: `1h`)",
      inline: false,
    }
  ]
};

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(g|s|h)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const msInHour = 60 * 60 * 1000;
  const msInDay = 24 * msInHour;
  const msInWeek = 7 * msInDay;
  
  if (unit === 's') return value * msInHour;
  if (unit === 'g') return value * msInDay;
  if (unit === 'h') return value * msInWeek;
  return null;
}

exports.execute = async (client, message, args = []) => {
  const prefix = client.config?.prefix || "";
  const ownerId = client.config?.ownerId || "";
  const admins = client.config?.admins || [];
  
  const isOwner = message.author.id === ownerId;
  const isAdmin = admins.includes(message.author.id);
  
  if (!isOwner && !isAdmin) {
    return message.reply(`${emojis.bot.error} Bu komutu kullanmak için yetkiniz yok.`);
  }

  const sub = args[0]?.toLowerCase();
  if (!["tanımla", "sil", "liste", "tanimla"].includes(sub)) {
    return message.reply(
      `${emojis.bot.error} Lütfen geçerli bir işlem belirtin! Kullanım: \`${prefix}vip <tanımla|sil|liste>\``
    );
  }

  const db = client.db;

  if (sub === "tanımla" || sub === "tanimla") {
    if (args.length < 3) {
      return message.reply(
        `${emojis.bot.error} Hatalı kullanım! Doğru kullanım: \`${prefix}vip tanımla <kullanıcı id / isim / etiket> <süre (örn: 5g, 5s, 5h)>\``
      );
    }

    const durationStr = args[args.length - 1];
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return message.reply(
        `${emojis.bot.error} Geçersiz süre formatı! Örnekler: \`5g\` (5 gün), \`12s\` (12 saat), \`2h\` (2 hafta).`
      );
    }

    const query = args.slice(1, -1).join(" ").trim();
    let targetUser = message.mentions.users.first();
    
    if (!targetUser && query) {
      const member = message.guild.members.cache.get(query) || 
                     message.guild.members.cache.find(m => m.user.username.toLowerCase() === query.toLowerCase() || m.displayName.toLowerCase() === query.toLowerCase());
      if (member) {
        targetUser = member.user;
      } else {
        try {
          targetUser = await client.users.fetch(query).catch(() => null);
        } catch (e) {}
      }
    }

    if (!targetUser) {
      return message.reply(
        `${emojis.bot.error} Belirtilen kullanıcı bulunamadı! Lütfen geçerli bir etiket, ID veya kullanıcı adı girin.`
      );
    }

    const expiresAt = Date.now() + durationMs;
    await db.set(`vips.${targetUser.id}`, {
      expiresAt,
      addedAt: Date.now(),
      tag: targetUser.tag
    });

    const durationLabel = durationStr
      .replace(/g/i, " gün")
      .replace(/s/i, " saat")
      .replace(/h/i, " hafta");

    const embed = new MessageEmbed()
      .setTitle("✨ VIP Tanımlandı")
      .setColor("#e1b12c")
      .setDescription(`**${targetUser.tag}** kullanıcısı başarıyla VIP yapıldı.`)
      .addField("Kullanıcı", `${targetUser} (\`${targetUser.id}\`)`, true)
      .addField("Süre", durationLabel, true)
      .addField("Bitiş Tarihi", `<t:${Math.floor(expiresAt / 1000)}:F>`, false)
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  if (sub === "sil") {
    if (args.length < 2) {
      return message.reply(
        `${emojis.bot.error} Hatalı kullanım! Doğru kullanım: \`${prefix}vip sil <kullanıcı id / isim / etiket>\``
      );
    }

    const query = args.slice(1).join(" ").trim();
    let targetUser = message.mentions.users.first();
    
    if (!targetUser && query) {
      const member = message.guild.members.cache.get(query) || 
                     message.guild.members.cache.find(m => m.user.username.toLowerCase() === query.toLowerCase() || m.displayName.toLowerCase() === query.toLowerCase());
      if (member) {
        targetUser = member.user;
      } else {
        try {
          targetUser = await client.users.fetch(query).catch(() => null);
        } catch (e) {}
      }
    }

    const targetId = targetUser?.id || query;
    const vipData = await db.get(`vips.${targetId}`);
    
    if (!vipData) {
      return message.reply(
        `${emojis.bot.error} Bu kullanıcının VIP kaydı bulunmamaktadır.`
      );
    }

    await db.delete(`vips.${targetId}`);

    const embed = new MessageEmbed()
      .setTitle("❌ VIP İptal Edildi")
      .setColor("#e84118")
      .setDescription(`**${targetUser ? targetUser.tag : targetId}** kullanıcısının VIP üyeliği sonlandırıldı.`)
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  if (sub === "liste") {
    const vips = await db.get("vips") || {};
    const entries = Object.entries(vips);
    
    if (!entries.length) {
      return message.reply("Aktif VIP kullanıcısı bulunmuyor.");
    }

    const lines = [];
    for (const [userId, data] of entries) {
      if (!data || !data.expiresAt) continue;
      const remaining = data.expiresAt - Date.now();
      if (remaining <= 0) continue;
      lines.push(`<@${userId}> (\`${userId}\`) - Bitiş: <t:${Math.floor(data.expiresAt / 1000)}:R> (<t:${Math.floor(data.expiresAt / 1000)}:F>)`);
    }

    if (!lines.length) {
      return message.reply("Aktif VIP kullanıcısı bulunmuyor.");
    }

    const embed = new MessageEmbed()
      .setTitle("👑 VIP Kullanıcı Listesi")
      .setColor("#e1b12c")
      .setDescription(lines.join("\n"))
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
};
