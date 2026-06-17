module.exports = async (client, message) => {
  if (
    !message.partial &&
    message.author &&
    message.author.id !== client.user.id
  ) {
    const guildKey = `deletedMessages_${message.guild.id}`;
    const deletedMessages = (await client.db.get(guildKey)) || [];
    const timestamp = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    let displayName = message.member?.displayName;
    if (!displayName) {
      try {
        const fetched = await message.guild.members.fetch(message.author.id);
        displayName = fetched ? fetched.displayName : message.author.username;
      } catch (err) {
        displayName = message.author.username;
      }
    }

    let content = message.content;
    if (!content || content.trim() === '') {
      if (message.attachments && message.attachments.size > 0) {
        content = `[attachment: ${message.attachments
          .map((a) => a.name || a.id)
          .join(', ')}]`;
      } else {
        content = '[no content]';
      }
    }

    deletedMessages.unshift(`[${timestamp}] **${displayName}**: ${content}`);
    await client.db.set(guildKey, deletedMessages);
  }
};
