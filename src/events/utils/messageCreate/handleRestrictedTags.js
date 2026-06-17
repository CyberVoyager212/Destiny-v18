const ms = require('ms');
const emojis = require('../../../emoji.json');
const { sendTemporaryNotice } = require('./helpers');

module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const channelId = message.channel.id;

  if (message.mentions.users.size) {
    for (const user of message.mentions.users.values()) {
      if (await db.get(`etiketYasak_${guildId}_${user.id}`)) {
        await message.delete().catch(() => {});
        const warnKey = `warn_${guildId}_${userId}`;
        const bwKey = `bw_${guildId}_${userId}`;
        let warnCount = (await db.get(warnKey)) || 0;
        let bwCount = (await db.get(bwKey)) || 0;

        if (bwCount >= 5) {
          await message.guild.members
            .ban(userId, { reason: '5 büyük uyarı' })
            .catch(() => {});
          await db.delete(bwKey);
          await sendTemporaryNotice(
            message.channel,
            `${emojis.bot.error} | 5 büyük uyarı → banlandın!`,
            {
              lockKey: `automod:tagban:${guildId}:${channelId}:${userId}`,
              deleteAfterMs: 7000,
            },
          );
          return true;
        }

        warnCount++;
        await db.set(warnKey, warnCount);

        if (warnCount >= 3) {
          const member = message.guild.members.cache.get(userId);
          if (member?.manageable) {
            try {
              await member.timeout(ms('10m'), '3 küçük uyarı doldu');
            } catch {}
          }
          await db.delete(warnKey);
          await db.add(bwKey, 1);
          await sendTemporaryNotice(
            message.channel,
            `${emojis.bot.error} | 3 küçük uyarı → 10dk timeout + 1 büyük uyarı!`,
            {
              lockKey: `automod:tagtimeout:${guildId}:${channelId}:${userId}`,
              deleteAfterMs: 7000,
            },
          );
          return true;
        } else {
          await sendTemporaryNotice(
            message.channel,
            `${emojis.bot.error} | Yasaklı etiket! Küçük uyarı: ${warnCount}/3`,
            {
              lockKey: `automod:tagwarn:${guildId}:${channelId}:${userId}`,
              deleteAfterMs: 6000,
            },
          );
          return true;
        }
      }
    }
  }

  return false;
};
