const emojis = require('../emoji.json');

exports.execute = async (client, message, args) => {
  try {
    const user = message.mentions.users.first();
    if (!user) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, kimi hedef alacağını söylemelisin~ >w<\nÖrnek: \`removeitem @kullanıcı Elmas\``,
      );
    }

    const itemName = args.slice(1).join(' ');
    if (!itemName) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, hangi eşyayı kaldırmak istediğini belirtmeyi unuttun~ UwU\nÖrnek: \`removeitem @kullanıcı Elmas\``,
      );
    }

    const inventoryKey = `inventory_${user.id}`;
    const inventory = (await client.db.get(inventoryKey)) || [];

    const itemIndex = inventory.findIndex(
      (item) => item.name.toLowerCase() === itemName.toLowerCase(),
    );
    if (itemIndex === -1) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, ahh! \`${itemName}\` adında bir eşya ${user.username}’ın envanterinde yokmuş~ :c`,
      );
    }

    const removedItem = inventory[itemIndex];
    if (!removedItem.emoji) removedItem.emoji = '❓';

    inventory.splice(itemIndex, 1);
    await client.db.set(inventoryKey, inventory);

    return message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, ${user.username} kullanıcısından bir eşya başarıyla kaldırıldı~!\n🗑️ **Silinen Eşya:** ${removedItem.emoji} ${removedItem.name}`,
    );
  } catch (error) {
    console.error('removeitem komutu hata:', error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, işler biraz karıştı... sistemim küçük bir hata verdi~ >.< \nLütfen tekrar dene, olur mu?`,
    );
  }
};

exports.help = {
  name: 'removeitem',
  aliases: [],
  usage: 'removeitem @user <item_name>',
  description: 'Kullanıcının envanterinden bir eşyayı siler.',
  category: 'Ekonomi',
  cooldown: 5,
  admin: true,
};
