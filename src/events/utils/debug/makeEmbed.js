const { MessageEmbed } = require('discord.js');
const os = require('os');

module.exports = function makeEmbed(title, description, fields = []) {
  const embed = new MessageEmbed()
    .setTitle(title)
    .setDescription(description?.slice(0, 2048) || 'No description')
    .setTimestamp(new Date())
    .setFooter({ text: `Node ${process.version} • ${os.platform()} ${os.arch()}` });

  const mapped = fields.map(f => ({ name: f.name || '\u200b', value: f.value?.slice(0, 1024) || '\u200b', inline: !!f.inline }));
  if (mapped.length) embed.addFields(mapped);
  return embed;
};
