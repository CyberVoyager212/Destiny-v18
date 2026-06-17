const { MessageAttachment, MessageActionRow, MessageButton } = require("discord.js");
const botConfig = require("../botConfig.js");
const emojis = require("../emoji.json");

module.exports = {
  name: "deletedmessages",
  description:
    "Son silinen mesajları silinme saatleriyle gösterir veya belirli kayıtları silebilirsiniz.",
  aliases: ["dmsgs", "deletemsgs"],
  usage: "deletedmessages | dmsgs sil <kullanıcı> [saat] | dmsgs indir",
  permissions: ["MANAGE_MESSAGES"],

  async execute(client, message, args) {
    if (!message.guild)
      return message.reply(
        `${emojis.bot.error} | Aa~ bu komut sadece sunucularda kullanılabilir, **${message.member.displayName}** :c`
      );

    let guildKey = `deletedMessages_${message.guild.id}`;
    let deletedMessages = (await client.db.get(guildKey)) || [];

    if (!deletedMessages.length)
      return message.reply(
        `${emojis.bot.error} | Hımm~ hiç silinen mesaj bulunamadı, **${message.member.displayName}**!`
      );

    if (args[0] && args[0].toLowerCase() === "indir") {
      const fileContent = deletedMessages.join("\n");
      const buffer = Buffer.from(fileContent, "utf-8");
      const attachment = new MessageAttachment(buffer, "deletedMessages.txt");

      return message.channel.send({
        content: `${emojis.bot.succes} | İşte tüm silinen mesajlar, **${message.member.displayName}**~`,
        files: [attachment],
      });
    }

    if (args[0] && args[0].toLowerCase() === "sil") {
      if (!botConfig.admins.includes(message.author.id)) {
        return message.reply(
          `${emojis.bot.error} | Üzgünüm, **${message.member.displayName}**, bu komutu kullanma yetkin yok~`
        );
      }

      const num = parseInt(args[1]);
      const username = args[1] && isNaN(args[1]) ? args.slice(1).join(" ") : null;

      if (num && !isNaN(num)) {
        const globalIndex = num - 1;
        if (globalIndex < 0 || globalIndex >= deletedMessages.length) {
          return message.reply(
            `${emojis.bot.error} | Geçersiz mesaj numarası!`
          );
        }

        deletedMessages.splice(globalIndex, 1);
        await client.db.set(guildKey, deletedMessages);
        return message.reply(
          `${emojis.bot.succes} | Mesaj #${num} başarıyla silindi!`
        );
      } else if (username) {
        const newDeletedMessages = deletedMessages.filter((msg) => {
          return !msg.includes(`**${username}**`);
        });

        if (newDeletedMessages.length === deletedMessages.length) {
          return message.reply(
            `${emojis.bot.error} | Belirtilen kullanıcıya ait silinen mesaj bulunamadı`
          );
        }

        const deletedCount = deletedMessages.length - newDeletedMessages.length;
        await client.db.set(guildKey, newDeletedMessages);
        return message.reply(
          `${emojis.bot.succes} | **${username}** kullanıcısının ${deletedCount} mesajı silindi!`
        );
      } else {
        return message.reply(
          `${emojis.bot.error} | Silmek için bir numara veya kullanıcı adı belirtin! Kullanım: dmsgs sil <numara> veya dmsgs sil <kullanıcı>`
        );
      }
    }

    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(deletedMessages.length / PAGE_SIZE);
    let currentPage = 0;

    const generatePage = (page) => {
      const start = page * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageMessages = deletedMessages.slice(start, end);

      const numberedMessages = pageMessages.map((msg, index) => {
        const globalNum = start + index + 1;
        return `**${globalNum}.** ${msg}`;
      }).join("\n\n");

      return {
        content: `${emojis.bot.succes} | İşte son silinen mesajlar, **${message.member.displayName}**~ (Sayfa ${page + 1}/${totalPages}, Toplam: ${deletedMessages.length})\n\n💡 Kullanım:\n• \`dmsgs sil <numara>\` - Mesajı sil\n• \`dmsgs sil <kullanıcı>\` - Kullanıcının tüm mesajlarını sil\n\n${numberedMessages}`,
      };
    };

    const msg = await message.channel.send(generatePage(currentPage));

    if (totalPages > 1) {
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("dmsgs_first")
          .setLabel("⏪ İlk")
          .setStyle("SECONDARY")
          .setDisabled(true),
        new MessageButton()
          .setCustomId("dmsgs_prev")
          .setLabel("◀️ Önceki")
          .setStyle("SECONDARY")
          .setDisabled(true),
        new MessageButton()
          .setCustomId("dmsgs_page_info")
          .setLabel(`${currentPage + 1}/${totalPages}`)
          .setStyle("SECONDARY")
          .setDisabled(true),
        new MessageButton()
          .setCustomId("dmsgs_next")
          .setLabel("Sonraki ▶️")
          .setStyle("SECONDARY")
          .setDisabled(totalPages === 1),
        new MessageButton()
          .setCustomId("dmsgs_last")
          .setLabel("Son ⏩")
          .setStyle("SECONDARY")
          .setDisabled(totalPages === 1)
      );

      await msg.edit({ components: [row] });

      const filter = (interaction) => interaction.user.id === message.author.id;
      const collector = msg.createMessageComponentCollector({ filter, time: 120000 });

      collector.on("collect", async (interaction) => {
        if (interaction.customId === "dmsgs_first") {
          currentPage = 0;
        } else if (interaction.customId === "dmsgs_prev") {
          if (currentPage > 0) currentPage--;
        } else if (interaction.customId === "dmsgs_next") {
          if (currentPage < totalPages - 1) currentPage++;
        } else if (interaction.customId === "dmsgs_last") {
          currentPage = totalPages - 1;
        } else if (interaction.customId === "dmsgs_page_info") {
          return;
        }

        const newRow = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId("dmsgs_first")
            .setLabel("⏪ İlk")
            .setStyle("SECONDARY")
            .setDisabled(currentPage === 0),
          new MessageButton()
            .setCustomId("dmsgs_prev")
            .setLabel("◀️ Önceki")
            .setStyle("SECONDARY")
            .setDisabled(currentPage === 0),
          new MessageButton()
            .setCustomId("dmsgs_page_info")
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle("SECONDARY")
            .setDisabled(true),
          new MessageButton()
            .setCustomId("dmsgs_next")
            .setLabel("Sonraki ▶️")
            .setStyle("SECONDARY")
            .setDisabled(currentPage === totalPages - 1),
          new MessageButton()
            .setCustomId("dmsgs_last")
            .setLabel("Son ⏩")
            .setStyle("SECONDARY")
            .setDisabled(currentPage === totalPages - 1)
        );

        await interaction.update({
          ...generatePage(currentPage),
          components: [newRow],
        });
      });

      collector.on("end", () => {
        msg.edit({ components: [] }).catch(() => {});
      });
    }
  },

  help: {
    name: "deletedmessages",
    aliases: ["dmsgs", "deletemsgs"],
    usage: "deletedmessages | dmsgs sil <kullanıcı> [saat] | dmsgs indir",
    description:
      "Son silinen mesajları embed olmadan, silinme saatleriyle birlikte gösterir ve dilersen indirmeni sağlar.",
    category: "Moderasyon",
    cooldown: 3,
    permissions: ["MANAGE_MESSAGES"],
  },
};
