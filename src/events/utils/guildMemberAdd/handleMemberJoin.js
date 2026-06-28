const { MessageEmbed } = require('discord.js');

module.exports = async (client, member) => {
  const guildId = member.guild.id;

  const ggsConfig = (await client.db.get(`welcomegoodbye_${guildId}`)) || {};
  const ksUnregRoleId = await client.db.get(`kayitsizRol_${guildId}`);
  const ksAutoName = await client.db.get(`autoName_${guildId}`);

  let inviterId = null;
  if (ggsConfig?.enabled && ggsConfig.inviteTracking) {
    try {
      const newInv = await member.guild.invites.fetch();
      const oldMap = client.invites.get(guildId) || new Map();

      let usedInvite = null;
      for (const inv of newInv.values()) {
        const prev = oldMap.get(inv.code);
        if (prev && inv.uses > prev.uses) {
          usedInvite = inv;
          break;
        }
      }

      if (usedInvite) {
        inviterId =
          usedInvite.inviter?.id ||
          oldMap.get(usedInvite.code)?.inviter ||
          null;
      }

      const updated = new Map();
      newInv.forEach((i) =>
        updated.set(i.code, { uses: i.uses, inviter: i.inviter?.id }),
      );
      client.invites.set(guildId, updated);
    } catch (err) {
      console.error('[GGA] Invite tracking error:', err);
    }
  }

  try {
    if (inviterId) {
      await client.db.set(`inviter_${guildId}_${member.user.id}`, inviterId);
    } else {
      await client.db.set(`inviter_${guildId}_${member.user.id}`, 'Bilinmiyor');
    }
  } catch (err) {
    console.error('[GGA] inviter kaydedilemedi:', err);
  }

  const memberType = member.user.bot ? 'bot' : 'kullanıcı';

  let roleIdsToAdd = [];
  if (ksUnregRoleId) roleIdsToAdd.push(ksUnregRoleId);
  else if (ggsConfig?.enabled && ggsConfig.otorol?.[memberType]?.length) {
    roleIdsToAdd = roleIdsToAdd.concat(ggsConfig.otorol[memberType]);
  }

  if (roleIdsToAdd.length) {
    const validRoleIds = roleIdsToAdd.filter((id) =>
      member.guild.roles.cache.has(id),
    );
    if (validRoleIds.length) {
      member.roles
        .add(validRoleIds)
        .catch((err) =>
          console.error(`[AutoRole] ${member.user.tag} rol eklenemedi:`, err),
        );
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  let nickname = null;
  if (ggsConfig?.enabled && ggsConfig.otoisim?.[memberType]) {
    nickname = ggsConfig.otoisim[memberType];
  } else if (!member.user.bot && ksAutoName) {
    nickname = ksAutoName;
  }

  if (nickname) {
    member
      .setNickname(nickname)
      .catch((err) =>
        console.error(`[AutoName] ${member.user.tag} isim ayarlanamadı:`, err),
      );
    await new Promise((r) => setTimeout(r, 250));
  }

  if (ggsConfig?.enabled) {
    let text = ggsConfig.entryMessage || '';
    text = text
      .replace(/\$etiket/g, member.toString())
      .replace(/\$sayı/g, String(member.guild.memberCount))
      .replace(
        /\$katılım/g,
        member.joinedAt
          ? member.joinedAt.toLocaleDateString()
          : new Date().toLocaleDateString(),
      )
      .replace(/\$davet/g, inviterId ? `<@${inviterId}>` : 'Bilinmiyor');

    let embed;
    const m = text.match(/\$embed;(.+)/);
    if (m) {
      embed = new MessageEmbed()
        .setTitle(m[1].trim())
        .setDescription(text.replace(/\$embed;(.+)/, '').trim())
        .setColor('GREEN');
      text = null;
    }

    const ch = member.guild.channels.cache.get(ggsConfig.incomingChannel);
    if (ch) {
      try {
        if (embed) await ch.send({ embeds: [embed] });
        else await ch.send(text);
      } catch (err) {
        console.error('[GGA] Giriş mesajı gönderilemedi:', err);
      }
    } else {
      console.warn(
        `[GGA] incomingChannel bulunamadı: ${ggsConfig.incomingChannel}`,
      );
    }
  }
};
