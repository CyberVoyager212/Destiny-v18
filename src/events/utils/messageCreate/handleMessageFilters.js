module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;
  const channelId = message.channel.id;
  const content = (message.content || '').trim();

  const allFilters = (await db.get(`mesajEngel_${guildId}`)) || {};
  const filters = allFilters[channelId] || [];

  if (Array.isArray(filters) && filters.length) {
    const isNumber = (txt) => /^\d+$/.test(txt);
    const isWord = (txt) => /^[\p{L}]+$/u.test(txt);
    const isURL = (txt) =>
      /(?:(?:https?|ftp):\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})([^\s]*)/i.test(
        txt,
      );

    const allowOnly = filters
      .filter((f) => f.startsWith('!'))
      .map((f) => f.slice(1));

    if (allowOnly.length) {
      const ok = allowOnly.some((f) =>
        f === '#sayı#'
          ? isNumber(content)
          : f === '#kelime#'
            ? isWord(content)
            : f === '#url#'
              ? isURL(content)
              : content === f,
      );
      if (!ok) {
        await message.delete().catch(() => {});
        return true;
      }
    } else {
      for (const f of filters) {
        if (
          (f === '#sayı#' && isNumber(content)) ||
          (f === '#kelime#' && isWord(content)) ||
          (f === '#url#' && isURL(content)) ||
          content === f
        ) {
          await message.delete().catch(() => {});
          return true;
        }
      }
    }
  }

  return false;
};
