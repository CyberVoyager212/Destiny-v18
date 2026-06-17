const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const fs = require('fs');
const path = require('path');

const SOSYAL_DB_FILE = path.join(__dirname, '..', '..', '..', 'data', 'sosyal.json');

function sosyalGet(key) {
  if (!fs.existsSync(SOSYAL_DB_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SOSYAL_DB_FILE, 'utf8'));
    return data[key] !== undefined ? data[key] : null;
  } catch { return null; }
}

function sosyalDel(key) {
  if (!fs.existsSync(SOSYAL_DB_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(SOSYAL_DB_FILE, 'utf8'));
    delete data[key];
    fs.writeFileSync(SOSYAL_DB_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function sosyalSet(key, value) {
  let data = {};
  try {
    if (fs.existsSync(SOSYAL_DB_FILE)) data = JSON.parse(fs.readFileSync(SOSYAL_DB_FILE, 'utf8'));
  } catch {}
  data[key] = value;
  fs.writeFileSync(SOSYAL_DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = async (client, interaction, member) => {
  const { customId, user, guild } = interaction;

  const hedefKullaniciId = customId.split('_').slice(2).join('_');
  if (user.id !== hedefKullaniciId) {
    return interaction.reply({ content: '🚫 Bu buton sana ait değil!', ephemeral: true });
  }

  const sosyalKanalKey = `sosyal_kanal_${guild.id}_${hedefKullaniciId}`;
  const kanalBilgi = sosyalGet(sosyalKanalKey);

  if (!kanalBilgi) {
    return interaction.reply({
      content: '❌ DesNet kanal bilgisi bulunamadı. Lütfen `!social` komutunu tekrar kullanın.',
      ephemeral: true,
    });
  }

  if (customId.startsWith('social_sil_')) {
    await interaction.deferReply({ ephemeral: true });
    const silinecekKanal = guild.channels.cache.get(kanalBilgi.channelId);
    sosyalDel(sosyalKanalKey);
    if (silinecekKanal) {
      await silinecekKanal.delete().catch(() => {});
    }
    return interaction.editReply({
      content: '🗑️ DesNet kanalın silindi. Yeniden oluşturmak için `!social` komutunu kullan.',
    }).catch(() => {});
  }

  if (customId.startsWith('social_ac_')) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const eskiKanal = guild.channels.cache.get(kanalBilgi.channelId);
      if (eskiKanal) {
        await eskiKanal.delete().catch(() => {});
      }

      const channelBase = `desnet-${user.username.toLowerCase()}`.replace(/[^a-z0-9\-]/g, '');
      let channelName = channelBase;
      let chIdx = 1;
      while (guild.channels.cache.some((ch) => ch.name === channelName)) {
        channelName = `${channelBase}-${chIdx}`;
        chIdx++;
      }
      const yeniKanal = await guild.channels.create(channelName, {
        type: 'GUILD_TEXT',
        topic: `🌐 DesNet - ${member.displayName} kişisel sosyal medya kanalı`,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: ['VIEW_CHANNEL'] },
          { id: user.id, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] },
        ],
      });

      const silBtnRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(`social_ac_${hedefKullaniciId}`)
          .setLabel('🌐 DesNet\'i Aç')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId(`social_sil_${hedefKullaniciId}`)
          .setLabel('🗑️ Kanalı Sil')
          .setStyle('DANGER'),
      );
      const silEmbed = new MessageEmbed()
        .setTitle('🌐 DesNet Sosyal Medya')
        .setDescription(`Hoş geldin **${member.displayName}**!\nAşağıdaki butonlarla DesNet\'i kullanabilir veya bu kanalı silebilirsin.`)
        .setColor('#5865F2')
        .setFooter({ text: 'Bot yeniden başlasa bile bu kanal kalır.' })
        .setTimestamp();
      
      const kontrolMesaji = await yeniKanal.send({
        embeds: [silEmbed],
        components: [silBtnRow],
      });

      sosyalSet(sosyalKanalKey, {
        channelId: yeniKanal.id,
        kontrolMesajId: kontrolMesaji.id,
        guildId: guild.id,
        kullaniciId: hedefKullaniciId,
      });

      const socialCommand = client.commands.get('social');
      if (socialCommand && typeof socialCommand.runFromChannel === 'function') {
        await socialCommand.runFromChannel(client, yeniKanal, user);
        return interaction.editReply({ content: `🌐 DesNet açıldı: ${yeniKanal}` }).catch(() => {});
      } else {
        return interaction.editReply({
          content: `✅ Yeni kanal oluşturuldu: ${yeniKanal}\n❌ Ancak social komutu yüklenmemiş, panel açılamadı.`,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Social open error:', err);
      return interaction.editReply({ content: `❌ Bir hata oluştu: ${err.message}` }).catch(() => {});
    }
  }
};
