module.exports = async (client, interaction, member) => {
  const { customId, guild } = interaction;
  
  const roleId = customId.split('_')[1];
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return interaction.reply({
      content: '❌ Bu rol artık yok.',
      ephemeral: true,
    });
  }

  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId);
    return interaction.reply({
      content: `➖ <@&${roleId}> rolün alındı.`,
      ephemeral: true,
    });
  } else {
    await member.roles.add(roleId);
    return interaction.reply({
      content: `➕ <@&${roleId}> rolün verildi.`,
      ephemeral: true,
    });
  }
};
