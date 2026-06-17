const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

exports.execute = async (bot, message, args) => {
  const emojiInput = args[0];
  if (!emojiInput) {
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, lütfen eklemek istediğin emojiyi veya emoji linkini gir!`,
    );
  }

  let link = '';
  let name = '';

  if (emojiInput.startsWith('http://') || emojiInput.startsWith('https://')) {
    link = emojiInput;
    name = args.slice(1).join(' ');

    if (!name) {
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen linkin yanına bir emoji ismi belirtin! \n**Örnek:** \`addemoji <link> isim\``,
      );
    }
  } else {
    const { Util } = require('discord.js');
    const customemoji = Util.parseEmoji(emojiInput);

    if (customemoji?.id) {
      link = `https://cdn.discordapp.com/emojis/${customemoji.id}.${customemoji.animated ? 'gif' : 'png'}`;
      name = args.slice(1).join(' ') || customemoji.name;
    } else {
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, geçersiz bir emoji veya link girdiniz!`,
      );
    }
  }

  try {
    const newEmoji = await message.guild.emojis.create(link, name);
    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} Emoji Eklendi!`)
      .setColor('RANDOM')
      .setDescription(
        `${emojis.bot.succes} | **${message.member.displayName}**, emoji başarıyla sunucuya eklendi!\n**Adı:** ${newEmoji.name}\n[Önizleme](${link})`,
      );

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, emoji eklenirken bir hata oluştu! Slotlar dolu olabilir, link geçersiz olabilir ya da dosya boyutu çok büyüktür. 😵`,
    );
  }
};

exports.help = {
  name: 'addemoji',
  aliases: ['emoji-ekle', 'emote-ekle'],
  usage: 'addemoji <emoji veya link> [isim]',
  description: 'Belirtilen özel emojiyi veya emoji linkini sunucuya ekler.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MANAGE_EMOJIS_AND_STICKERS'],
};
