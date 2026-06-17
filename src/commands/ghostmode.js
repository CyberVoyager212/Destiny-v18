const emojis = require('../emoji.json');

module.exports = {
  help: {
    name: 'ghostmode',
    aliases: ['gizlimesaj', 'silinmesiçin'],
    usage: 'ghostmode <süre (saniye)> <mesaj>',
    description:
      'Gönderilen mesajları belirli bir süre sonra otomatik olarak siler.',
    category: 'Moderasyon',
    cooldown: 5,
    permissions: ['MANAGE_MESSAGES'],
  },

  async execute(client, message, args) {
    try {
      let time = parseInt(args[0]);
      if (isNaN(time) || time <= 0) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, geçerli bir süre girmelisin yaa :c\nÖrn: \`ghostmode 5 Bu mesaj 5 saniye sonra silinecek~\``,
        );
      }

      let content = args.slice(1).join(' ');
      if (!content) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, mesajını da yazsan çok mutlu olurdum >w<`,
        );
      }

      const sentMessage = await message.channel.send(content);

      setTimeout(() => {
        sentMessage.delete().catch(() => {});
      }, time * 1000);

      await message.delete().catch(() => {});

      return message.channel.send(
        `${emojis.bot.succes} | **${message.member.displayName}**, mesajın ${time} saniye sonra uçup gidecek~ 👻✨`,
      );
    } catch (err) {
      console.error('Ghostmode hata:', err);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, ayy~ hayalet modda bir sorun çıktı :c\nTekrar denemeyi dener misin? >///<`,
      );
    }
  },
};
