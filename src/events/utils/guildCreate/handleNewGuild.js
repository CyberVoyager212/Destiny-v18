const { MessageEmbed, Permissions } = require("discord.js");
const botConfig = require("../../../botConfig.js");

module.exports = async (client, guild) => {
  const toplamSunucu = client.guilds.cache.size;
  const toplamKullanici = client.users.cache.size;
  const botPrefix = botConfig.prefix; 
  const supportServer = botConfig.supportServer; 

  const EmbedGiris = new MessageEmbed()
    .setColor("GREEN")
    .setTitle(`✅ Yeni Bir Sunucuya Katıldım!`)
    .setDescription(
      `
**📌 Sunucu Bilgileri:**  
🏠 **Sunucu Adı:** ${guild.name}  
👑 **Sahibi:** <@${guild.ownerId}>  
👥 **Üye Sayısı:** ${guild.memberCount}  
🗺️ **Sunucu Bölgesi:** ${guild.preferredLocale || "Bilinmiyor"}  
🆔 **Sunucu ID:** ${guild.id}  

**🌍 Genel Bilgiler:**  
🔢 **Toplam Sunucu Sayım:** ${toplamSunucu}  
🧑‍🤝‍🧑 **Toplam Kullanıcı Sayım:** ${toplamKullanici}  
🛠️ **Prefixim:** \`${botPrefix}\`  
🤖 **Bot Sahibi:** <@${client.config?.ownerId}>

**💡 Öneriler:**  
- \`${botPrefix}help\` yazarak tüm komutlarımı görebilirsiniz.  
- Destek almak için botun [resmi destek sunucusuna](${supportServer}) katılabilirsiniz! 🚀
    `
    )
    .setThumbnail(
      guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
    )
    .setFooter({
      text: "Beni eklediğiniz için teşekkürler! 🚀",
      iconURL: client.user.displayAvatarURL(),
    })
    .setTimestamp();

  try {
    let helpKanal = guild.channels.cache.find(
      (ch) => ch.name === "help" && ch.type === "GUILD_TEXT"
    );

    if (!helpKanal) {
      helpKanal = await guild.channels.create("help", {
        type: "GUILD_TEXT",
        topic: "Botun kullanım rehberi ve destek kanalı",
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [
              Permissions.FLAGS.VIEW_CHANNEL,
              Permissions.FLAGS.SEND_MESSAGES,
              Permissions.FLAGS.READ_MESSAGE_HISTORY,
            ],
          },
        ],
      });
    }

    if (helpKanal) {
      helpKanal.send({ embeds: [EmbedGiris] });
    }
  } catch (hata) {
    console.error(
      "❌ Help kanalı oluşturulamadı veya mesaj gönderilemedi:",
      hata
    );
  }

  try {
    const logKanal = await client.channels.fetch(botConfig.logChannelId);
    if (logKanal) {
      logKanal.send({ embeds: [EmbedGiris] });
    }
  } catch (hata) {
    console.error("❌ Log kanalına mesaj gönderilemedi:", hata);
  }
};
