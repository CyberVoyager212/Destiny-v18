const handleAutomod = require('./utils/messageCreate/handleAutomod');
const handleGameChannels = require('./utils/messageCreate/handleGameChannels');
const handleRestrictedTags = require('./utils/messageCreate/handleRestrictedTags');
const handleMessageFilters = require('./utils/messageCreate/handleMessageFilters');
const handleAutoResponse = require('./utils/messageCreate/handleAutoResponse');
const handleAdvancedWordFilter = require('./utils/messageCreate/handleAdvancedWordFilter');
const handleAfk = require('./utils/messageCreate/handleAfk');
const handleAIChat = require('./utils/messageCreate/handleAIChat');
const handleCommandHandler = require('./utils/messageCreate/handleCommandHandler');

module.exports = async (client, message) => {
  if (message.author.bot || !message.guild) return;

  const db = client.db;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const content = (message.content || '').trim();
  const ownerId = client.config && client.config.ownerId;
  const admins = (client.config && client.config.admins) || [];
  const isPrivilegedUser = userId === ownerId || admins.includes(userId);

  const botBakimda = Boolean(await db.get('bakim_botKapali'));
  if (botBakimda && !isPrivilegedUser) return;

  const logEntry = {
    userID: userId,
    timestamp: Date.now(),
  };
  const guildKey = `messageLogs_${guildId}`;
  let messageLogs = (await db.get(guildKey)) || [];
  messageLogs.push(logEntry);
  if (messageLogs.length > 1000) {
    messageLogs = messageLogs.slice(messageLogs.length - 1000);
  }
  await db.set(guildKey, messageLogs);

  const globalPrefix = (client.config && client.config.prefix) || '!';
  const guildPrefix = await db.get(`prefix_${guildId}`);
  let prefix =
    guildPrefix && content.startsWith(guildPrefix) ? guildPrefix : globalPrefix;

  if (await handleAutomod(client, message)) return;

  if (await handleGameChannels(client, message)) return;

  if (!content.startsWith(prefix)) {
    if (await handleRestrictedTags(client, message)) return;
    if (await handleMessageFilters(client, message)) return;
    if (await handleAutoResponse(client, message)) return;
  }

  if (await handleAdvancedWordFilter(client, message)) return;

  await handleAfk(client, message);

  if (await handleAIChat(client, message)) return;

  await handleCommandHandler(client, message, prefix);
};
