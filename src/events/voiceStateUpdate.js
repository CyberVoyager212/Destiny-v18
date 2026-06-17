const handleBotAutoVC = require('./utils/voiceStateUpdate/handleBotAutoVC');
const handlePrivateSessions = require('./utils/voiceStateUpdate/handlePrivateSessions');

module.exports = async (client, oldState, newState) => {
  try {
    await handleBotAutoVC(client, oldState, newState);
    await handlePrivateSessions(client, oldState, newState);
  } catch (e) {
    console.error('voiceStateUpdate error:', e);
  }
};
