module.exports = async (client, message) => {
  const animeChannelId = await client.db.get(`animeChannel_${message.guild.id}`);
  if (animeChannelId && message.channel.id === animeChannelId) {
    const animeName = message.content?.trim();
    if (animeName) {
      let animePool = (await client.db.get(`animePool_${message.guild.id}`)) || [];
      const updatedPool = animePool.filter((a) => a.toLowerCase() !== animeName.toLowerCase());
      
      if (animePool.length !== updatedPool.length) {
        await client.db.set(`animePool_${message.guild.id}`, updatedPool);
      }
    }
  }
};
