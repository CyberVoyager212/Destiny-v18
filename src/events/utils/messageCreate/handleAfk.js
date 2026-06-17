const ms = require('ms');
const emojis = require('../../../emoji.json');

module.exports = async (client, message) => {
  const db = client.db;
  const userId = message.author.id;

  const userAfkKey = `afk_${userId}`;
  const afkData = await db.get(userAfkKey);
  if (afkData) {
    await db.delete(userAfkKey);
    const elapsed = Date.now() - afkData.start;
    await message
      .reply(
        `${emojis.bot.succes} | Artık AFK değilsin. **${ms(elapsed, {
          long: true,
        })}** boyunca AFK idin.`,
      )
      .catch(() => {});
  }

  if (message.mentions.users.size) {
    for (const [, user] of message.mentions.users) {
      if (user.bot) continue;
      const data = await db.get(`afk_${user.id}`);
      if (data) {
        await message.channel
          .send(
            `${emojis.bot.error} | <@${user.id}> şu anda AFK: ${
              data.reason || 'Belirtilmemiş'
            }`,
          )
          .catch(() => {});
      }
    }
  }

  return false;
};
