const { MessageEmbed } = require('discord.js');

module.exports = async (client, member) => {
  const guildId = member.guild.id;
  const cfg = await client.db.get(`welcomegoodbye_${guildId}`);
  if (!cfg?.enabled) return;

  let inviterId = null;
  try {
    inviterId = await client.db.get(`inviter_${guildId}_${member.user.id}`);
    await client.db.delete(`inviter_${guildId}_${member.user.id}`);
  } catch (err) {
    console.error('[GGR] inviter okunamadı/silinmedi:', err);
  }

  let text = (cfg.exitMessage || '')
    .replace(/\$etiket/g, member.user.tag)
    .replace(/\$sayı/g, String(member.guild.memberCount))
    .replace(/\$davet/g, inviterId ? `<@${inviterId}>` : 'Bilinmiyor');

  let embed;
  const m = text.match(/\$embed;(.+)/);
  if (m) {
    embed = new MessageEmbed()
      .setTitle(m[1].trim())
      .setDescription(text.replace(/\$embed;(.+)/, '').trim())
      .setColor('ORANGE');
    text = null;
  }

  const ch = member.guild.channels.cache.get(cfg.outgoingChannel);
  if (!ch) {
    console.warn(`[GGA] outgoingChannel bulunamadı: ${cfg.outgoingChannel}`);
    return;
  }
  try {
    if (embed) await ch.send({ embeds: [embed] });
    else await ch.send(text);
  } catch (err) {
    console.error('[GGC] Çıkış mesajı gönderilemedi:', err);
  }
};
