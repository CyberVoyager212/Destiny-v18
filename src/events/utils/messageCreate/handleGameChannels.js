module.exports = async (client, message) => {
  const db = client.db;
  const guildId = message.guild.id;

  const bomChannelId = await db.get(`bom_${guildId}`);
  const kelimeChannelId = await db.get(`kelime_${guildId}`);

  if (bomChannelId && message.channel.id === bomChannelId) {
    let lastNumber = (await db.get(`bom_lastNumber_${bomChannelId}`)) || 0;
    let lastUser = await db.get(`bom_lastUser_${bomChannelId}`);
    if (message.author.id === lastUser) {
      message.delete().catch(() => {});
      return true;
    }
    const contentLower = message.content.trim().toLowerCase();
    const expectedNumber = lastNumber + 1;
    let isCorrect = false;
    let playedValue = null;
    if (expectedNumber % 5 === 0) {
      if (contentLower === 'bom') {
        isCorrect = true;
        playedValue = expectedNumber;
      }
    } else {
      const current = parseInt(contentLower);
      if (!isNaN(current) && current === expectedNumber) {
        isCorrect = true;
        playedValue = current;
      }
    }
    if (!isCorrect) {
      message.delete().catch(() => {});
      return true;
    }
    await message.react('✅').catch(() => {});
    await db.set(`bom_lastNumber_${bomChannelId}`, playedValue);
    await db.set(`bom_lastUser_${bomChannelId}`, message.author.id);
    return true;
  }

  if (kelimeChannelId && message.channel.id === kelimeChannelId) {
    const lastUser = await db.get(`kelime_lastUser_${kelimeChannelId}`);
    const usedWords =
      (await db.get(`kelime_usedWords_${kelimeChannelId}`)) || [];

    if (message.author.id === lastUser) {
      message.delete().catch(() => {});
      return true;
    }

    const newWord = message.content.toLowerCase().trim();

    let isValidWord = false;
    try {
      const res = await fetch(
        `https://sozluk.gov.tr/gts?ara=${encodeURIComponent(newWord)}`,
      );
      const j = await res.json();
      isValidWord = Array.isArray(j) && j.length > 0 && j[0].madde;
    } catch {
      isValidWord = false;
    }

    if (!isValidWord) {
      message.delete().catch(() => {});
      return true;
    }

    if (usedWords.includes(newWord)) {
      message.delete().catch(() => {});
      return true;
    }

    usedWords.push(newWord);
    await db.set(`kelime_usedWords_${kelimeChannelId}`, usedWords);
    await message.react('✅').catch(() => {});

    await db.set(`kelime_lastWord_${kelimeChannelId}`, newWord);
    await db.set(`kelime_lastUser_${kelimeChannelId}`, message.author.id);
    return true;
  }

  const animeChannelId = await db.get(`animeChannel_${guildId}`);
  if (animeChannelId && message.channel.id === animeChannelId) {
    const animeName = message.content.trim();

    if (animeName.length > 0) {
      let animePool = (await db.get(`animePool_${guildId}`)) || [];

      const isExist = animePool.some(
        (a) => a.toLowerCase() === animeName.toLowerCase(),
      );

      if (!isExist) {
        animePool.push(animeName);
        await db.set(`animePool_${guildId}`, animePool);

        await message.react('🔥').catch(() => null);
      } else {
        const warn = await message
          .reply('Bu anime zaten havuzda mevcut! ⏱')
          .catch(() => null);
        setTimeout(() => {
          message.delete().catch(() => null);
          if (warn) warn.delete().catch(() => null);
        }, 4000);
      }
    }
    return true;
  }

  return false;
};
