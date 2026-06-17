const {
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
} = require('discord.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'help',
  aliases: ['h', 'yardım'],
  usage: 'help [komut]',
  category: 'Bot',
  description:
    'Gelişmiş yardım arayüzü ve help <komut> ile komut detayı gösterir.',
};

exports.execute = async (client, message, args = []) => {
  try {
    const prefix = client.config?.prefix || '';
    const ownerId = client.config?.ownerId || '';
    const admins = client.config?.admins || [];

    const emojis = client.config?.emojis || {
      bot: { succes: '✅', error: '❌' },
    };

    const isOwner = message.author.id === ownerId;
    const isAdmin = admins.includes(message.author.id);

    const memberHasAnyPerm = (perms = []) => {
      if (!message.member || !message.member.permissions) return false;
      if (!Array.isArray(perms)) perms = [perms];
      return perms.some((p) => message.member.permissions.has(p));
    };

    const db = client.db;
    let disabledSet = new Set();
    if (db) {
      try {
        const allRows = await db.all();
        const disabledNames = allRows
          .filter((row) => row.id.startsWith('kapaliKomut_'))
          .map((row) => row.id.replace('kapaliKomut_', ''));
        disabledNames.forEach((name) => disabledSet.add(name.toLowerCase()));
      } catch (e) {}
    }

    const allCmds = Array.from(client.commands.values()).filter((cmd) => {
      const help = cmd.help || {};
      const name = help.name?.toLowerCase();
      const aliases = (help.aliases || []).map((a) => a.toLowerCase());
      if (disabledSet.has(name)) return false;
      if (aliases.some((a) => disabledSet.has(a))) return false;

      if (help.admin && !isOwner && !isAdmin) return false;
      if (
        help.permissions &&
        Array.isArray(help.permissions) &&
        help.permissions.length
      ) {
        if (!memberHasAnyPerm(help.permissions) && !isOwner && !isAdmin)
          return false;
      }

      return true;
    });

    const findCommand = (query) => {
      const term = String(query || '')
        .trim()
        .toLowerCase();
      if (!term) return null;
      return (
        allCmds.find((cmd) => {
          const help = cmd.help || {};
          const name = String(help.name || '').toLowerCase();
          const aliases = (help.aliases || []).map((a) =>
            String(a).toLowerCase(),
          );
          return name === term || aliases.includes(term);
        }) || null
      );
    };

    const requestedCommand = args[0] ? findCommand(args[0]) : null;
    if (args[0]) {
      if (!requestedCommand) {
        const emb = new MessageEmbed()
          .setTitle(`${emojis.bot.error} Komut Bulunamadı`)
          .setDescription(
            `\`${args[0]}\` için bir komut bulamadım. \`${prefix}help\` ile menüyü açabilirsin.`,
          )
          .setColor('#ff6b6b');
        const errorMsg = await message.channel.send({ embeds: [emb] });
        setTimeout(async () => {
          await message.delete().catch(() => {});
          await errorMsg.delete().catch(() => {});
        }, 5000);
        return;
      }
      const cmdHelp = requestedCommand.help || {};
      if (
        cmdHelp.permissions &&
        Array.isArray(cmdHelp.permissions) &&
        cmdHelp.permissions.length
      ) {
        if (!memberHasAnyPerm(cmdHelp.permissions) && !isOwner && !isAdmin) {
          const emb = new MessageEmbed()
            .setTitle(`${emojis.bot.error} Komut Bulunamadı`)
            .setDescription(
              `\`${args[0]}\` için bir komut bulamadım. \`${prefix}help\` ile menüyü açabilirsin.`,
            )
            .setColor('#ff6b6b');
          const errorMsg = await message.channel.send({ embeds: [emb] });
          setTimeout(async () => {
            await message.delete().catch(() => {});
            await errorMsg.delete().catch(() => {});
          }, 5000);
          return;
        }
      }

      const aliases = (cmdHelp.aliases || []).length
        ? (cmdHelp.aliases || []).map((a) => `\`${a}\``).join(', ')
        : 'Yok';
      const permissions =
        Array.isArray(cmdHelp.permissions) && cmdHelp.permissions.length
          ? cmdHelp.permissions.map((p) => `\`${p}\``).join(', ')
          : 'Yok';
      const examples =
        Array.isArray(cmdHelp.examples) && cmdHelp.examples.length
          ? cmdHelp.examples.map((e) => `\`${prefix}${e}\``).join('\n')
          : null;

      const emb = new MessageEmbed()
        .setTitle(`📘 ${prefix}${cmdHelp.name || args[0]}`)
        .setColor('#0b84ff')
        .addField('Açıklama', cmdHelp.description || '-', false)
        .addField(
          'Kullanım',
          `\`${prefix}${cmdHelp.usage || cmdHelp.name || args[0]}\``,
          false,
        )
        .addField('Kategori', cmdHelp.category || 'Diğer', true)
        .addField('Kısayollar', aliases, true)
        .addField('Cooldown', `${cmdHelp.cooldown || 0} saniye`, true)
        .addField('İzinler', permissions, false)
        .setFooter({
          text: `İsteyen: ${
            message.member
              ? message.member.displayName
              : message.author.username
          }`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      if (examples) {
        emb.addField('Örnekler', examples, false);
      }

      if (Array.isArray(cmdHelp.extraFields) && cmdHelp.extraFields.length) {
        cmdHelp.extraFields.slice(0, 10).forEach((field) => {
          if (!field || !field.name) return;
          emb.addField(
            String(field.name),
            String(field.value || '-'),
            Boolean(field.inline),
          );
        });
      }

      return message.channel.send({ embeds: [emb] });
    }

    const buildCategories = (cmdList) => {
      const cats = {};
      cmdList.forEach((cmd) => {
        const cat = cmd.help?.category || 'Diğer';
        if (!cats[cat]) cats[cat] = [];
        cats[cat].push(cmd);
      });
      return cats;
    };

    const visibleCommands = allCmds;
    let categories = buildCategories(visibleCommands);
    let categoryNames = Object.keys(categories).sort();

    const PRIMARY_COLOR = '#0b84ff';
    const SECONDARY_COLOR = '#2f3136';
    const CARD_COLOR = '#1f2326';

    const makeHeroEmbed = () => {
      const total = visibleCommands.length;
      const emb = new MessageEmbed()
        .setTitle(`✨ ${client.user.username} — Yardım Merkezi`)
        .setDescription(
          `📊 **Toplam Komut:** \`${total}\`\n\nAşağıdan bir kategori seç veya 🔎 **Ara** butonunu kullanarak komutlarda arama yap.`,
        )
        .setColor(PRIMARY_COLOR)
        .setFooter({
          text: `İsteyen: ${
            message.member
              ? message.member.displayName
              : message.author.username
          }`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      const thumb =
        message.guild?.iconURL({ dynamic: true }) ||
        client.user.displayAvatarURL({ dynamic: true });
      emb.setThumbnail(thumb);

      return emb;
    };

    const makeCategorySelect = () => {
      const options = categoryNames.map((cat) => ({
        label: cat,
        value: `help_select_${encodeURIComponent(cat)}`,
        description: `${categories[cat].length} komut`,
        emoji: '📁',
      }));
      const select = new MessageSelectMenu()
        .setCustomId('help_select')
        .setPlaceholder('📂 Bir kategori seç')
        .addOptions(options.slice(0, 25));
      return new MessageActionRow().addComponents(select);
    };

    const makeMainButtons = () =>
      new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('help_search')
          .setLabel('Ara')
          .setEmoji('🔎')
          .setStyle('SECONDARY'),
        new MessageButton()
          .setCustomId('help_home')
          .setLabel('Ana Sayfa')
          .setEmoji('🏠')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId('help_close')
          .setLabel('Kapat')
          .setEmoji('❌')
          .setStyle('DANGER'),
      );

    const buildCategoryPage = (category, page = 0) => {
      const cmds = categories[category] || [];
      const perPage = 6;
      const totalPages = Math.max(1, Math.ceil(cmds.length / perPage));
      const slice = cmds.slice(page * perPage, page * perPage + perPage);

      const emb = new MessageEmbed()
        .setTitle(`📂 ${category}`)
        .setColor(CARD_COLOR)
        .setDescription(`📊 **Toplam:** \`${cmds.length}\` komut`)
        .setFooter({
          text: `📄 Sayfa ${page + 1}/${totalPages} • ${
            message.member
              ? message.member.displayName
              : message.author.username
          }`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      slice.forEach((c, i) => {
        const index = page * perPage + i + 1;
        const name = `**${index}.** \`${prefix}${c.help.name}\``;
        const desc = c.help?.description || '-';
        const usage = c.help?.usage || '-';
        emb.addField(
          name,
          `\u200b\n${desc}\n**Kullanım:** \`${prefix}${usage}\``,
          false,
        );
      });

      return { embed: emb, totalPages };
    };

    const makeCategoryNav = (category, page, totalPages) => {
      const row = new MessageActionRow();
      if (page > 0)
        row.addComponents(
          new MessageButton()
            .setCustomId(`help_prev_${encodeURIComponent(category)}_${page}`)
            .setLabel('Geri')
            .setEmoji('⬅️')
            .setStyle('SECONDARY'),
        );
      row.addComponents(
        new MessageButton()
          .setCustomId('help_home')
          .setLabel('Ana Sayfa')
          .setEmoji('🏠')
          .setStyle('PRIMARY'),
      );
      if (page < totalPages - 1)
        row.addComponents(
          new MessageButton()
            .setCustomId(`help_next_${encodeURIComponent(category)}_${page}`)
            .setLabel('İleri')
            .setEmoji('➡️')
            .setStyle('SECONDARY'),
        );
      row.addComponents(
        new MessageButton()
          .setCustomId('help_close')
          .setLabel('Kapat')
          .setEmoji('❌')
          .setStyle('DANGER'),
      );
      return row;
    };

    const initialRows = [makeCategorySelect(), makeMainButtons()];
    const helpMsg = await message.channel.send({
      embeds: [makeHeroEmbed()],
      components: initialRows,
    });

    const collector = helpMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 150_000,
    });

    let currentCategory = null;
    let currentPage = 0;

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate().catch(() => {});

      const cid = interaction.customId;

      if (cid === 'help_search') {
        await interaction.followUp({
          content: `${emojis.bot.succes} Arama modu aktif. Lütfen kanala aramak istediğiniz terimi yazın (30s).`,
          ephemeral: true,
        });
        const filter = (m) => m.author.id === message.author.id;
        const collected = await message.channel.awaitMessages({
          filter,
          max: 1,
          time: 30_000,
        });
        const term = collected.first()?.content?.trim();
        const termMessage = collected.first();
        if (termMessage) {
          setTimeout(() => {
            termMessage.delete().catch(() => {});
          }, 4000);
        }
        if (!term) {
          await interaction.followUp({
            content: `${emojis.bot.error} **${
              message.member
                ? message.member.displayName
                : message.author.username
            }**, lütfen biraz yavaş ol~ bana göre çok hızlısın :c`,
            ephemeral: true,
          });

          return interaction.editReply({
            embeds: [makeHeroEmbed()],
            components: [makeCategorySelect(), makeMainButtons()],
          });
        }

        const termLower = term.toLowerCase();
        const found = visibleCommands.filter((cmd) => {
          const help = cmd.help || {};
          return (
            help.name?.toLowerCase().includes(termLower) ||
            (help.description &&
              help.description.toLowerCase().includes(termLower)) ||
            (help.usage && help.usage.toLowerCase().includes(termLower))
          );
        });

        if (!found.length) {
          const resEmb = new MessageEmbed()
            .setTitle(`${emojis.bot.error} Arama sonuçları: \`${term}\``)
            .setColor('#ff6b6b')
            .setDescription(`Aradığın şeye ulaşamadım... üzgünüm~ :c`)
            .setFooter({ text: `${found.length} sonuç bulundu` })
            .setTimestamp();

          return interaction.editReply({
            content: null,
            embeds: [resEmb],
            components: [makeCategorySelect(), makeMainButtons()],
          });
        }

        const resEmb = new MessageEmbed()
          .setTitle(`🔎 Arama sonuçları: \`${term}\``)
          .setColor('#ffb142')
          .setDescription(`📊 **${found.length}** sonuç bulundu`)
          .setFooter({
            text: `${
              message.member
                ? message.member.displayName
                : message.author.username
            }`,
            iconURL: message.author.displayAvatarURL(),
          })
          .setTimestamp();

        found.slice(0, 25).forEach((c, i) => {
          const idx = i + 1;
          resEmb.addField(
            `**${idx}.** \`${prefix}${c.help.name}\``,
            `${c.help.description || '-'}\n\n**Kullanım:** \`${prefix}${c.help.usage || '-'}\``,
            false,
          );
        });

        return interaction.editReply({
          content: null,
          embeds: [resEmb],
          components: [makeCategorySelect(), makeMainButtons()],
        });
      }

      if (cid === 'help_home') {
        currentCategory = null;
        currentPage = 0;
        categories = buildCategories(visibleCommands);
        categoryNames = Object.keys(categories).sort();
        return interaction.editReply({
          embeds: [makeHeroEmbed()],
          components: [makeCategorySelect(), makeMainButtons()],
        });
      }

      if (cid === 'help_close') {
        try {
          await helpMsg.delete();
        } catch (e) {}
        try {
          await message.delete();
        } catch (e) {}
        collector.stop();
        return;
      }

      if (cid === 'help_select') {
        const raw = interaction.values?.[0];
        if (!raw) return;
        const encoded = raw.replace(/^help_select_/, '');
        const cat = decodeURIComponent(encoded);
        if (!categories[cat]) {
          categories = buildCategories(visibleCommands);
          if (!categories[cat])
            return interaction.editReply({
              content: 'Bu kategori bulunamadı.',
              embeds: [],
              components: [],
            });
        }
        currentCategory = cat;
        currentPage = 0;
        const { embed, totalPages } = buildCategoryPage(
          currentCategory,
          currentPage,
        );
        const nav = makeCategoryNav(currentCategory, currentPage, totalPages);
        return interaction.editReply({ embeds: [embed], components: [nav] });
      }

      if (cid.startsWith('help_prev_') || cid.startsWith('help_next_')) {
        const parts = cid.split('_');
        const action = parts[1];
        const encodedCat = parts[2];
        const pageParam = Number(parts[3]) || 0;
        const cat = decodeURIComponent(encodedCat);

        if (!categories[cat]) {
          categories = buildCategories(visibleCommands);
          if (!categories[cat])
            return interaction.editReply({
              content: 'Kategori bulunamadı.',
              embeds: [],
              components: [],
            });
        }

        const perPage = 6;
        const totalPages = Math.max(
          1,
          Math.ceil((categories[cat] || []).length / perPage),
        );
        currentPage =
          action === 'prev'
            ? Math.max(0, pageParam - 1)
            : Math.min(totalPages - 1, pageParam + 1);

        const { embed, totalPages: tp } = buildCategoryPage(cat, currentPage);
        const nav = makeCategoryNav(cat, currentPage, tp);
        return interaction.editReply({ embeds: [embed], components: [nav] });
      }
    });

    collector.on('end', () => {
      helpMsg.delete().catch(() => {});
      message.delete().catch(() => {});
    });
  } catch (err) {
    console.error('Help komutu hata:', err);
    message.channel.send('Yardım menüsü oluşturulurken bir hata oluştu.');
  }
};
