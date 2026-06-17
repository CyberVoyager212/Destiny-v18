module.exports = async (client) => {
  try {
    const hunt = require('../../../commands/huntbot');
    if (typeof hunt.restoreHuntTasks === 'function') {
      await hunt.restoreHuntTasks(client);
    }
  } catch (err) {
    console.warn(
      '[Ready] huntbot görevleri restore edilemedi veya bulunamadı.'
    );
  }
};
