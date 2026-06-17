const { MessageEmbed } = require("discord.js");
const { items } = require("../index.js");
const emojis = require("../emoji.json");
const vipAd = require("../utils/vipAd");

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

exports.execute = async (client, message, args) => {
  try {
    const user = message.author;
    const isVip = !!(await client.db.get(`vips.${user.id}`));
    const cooldownKey = `cooldown_${user.id}`;
    const inventoryKey = `inventory_${user.id}`;
    const currentTime = Date.now();

    let cooldown = await client.db.get(cooldownKey);
    if (!cooldown) cooldown = 0;

    if (!Array.isArray(items) || items.length === 0) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, eşyalar listesi şu anda bomboş qwq \n> Bir şeyler yanlış gitmiş olabilir, yöneticinle iletişime geç lütfen~`
      );
    }

    const item = items[Math.floor(Math.random() * items.length)];
    const quantity = isVip
      ? Math.floor(Math.random() * 7) + 3
      : Math.floor(Math.random() * 5) + 1;

    let inventory = await client.db.get(inventoryKey);
    if (!inventory) inventory = [];

    for (let i = 0; i < quantity; i++) {
      inventory.push(item);
    }
    await client.db.set(inventoryKey, inventory);

    const cooldownTime = 20 * 1000;
    await client.db.set(cooldownKey, currentTime + cooldownTime);

    const emoji = chooseEmoji(quantity);

    const embed = new MessageEmbed()
      .setTitle(isVip ? `👑 [VIP] Eşya Toplama` : `${emojis.bot.succes} | Eşya Toplama`)
      .setDescription(
        isVip
          ? `**${message.member.displayName}**, VIP şansınız sayesinde harika eşyalar topladınız! ✨👑\n> ${emoji} ${quantity}x **${item.name}** topladınız!`
          : `**${message.member.displayName}**, şansın yaver gitti~ ✨\n> ${emoji} ${quantity}x **${item.name}** topladın!`
      )
      .setColor(isVip ? "#e1b12c" : "GREEN")
      .setTimestamp();

    if (!isVip) {
      vipAd.sendAd(message);
    }

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Hata:", error);
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, toplama sırasında ayağım taşa takıldı qwq~ \n> Hata: \`${error.message}\``
    );
  }
};

exports.help = {
  name: "topla",
  aliases: [],
  usage: "topla",
  description: "Rastgele bir eşya toplar ve envanterinize ekler.",
  category: "Ekonomi",
  cooldown: 20,
};
