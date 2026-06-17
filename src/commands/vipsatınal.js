const emojis = require('../emoji.json');
const config = require('../botConfig');
const botName = config.botname || 'Bot';

exports.execute = async (client, message, args) => {
  try {
    const invite = config.supportServer || 'https://discord.gg/your-invite';

    const embed = {
      color: '#FFD700',
      title: '🛒 VIP Satın Al',
      description: `${botName} sunucumuzda **VIP** avantajlarından faydalanmak için aşağıdaki davet linkine tıklayarak destek sunucusuna katılabilirsiniz.\n\n${invite}\n\n🪙 **VIP avantajları**\n• Çift ödül (günlük/haftalık)\n• Kumarhane %50 indirim\n• Özel komut temaları\n\n> **Komutu kullan:** \`vipal\``,
      footer: { text: `✨ ${botName} VIP Ayrıcalıkları` },
    };

    await message.channel.send({ embeds: [embed] });
  } catch (e) {
    console.error(e);
    return message.reply(
      `${emojis.bot.error} | Bir hata oluştu, lütfen daha sonra tekrar deneyin.`,
    );
  }
};

exports.help = {
  name: 'vipsatınal',
  aliases: ['vip-satınal', 'vipal'],
  usage: 'vipsatınal',
  description:
    `${botName} destek sunucusuna davet eder ve VIP satın alma talimatlarını gösterir.`,
  category: 'Bot',
  cooldown: 10,
};
