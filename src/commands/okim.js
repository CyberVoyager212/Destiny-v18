const { MessageEmbed } = require("discord.js");
const moment = require("moment");
const emojis = require("../emoji.json");

const status = {
  online: "Çevrimiçi",
  idle: "Boşta",
  dnd: "Rahatsız Etmeyin",
  offline: "Çevrimdışı/Görünmez",
};

exports.execute = async (client, message, args) => {
  if (!message.guild) return;

  const member =
    message.mentions.members.first() ||
    message.guild.members.cache.get(args[0]) ||
    message.member;

  const presenceStatus = member.presence
    ? status[member.presence.status] || "Bilinmiyor"
    : "Durum yok";

  const perms = member.permissions.toArray();
  const permissionNames = {
    ADMINISTRATOR: "Yönetici",
    KICK_MEMBERS: "Üyeleri At",
    BAN_MEMBERS: "Üyeleri Yasakla",
    MANAGE_CHANNELS: "Kanalları Yönet",
    MANAGE_GUILD: "Sunucuyu Yönet",
    MANAGE_MESSAGES: "Mesajları Yönet",
    MANAGE_ROLES: "Rolleri Yönet",
    MANAGE_NICKNAMES: "Takma Adları Yönet",
    MANAGE_WEBHOOKS: "Webhook'ları Yönet",
    MANAGE_EMOJIS_AND_STICKERS: "Emojileri ve Çıkartmaları Yönet",
    MENTION_EVERYONE: "Herkesi Etiketle",
    VIEW_AUDIT_LOG: "Denetim Kayıtlarını Görüntüle",
    VIEW_CHANNEL: "Kanalları Görüntüle",
    SEND_MESSAGES: "Mesaj Gönder",
    READ_MESSAGE_HISTORY: "Mesaj Geçmişini Oku",
  };

  let userPerms = perms.map((perm) => permissionNames[perm]).filter(Boolean);
  if (userPerms.length === 0) userPerms = ["Özel izin yok veya görünür değil"];

  const roles =
    member.roles.cache
      .filter((r) => r.id !== message.guild.id)
      .map((r) => r.toString())
      .join(" **|** ") || "Rol Yok";

  const accountAge = moment.duration(
    moment().diff(moment(member.user.createdAt))
  );
  const accountAgeString = `${accountAge.years()} yıl, ${accountAge.months()} ay, ${accountAge.days()} gün önce oluşturulmuş`;

  const joinedAt = moment(member.joinedAt).format("LLLL");
  const isOwner = member.id === message.guild.ownerId;

  const embed = new MessageEmbed()
    .setColor("#2F3136")
    .setAuthor({
      name: `${member.user.tag}`,
      iconURL: member.user.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: "🆔 Kullanıcı ID", value: member.id, inline: true },
      {
        name: "📅 Hesap Oluşturulma Tarihi",
        value: `${member.user.createdAt.toLocaleString()} (${accountAgeString})`,
        inline: true,
      },
      { name: "📥 Sunucuya Katılma Tarihi", value: joinedAt, inline: true },
      { name: "💬 Durum", value: presenceStatus, inline: true },
      { name: `🏷️ Roller [${member.roles.cache.size - 1}]`, value: roles },
      { name: "⚙️ İzinler", value: userPerms.join(" | ") },
      {
        name: "👑 Sunucu Sahibi",
        value: isOwner ? "Evet" : "Hayır",
        inline: true,
      }
    )
    .setFooter({
      text: `Komutu kullanan: ${message.member.displayName}`,
      iconURL: message.author.displayAvatarURL(),
    })
    .setTimestamp();

  try {
    return message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Whois komutu hata:", err);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, uf! Kullanıcı bilgilerini getirirken bir sorun çıktı... tekrar dene >.<`
    );
  }
};

exports.help = {
  name: "whois",
  aliases: ["ui", "userinfo"],
  usage: "whois <@üye veya üyeID>",
  description: "Belirtilen kullanıcının detaylı bilgilerini gösterir.",
  category: "Moderasyon",
  cooldown: 10,
  permissions: ["MANAGE_MESSAGES"],
};
