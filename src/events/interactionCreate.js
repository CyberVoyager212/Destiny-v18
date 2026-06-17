const { QuickDB } = require('quick.db');
const db = new QuickDB();

const handleTicket = require('./utils/interactionCreate/handleTicket');
const handleSocial = require('./utils/interactionCreate/handleSocial');
const handlePrivateSession = require('./utils/interactionCreate/handlePrivateSession');
const handleButtonRole = require('./utils/interactionCreate/handleButtonRole');

module.exports = async (client, interaction) => {
  if (!interaction.isButton()) return;

  const { customId, user, guild } = interaction;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  try {
    if (customId.startsWith('ticket_')) {
      await handleTicket(client, interaction, member);
    }
  } catch (err) {
    console.error('Ticket system error:', err);
    if (interaction.replied || interaction.deferred) {
      try { await interaction.editReply({ content: `❌ Bir hata oluştu: ${err.message}` }); } catch {}
    } else {
      try { await interaction.reply({ content: `❌ Bir hata oluştu: ${err.message}`, ephemeral: true }); } catch {}
    }
  }

  if (customId.startsWith('social_ac_') || customId.startsWith('social_sil_')) {
    await handleSocial(client, interaction, member);
  }

  if (customId.startsWith('ps_')) {
    await handlePrivateSession(client, interaction, db);
  }

  if (customId.startsWith('butonrol_')) {
    await handleButtonRole(client, interaction, member);
  }
};
