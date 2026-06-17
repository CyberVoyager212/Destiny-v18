const { MessageEmbed, MessageAttachment } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const config = require("../botConfig.js");
const emojis = require("../emoji.json");

exports.help = {
  name: "bildir",
  aliases: ["report", "şikayet"],
  usage: "bildir <metin> [fotoğraf] | bildir cevapla <id> <cevap> | bildir sil <id>",
  description: "Botla ilgili sorunlarınızı bildirir, yönetici cevaplayabilir veya raporu kapatabilir.",
  category: "Araçlar",
  cooldown: 10,
  permissions: [],
  examples: ["bildir Kumar komutunda param gitti!"],
  extraFields: [
    {
      name: "Alt Komutlar",
      value:
        "`bildir <şikayet>`: Rapor oluşturur (varsa ekteki fotoğrafı da iletir).\n" +
        "`bildir cevapla <id> <cevap>`: Yöneticiler rapora cevap yazar (kullanıcıya DM gider).\n" +
        "`bildir sil <id>`: Yöneticiler raporu kapatıp siler.",
      inline: false,
    },
  ],
};

exports.execute = async (client, message, args) => {
  const messagesToDelete = [message];
  
  try {
    const adminIds = Array.isArray(config.admins) ? config.admins : [config.admins];
    const sub = args[0]?.toLowerCase();

    if (sub === "sil") {
      if (!adminIds.includes(message.author.id))
        return message.reply(
          `${emojis.bot.error} | Üzgünüm **${message.member.displayName}**, bu işlemi sadece yönetici yapabilir~`
        );
      const id = args[1];
      if (!id)
        return message.reply(
          `${emojis.bot.error} | Hııı, kapatılacak bildirimin ID'sini yazmayı unutmuşsun~`
        );
      const report = await db.get(`report_${id}`);
      if (!report)
        return message.reply(
          `${emojis.bot.error} | Bulunamadı... Veritabanında böyle bir bildirim yok gibi gözüküyor.`
        );
      await db.delete(`report_${id}`);
      await db.delete(`report_files_${id}`);
      await db.delete(`report_responses_${id}`);
      const successMsg = await message.channel.send(
        `${emojis.bot.succes} | Tamamdır! Bildirim **${id}** başarıyla kapatıldı. Teşekkürler!`
      );
      messagesToDelete.push(successMsg);
      setTimeout(async () => {
        for (const msg of messagesToDelete) {
          await msg?.delete().catch(() => {});
        }
      }, 5000);
      return;
    }

    if (sub === "cevapla") {
      if (!adminIds.includes(message.author.id))
        return message.reply(
          `${emojis.bot.error} | Ahh, burası yönetici işi~ Bu komutu kullanamazsın.`
        );
      const id = args[1];
      const replyText = args.slice(2).join(" ");
      if (!id || !replyText)
        return message.reply(
          `${emojis.bot.error} | Kullanım yanlış gibi... Doğru kullanım: \`bildir cevapla <id> <cevap>\``
        );
      const report = await db.get(`report_${id}`);
      if (!report)
        return message.reply(
          `${emojis.bot.error} | Ooo, böyle bir bildirim bulunamadı. ID'yi kontrol eder misin?`
        );

      const responses = (await db.get(`report_responses_${id}`)) || [];
      responses.push({
        by: message.author.id,
        text: replyText,
        date: Date.now(),
      });
      await db.set(`report_responses_${id}`, responses);

      const user = await client.users.fetch(report.author).catch(() => null);
      let responseMsg;
      if (user) {
        await user
          .send(`${emojis.bot.succes} | Bildiriminiz (#${id}) için yönetici cevabı:\n${replyText}`)
          .catch(() => {});
        responseMsg = await message.channel.send(`${emojis.bot.succes} | Cevap DM ile iletildi, iş tamam!`);
      } else {
        responseMsg = await message.channel.send(
          `${emojis.bot.error} | Rapor sahibi bulunamadı ya da DM kapalıymış...`
        );
      }
      messagesToDelete.push(responseMsg);
      setTimeout(async () => {
        for (const msg of messagesToDelete) {
          await msg?.delete().catch(() => {});
        }
      }, 5000);
      return;
    }

    if (args.length && sub !== "cevapla" && sub !== "sil") {
      const reportText = args.join(" ");
      const id = Date.now().toString(36);  

      await db.set(`report_${id}`, {
        author: message.author.id,
        text: reportText,
        date: Date.now(),
      });
      const files = message.attachments.map((att) => att.url);
      if (files.length) await db.set(`report_files_${id}`, files);

      const embed = new MessageEmbed()
        .setTitle(`📣 Yeni Bildirim (#${id})`)
        .setColor("#FFA500")
        .setTimestamp()
        .addFields(
          {
            name: "👤 Kullanıcı",
            value: `${message.author} (\`${message.author.id}\`)`,
            inline: true,
          },
          { name: "📝 Bildirim", value: reportText, inline: false },
          {
            name: "👥 Yönetici",
            value:
              (Array.isArray(config.admins) ? config.admins : [config.admins])
                .map((id) => `<@${id}>`)
                .join(", ") || "Yönetici bulunamadı",
            inline: true,
          }
        );
      if (files.length) embed.setImage(files[0]);

      const confirmMsg = await message.channel.send({
        embeds: [embed],
        content:
          `${emojis.bot.succes} | Hazır! Göndermek istiyorsan "evet", iptal etmek istiyorsan "hayır" yaz. (30s)`,
      });

      let extraInfoMsg = null;
      if (files.length > 1) {
        extraInfoMsg = await message.channel.send(
          `${emojis.bot.succes} | Birden fazla fotoğraf ekledin, merak etme hepsi yöneticilere gönderilecek~`
        );
      }

      const filter = (m) =>
        m.author.id === message.author.id &&
        ["evet", "hayır"].includes(m.content.toLowerCase());
      const collector = message.channel.createMessageCollector({
        filter,
        max: 1,
        time: 30000,
      });

      let choiceMessage = null;

      collector.on("collect", async (m) => {
        choiceMessage = m;
        if (m.content.toLowerCase() === "evet") {
          let sentToAny = false;

          for (const adminId of adminIds) {
            const admin = await client.users.fetch(adminId).catch(() => null);
            if (admin) {
              const mainEmbed = new MessageEmbed(embed);
              if (files.length) mainEmbed.setImage(files[0]);
              await admin.send({ embeds: [mainEmbed] }).catch(() => {});
              if (files.length > 1) {
                const extraEmbeds = files.slice(1).map((url, index) =>
                  new MessageEmbed()
                    .setTitle(`📎 Ek Fotoğraf #${index + 2}`)
                    .setImage(url)
                    .setColor("#FFA500")
                );
                for (const exEmbed of extraEmbeds) {
                  await admin.send({ embeds: [exEmbed] }).catch(() => {});
                }
              }
              sentToAny = true;
            }
          }

          if (sentToAny) {
            await message.author.send(
              `${emojis.bot.succes} | Teşekkürler **${message.member.displayName}**! Bildirimin **${id}** yöneticilere iletildi.`
            );
          } else {
            await message.author.send(
              `${emojis.bot.error} | Üzgünüm, şu an yöneticilere ulaşılamadı. Daha sonra tekrar dene lütfen~`
            );
          }
        } else {
          await message.author.send(`${emojis.bot.error} | Bildirim iptal edildi, endişelenme~`);
          await db.delete(`report_${id}`);
          await db.delete(`report_files_${id}`);
        }

        setTimeout(() => {
          [message, confirmMsg, choiceMessage, extraInfoMsg].forEach((msg) =>
            msg?.delete().catch(() => {})
          );
        }, 2000);
      });

      collector.on("end", (collected) => {
        if (!collected.size) {
          message.author
            .send(
              `${emojis.bot.error} | Süre doldu ve bildirim iptal edildi. Vakti gelince tekrar deneyebilirsin~`
            )
            .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 2000));
          db.delete(`report_${id}`);
          db.delete(`report_files_${id}`);
          setTimeout(() => {
            [message, confirmMsg].forEach((msg) => msg?.delete().catch(() => {}));
          }, 2000);
        }
      });

      return;
    }

    return message.reply(
      `${emojis.bot.error} | Hımm, komut doğru kullanılmamış gibi. Yardım almak için \`help bildir\` yazabilirsin~`
    ).then(msg => {
      messagesToDelete.push(msg);
      setTimeout(async () => {
        for (const m of messagesToDelete) {
          await m?.delete().catch(() => {});
        }
      }, 5000);
    });
  } catch (err) {
    console.error("bildir komutu hatası:", err);
    const errorMsg = await message.reply(
      `${emojis.bot.error} | Ayy, beklenmedik bir hata oluştu~ Bir daha dener misin?`
    );
    messagesToDelete.push(errorMsg);
    setTimeout(async () => {
      for (const msg of messagesToDelete) {
        await msg?.delete().catch(() => {});
      }
    }, 5000);
    return;
  }
};
