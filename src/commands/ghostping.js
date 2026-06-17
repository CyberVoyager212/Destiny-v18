const emojis = require('../emoji.json');

module.exports = {
  help: {
    name: 'ghostping',
    aliases: ['hayaletping', 'gp'],
    usage: 'ghostping <@kullanıcı | KullanıcıAdı | KullanıcıID>',
    description:
      'Belirtilen kullanıcıya hayalet ping atar ve mesajı hemen siler.',
    category: 'Moderasyon',
    cooldown: 5,
    permissions: ['MANAGE_MESSAGES'],
  },

  async execute(client, message, args) {
    try {
      let user =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]) ||
        message.guild.members.cache.find(
          (m) => m.user.username.toLowerCase() === args.join(' ').toLowerCase(),
        );

      if (!user) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, geçerli bir kullanıcı belirtmelisin! (Etiket, Kullanıcı Adı veya ID) >w<`,
        );
      }

      const sentMessage = await message.channel.send(`${user}`);

      setTimeout(() => {
        sentMessage.delete().catch(() => {});
      }, 1000);

      await message.delete().catch(() => {});

      return message.channel.send(
        `${emojis.bot.succes} | **${message.member.displayName}**, hayalet ping gönderildi~ 👻✨`,
      );
    } catch (err) {
      console.error('Ghostping hata:', err);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, ayy~ hayalet pingde bir sorun çıktı :c\nTekrar denemeyi dener misin? >///<`,
      );
    }
  },
};
