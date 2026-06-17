const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const emojis = require('../emoji.json');

exports.execute = async (client, message, args) => {
  const SQLITE_FILE = path.join(__dirname, '..', 'json.sqlite');
  const BACKUP_DIR = path.join(__dirname, '..', 'data', 'json');
  const RESTART_FILE = path.join(__dirname, '..', 'restart.txt');
  const METADATA_FILE = path.join(BACKUP_DIR, 'backup_metadata.json');

  const loadMetadata = () => {
    if (!fs.existsSync(METADATA_FILE)) return {};
    try {
      return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch {
      return {};
    }
  };

  const saveMetadata = (metadata) => {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  };

  const getBackups = () => {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }
    const metadata = loadMetadata();
    return fs
      .readdirSync(BACKUP_DIR)
      .filter(
        (file) =>
          file.endsWith('.sqlite.gz') && file !== 'backup_metadata.json',
      )
      .map((file) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        const meta = metadata[file] || {};
        return {
          name: file,
          path: filePath,
          mtime: stat.mtime,
          size: stat.size,
          customName: meta.name || null,
          note: meta.note || null,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  };

  const formatBackupInfo = (backup, index) => {
    const match = backup.name.match(
      /backup_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/,
    );
    let dateStr = '';
    let timeStr = '';
    if (match) {
      const [_, year, month, day, hour, minute, second] = match;
      dateStr = `${day}/${month}/${year}`;
      timeStr = `${hour}:${minute}:${second}`;
    } else {
      const d = backup.mtime;
      const pad = (n) => String(n).padStart(2, '0');
      dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    const sizeKB = (backup.size / 1024).toFixed(2);
    let info = `⏱️ **Tarih:Saat:** ${dateStr} ${timeStr}\n📁 **Backup ${index + 1}** | 📦 **Boyut:** ${sizeKB} KB`;
    if (backup.customName) {
      info += `\n🏷️ **İsim:** ${backup.customName}`;
    }
    if (backup.note) {
      info += `\n📝 **Not:** ${backup.note}`;
    }
    return info;
  };

  let backups = getBackups();

  if (backups.length === 0) {
    return message.reply(
      `${emojis.bot.error} | Gösterilecek herhangi bir yedek bulunamadı! Yeni bir yedek oluşturmak için \`backup create\` komutunu kullanın.`,
    );
  }

  const subcommand = args[0]?.toLowerCase();

  if (subcommand === 'create') {
    const customName = args.slice(1).join(' ') || null;

    if (!fs.existsSync(SQLITE_FILE)) {
      return message.reply(
        `${emojis.bot.error} | Veritabanı dosyası bulunamadı!`,
      );
    }

    const msg = await message.reply(
      `${emojis.bot.loading} | Yedek oluşturuluyor...`,
    );

    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }

      const timestamp = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timestampStr = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}_${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}`;
      const destFile = path.join(
        BACKUP_DIR,
        `backup_${timestampStr}.sqlite.gz`,
      );

      const source = fs.readFileSync(SQLITE_FILE);
      const compressed = zlib.gzipSync(source, { level: 9 });
      fs.writeFileSync(destFile, compressed);

      if (customName) {
        const metadata = loadMetadata();
        metadata[destFile.split(path.sep).pop()] = {
          name: customName,
          createdAt: new Date().toISOString(),
          createdBy: message.author.id,
        };
        saveMetadata(metadata);
      }

      await msg.edit(`${emojis.bot.succes} | Yedek başarıyla oluşturuldu!`);
    } catch (err) {
      await msg.edit(
        `${emojis.bot.error} | Yedek oluşturulurken hata oluştu: ${err.message}`,
      );
    }
    return;
  }

  if (subcommand === 'delete') {
    const backupIndex = parseInt(args[1]) - 1;
    if (
      isNaN(backupIndex) ||
      backupIndex < 0 ||
      backupIndex >= backups.length
    ) {
      return message.reply(
        `${emojis.bot.error} | Geçerli bir yedek numarası belirtin! Kullanım: \`backup delete [numara]\``,
      );
    }

    const backupToDelete = backups[backupIndex];
    const confirmMsg = await message.reply({
      content: `⚠️ **${backupToDelete.customName || backupToDelete.name}** yedeğini silmek istediğinize emin misiniz?`,
      components: [
        new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId('confirm_delete')
            .setLabel('✅ Sil')
            .setStyle('DANGER'),
          new MessageButton()
            .setCustomId('cancel_delete')
            .setLabel('❌ İptal')
            .setStyle('SECONDARY'),
        ),
      ],
    });

    const filter = (i) => i.user.id === message.author.id;
    const collector = confirmMsg.createMessageComponentCollector({
      filter,
      time: 30000,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'confirm_delete') {
        try {
          fs.unlinkSync(backupToDelete.path);
          const metadata = loadMetadata();
          delete metadata[backupToDelete.name];
          saveMetadata(metadata);
          await interaction.update({
            content: `${emojis.bot.succes} | Yedek başarıyla silindi!`,
            components: [],
          });
        } catch (err) {
          await interaction.update({
            content: `${emojis.bot.error} | Yedek silinirken hata oluştu: ${err.message}`,
            components: [],
          });
        }
      } else {
        await interaction.update({
          content: '❌ Silme işlemi iptal edildi.',
          components: [],
        });
      }
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        confirmMsg
          .edit({
            content: '⏱️ Onay süresi doldu. İşlem iptal edildi.',
            components: [],
          })
          .catch(() => {});
      }
    });
    return;
  }

  if (subcommand === 'rename') {
    const backupIndex = parseInt(args[1]) - 1;
    const newName = args.slice(2).join(' ');

    if (
      isNaN(backupIndex) ||
      backupIndex < 0 ||
      backupIndex >= backups.length
    ) {
      return message.reply(
        `${emojis.bot.error} | Geçerli bir yedek numarası belirtin!`,
      );
    }
    if (!newName) {
      return message.reply(
        `${emojis.bot.error} | Yeni bir isim belirtin! Kullanım: \`backup rename [numara] [yeni isim]\``,
      );
    }

    const backupToRename = backups[backupIndex];
    const metadata = loadMetadata();
    if (!metadata[backupToRename.name]) {
      metadata[backupToRename.name] = {};
    }
    metadata[backupToRename.name].name = newName;
    metadata[backupToRename.name].renamedAt = new Date().toISOString();
    saveMetadata(metadata);

    return message.reply(
      `${emojis.bot.succes} | Yedek ismi "${newName}" olarak güncellendi!`,
    );
  }

  if (subcommand === 'detail') {
    const backupIndex = parseInt(args[1]) - 1;

    if (
      isNaN(backupIndex) ||
      backupIndex < 0 ||
      backupIndex >= backups.length
    ) {
      return message.reply(
        `${emojis.bot.error} | Geçerli bir yedek numarası belirtin! Kullanım: \`backup detail [numara]\``,
      );
    }

    const selectedBackup = backups[backupIndex];
    const msg = await message.reply(
      `${emojis.bot.loading} | Yedek içeriği okunuyor...`,
    );

    try {
      const gzipped = fs.readFileSync(selectedBackup.path);
      const decompressed = zlib.gunzipSync(gzipped);
      const dbContent = decompressed.toString('utf8');

      const lines = dbContent.split('\n');
      const moneyKeys = [];

      for (const line of lines) {
        if (line.includes('money_')) {
          const match = line.match(/"(money_[^"]+)":\s*(\d+)/);
          if (match) {
            moneyKeys.push({
              key: match[1],
              value: parseInt(match[2]),
            });
          }
        }
      }

      if (moneyKeys.length === 0) {
        await msg.edit(
          `${emojis.bot.error} | Bu yedekte money_ keyleri bulunamadı!`,
        );
        return;
      }

      const chunks = [];
      let currentChunk = `**${selectedBackup.customName || selectedBackup.name}** yedeğindeki money_ keyleri:\n\n`;

      for (const item of moneyKeys) {
        const line = `• **${item.key}:** ${item.value}\n`;
        if ((currentChunk + line).length > 1900) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk += line;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      await msg.edit(
        `${emojis.bot.succes} | Toplam ${moneyKeys.length} money_ keyi bulundu (${chunks.length} parça):\n\n💡 Bir keyi değiştirmek için: \`backup replace [key] [değer]\``,
      );

      for (let i = 0; i < chunks.length; i++) {
        await message.channel.send(chunks[i]);
      }
    } catch (err) {
      await msg.edit(
        `${emojis.bot.error} | Yedek okunurken hata oluştu: ${err.message}`,
      );
    }
    return;
  }

  if (subcommand === 'replace') {
    const key = args[1];
    const valueStr = args.slice(2).join(' ');

    if (!key) {
      return message.reply(
        `${emojis.bot.error} | Bir key belirtin! Kullanım: \`backup replace [key] [değer]\``,
      );
    }
    if (!key.startsWith('money_')) {
      return message.reply(
        `${emojis.bot.error} | Sadece money_ keylerini değiştirebilirsiniz! Kullanım: \`backup replace money_[userId] [değer]\``,
      );
    }
    if (!valueStr) {
      return message.reply(
        `${emojis.bot.error} | Bir değer belirtin! Kullanım: \`backup replace [key] [değer]\``,
      );
    }

    const msg = await message.reply(
      `${emojis.bot.loading} | Key güncelleniyor...`,
    );

    try {
      const value = parseInt(valueStr);
      if (isNaN(value)) {
        return msg.edit(`${emojis.bot.error} | Değer bir sayı olmalıdır!`);
      }

      await client.db.set(key, value);
      await msg.edit(
        `${emojis.bot.succes} | **${key}** keyi **${value}** olarak güncellendi!`,
      );
    } catch (err) {
      await msg.edit(
        `${emojis.bot.error} | Key güncellenirken hata oluştu: ${err.message}`,
      );
    }
    return;
  }

  if (!subcommand || subcommand === 'list') {
  }

  let page = 0;
  const PAGE_SIZE = 10;

  const generateEmbedAndComponents = (currentPage) => {
    const totalPages = Math.ceil(backups.length / PAGE_SIZE);
    const start = currentPage * PAGE_SIZE;
    const pageBackups = backups.slice(start, start + PAGE_SIZE);

    const embed = new MessageEmbed()
      .setTitle('📁 Veritabanı Yedekleri (Backups)')
      .setColor('#5865F2')
      .setDescription(
        pageBackups
          .map((backup, index) => {
            const globalIndex = start + index;
            return formatBackupInfo(backup, globalIndex);
          })
          .join('\n\n'),
      )
      .setFooter({
        text: `Sayfa ${currentPage + 1}/${totalPages} | Toplam ${backups.length} yedek | Kullanım: backup create [isim], backup delete [no], backup rename [no] [isim], backup detail [no], backup replace [key] [değer]`,
      })
      .setTimestamp();

    const rows = [];
    const row1 = new MessageActionRow();
    const row2 = new MessageActionRow();

    pageBackups.forEach((backup, index) => {
      const globalIndex = start + index;
      const buttonNumber = index + 1;

      const restoreBtn = new MessageButton()
        .setCustomId(`backup_restore_${globalIndex}`)
        .setLabel(`${buttonNumber}`)
        .setStyle('PRIMARY');

      if (index < 5) {
        row1.addComponents(restoreBtn);
      } else if (index < 10) {
        row2.addComponents(restoreBtn);
      }
    });

    if (row1.components.length > 0) rows.push(row1);
    if (row2.components.length > 0) rows.push(row2);

    if (totalPages > 1) {
      const rowNav = new MessageActionRow();
      rowNav.addComponents(
        new MessageButton()
          .setCustomId('backup_first')
          .setLabel('⏪ İlk')
          .setStyle('SECONDARY')
          .setDisabled(currentPage === 0),
        new MessageButton()
          .setCustomId('backup_prev')
          .setLabel('◀️ Önceki')
          .setStyle('SECONDARY')
          .setDisabled(currentPage === 0),
        new MessageButton()
          .setCustomId('backup_page_info')
          .setLabel(`${currentPage + 1}/${totalPages}`)
          .setStyle('SECONDARY')
          .setDisabled(true),
        new MessageButton()
          .setCustomId('backup_next')
          .setLabel('Sonraki ▶️')
          .setStyle('SECONDARY')
          .setDisabled(currentPage === totalPages - 1),
        new MessageButton()
          .setCustomId('backup_last')
          .setLabel('Son ⏩')
          .setStyle('SECONDARY')
          .setDisabled(currentPage === totalPages - 1),
      );
      rows.push(rowNav);
    }

    return { embeds: [embed], components: rows };
  };

  const initialPayload = generateEmbedAndComponents(page);
  const msg = await message.channel.send({
    content: `📂 **${message.member.displayName}**, mevcut veritabanı yedekleri listeleniyor:`,
    ...initialPayload,
  });

  const filter = (interaction) => interaction.user.id === message.author.id;
  const collector = msg.createMessageComponentCollector({
    filter,
    time: 120000,
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'backup_first') {
      await interaction.deferUpdate().catch(() => {});
      if (page > 0) {
        page = 0;
        backups = getBackups();
        const payload = generateEmbedAndComponents(page);
        await msg.edit(payload).catch(() => {});
      }
    } else if (interaction.customId === 'backup_last') {
      await interaction.deferUpdate().catch(() => {});
      const totalPages = Math.ceil(backups.length / 10);
      if (page < totalPages - 1) {
        page = totalPages - 1;
        backups = getBackups();
        const payload = generateEmbedAndComponents(page);
        await msg.edit(payload).catch(() => {});
      }
    } else if (interaction.customId === 'backup_prev') {
      await interaction.deferUpdate().catch(() => {});
      if (page > 0) {
        page--;
        backups = getBackups();
        const payload = generateEmbedAndComponents(page);
        await msg.edit(payload).catch(() => {});
      }
    } else if (interaction.customId === 'backup_next') {
      await interaction.deferUpdate().catch(() => {});
      const totalPages = Math.ceil(backups.length / PAGE_SIZE);
      if (page < totalPages - 1) {
        page++;
        backups = getBackups();
        const payload = generateEmbedAndComponents(page);
        await msg.edit(payload).catch(() => {});
      }
    } else if (interaction.customId.startsWith('backup_restore_')) {
      const globalIndex = parseInt(
        interaction.customId.replace('backup_restore_', ''),
        10,
      );
      const chosenBackup = backups[globalIndex];

      if (!chosenBackup || !fs.existsSync(chosenBackup.path)) {
        await interaction
          .reply({
            content: `${emojis.bot.error} | Seçilen yedek dosyası bulunamadı!`,
            ephemeral: true,
          })
          .catch(() => {});
        return;
      }

      const confirmRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('backup_restore_confirm')
          .setLabel('✅ Geri Yükle')
          .setStyle('DANGER'),
        new MessageButton()
          .setCustomId('backup_restore_cancel')
          .setLabel('❌ İptal')
          .setStyle('SECONDARY'),
      );

      await interaction.reply({
        content: `⚠️ **${chosenBackup.customName || chosenBackup.name}** yedeğini geri yüklemek istediğinize emin misiniz? Mevcut veritabanı değiştirilecek ve bot yeniden başlatılacak!`,
        components: [confirmRow],
        ephemeral: true,
      });

      const confirmationFilter = (i) => i.user.id === message.author.id;
      const confirmationCollector =
        interaction.channel.createMessageComponentCollector({
          filter: confirmationFilter,
          time: 30000,
        });

      confirmationCollector.on('collect', async (confirmInteraction) => {
        if (confirmInteraction.customId === 'backup_restore_confirm') {
          await confirmInteraction.deferUpdate().catch(() => {});
          confirmationCollector.stop();
          await interaction.editReply({
            content: '🔄 Geri yükleme başlatılıyor...',
            components: [],
          });

          await msg
            .edit({
              content: `🔄 **${chosenBackup.customName || `backup ${globalIndex + 1}`}** geri yükleniyor... Harici bir işlemle veritabanı geri yüklenecek ve bot yeniden başlatılacak.`,
              embeds: [],
              components: [],
            })
            .catch(() => {});

          try {
            fs.writeFileSync(RESTART_FILE, 'Restarting after restore');
            console.log('[Backup Command] restart.txt created');

            const restoreScriptPath = path.join(
              __dirname,
              '..',
              'restore_backup.js',
            );
            const backupPath = chosenBackup.path;
            const sqliteDir = path.join(__dirname, '..');
            const sqliteFile = path.join(sqliteDir, 'json.sqlite');

            const scriptContent = `const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('child_process');

console.log('[Restore Script] Waiting 1 seconds for bot to shut down...');

setTimeout(() => {
  console.log('[Restore Script] Starting database restore...');
  console.log('[Restore Script] Backup: ${backupPath.replace(/\\/g, '\\\\')}');
  console.log('[Restore Script] Target: ${sqliteFile.replace(/\\/g, '\\\\')}');

  function restoreDatabase() {
    try {
      if (fs.existsSync('${sqliteFile.replace(/\\/g, '\\\\')}')) {
        console.log('[Restore Script] Deleting old database...');
        fs.unlinkSync('${sqliteFile.replace(/\\/g, '\\\\')}');
        console.log('[Restore Script] Old database deleted.');
      }

      console.log('[Restore Script] Decompressing backup...');
      const gzipped = fs.readFileSync('${backupPath.replace(/\\/g, '\\\\')}');
      const decompressed = zlib.gunzipSync(gzipped);
      
      fs.writeFileSync('${sqliteFile.replace(/\\/g, '\\\\')}', decompressed);
      console.log('[Restore Script] Database restored successfully!');
      console.log('[Restore Script] Done! Window will close in 5 seconds.');
      
      setTimeout(() => {
        if (process.platform === 'win32') {
          exec('taskkill /f /im cmd.exe /t');
        } else {
          process.exit(0);
        }
      }, 5000);
      
    } catch (err) {
      if (err.code === 'EBUSY') {
        console.log('[Restore Script] File is still locked, retrying in 2 seconds...');
        setTimeout(restoreDatabase, 2000);
      } else {
        console.error('[Restore Script] ERROR:', err.message);
        console.error(err.stack);
        setTimeout(() => {
          process.exit(1);
        }, 10000);
      }
    }
  }

  restoreDatabase();
}, 1000);
`;

            fs.writeFileSync(restoreScriptPath, scriptContent);
            console.log(
              '[Backup Command] Restore script created:',
              restoreScriptPath,
            );

            const { exec } = require('child_process');
            exec(
              `start "Database Restore" cmd /k "node "${restoreScriptPath}""`,
              (error) => {
                if (error) {
                  console.error(
                    '[Backup Command] Failed to launch restore script:',
                    error,
                  );
                } else {
                  console.log(
                    '[Backup Command] Restore script launched successfully',
                  );
                }
              },
            );

            await message.channel.send(
              `${emojis.bot.succes} | Geri yükleme işlemi başlatıldı!`,
            );

            setTimeout(() => {
              process.exit(0);
            }, 1000);
          } catch (err) {
            console.error('[Backup Command] Restore error:', err);
            await message.channel.send(
              `${emojis.bot.error} | Geri yükleme işlemi başlatılırken hata oluştu: ${err.message}`,
            );
          }
        } else if (confirmInteraction.customId === 'backup_restore_cancel') {
          await confirmInteraction.update({
            content: '❌ Geri yükleme işlemi iptal edildi.',
            components: [],
          });
        }
      });

      confirmationCollector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction
            .editReply({
              content: '⏱️ Onay süresi doldu. İşlem iptal edildi.',
              components: [],
            })
            .catch(() => {});
        }
      });
    }
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
};

exports.help = {
  name: 'backup',
  aliases: ['yedek', 'db-backup'],
  usage: 'backup [create|delete|rename|detail|replace|list]',
  description:
    'Veritabanı yedeklerini yönetir: listele, oluştur, sil, isimlendir, detay görüntüle, key güncelle, geri yükle.',
  category: 'Bot',
  cooldown: 5,
  admin: true,
  extraFields: [
    {
      name: 'Alt Komutlar',
      value:
        '`backup create [isim]`: Yeni bir sıkıştırılmış veritabanı yedeği oluşturur.\n' +
        '`backup list`: Kayıtlı veritabanı yedeklerini listeler.\n' +
        '`backup delete <index>`: Belirtilen yedeği siler.\n' +
        '`backup rename <index> <yeni_isim>`: Yedeğin ismini değiştirir.\n' +
        '`backup replace <eski_anahtar> <yeni_anahtar>`: Tüm yedeklerdeki veritabanı anahtarlarını toplu günceller.\n' +
        '`backup detail <index>`: Yedek dosyasının detaylarını gösterir.',
      inline: false,
    },
    {
      name: 'Geri Yükleme',
      value:
        '`backup list` üzerinden interaktif butonlar kullanılarak yedek seçilip geri yüklenebilir. Geri yükleme sonrası bot otomatik yeniden başlatılır.',
      inline: false,
    },
  ],
};
