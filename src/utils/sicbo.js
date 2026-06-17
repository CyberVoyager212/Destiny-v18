const {
  MessageEmbed,
  MessageActionRow,
  MessageSelectMenu,
  MessageButton,
} = require('discord.js');

const emojis = require('../emoji.json');

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

exports.execute = async (client, message, args) => {
  const userId = message.author.id;
  const isVip = !!(await client.db.get(`vips.${userId}`));
  const displayName = message.member?.displayName || message.author.username;

  let balance = await client.eco.fetchMoney(userId);
  const balanceEmoji = chooseEmoji(balance);

  if (balance < 10) {
    return message.reply(
      `${emojis.bot.error} | **${displayName}**, oynamak için en az 10 ${chooseEmoji(
        10,
      )} gerekiyor~ Biraz daha biriktir, tamam mı~ :c`,
    );
  }

  const betEmbed = new MessageEmbed()
    .setTitle(
      isVip ? `👑 [VIP] Sic Bo Bahis` : `${emojis.bot.succes} Sic Bo Bahis`,
    )
    .setDescription(
      `Mevcut bakiyen: **${balance.toLocaleString()}** ${balanceEmoji}\n\n` +
        'Lütfen bahis miktarını seç:\n(min: 10 • max: 250.000 veya **All**)',
    )
    .setColor(isVip ? '#e1b12c' : 'BLUE');

  const betRow = new MessageActionRow().addComponents(
    new MessageSelectMenu()
      .setCustomId('bet_amount')
      .setPlaceholder('Bahis miktarı seçin')
      .addOptions([
        { label: '10', value: '10' },
        { label: '50', value: '50' },
        { label: '100', value: '100' },
        { label: '1.000', value: '1000' },
        { label: '10.000', value: '10000' },
        { label: '50.000', value: '50000' },
        { label: '75.000', value: '75000' },
        { label: '100.000', value: '100000' },
        { label: '250.000', value: '250000' },
        { label: 'All', value: 'all' },
      ]),
  );

  const betMsg = await message.channel.send({
    embeds: [betEmbed],
    components: [betRow],
  });

  const filter = (i) => i.user.id === userId && i.customId === 'bet_amount';

  let selectionInteraction;
  let betAmount;

  while (true) {
    try {
      selectionInteraction = await betMsg.awaitMessageComponent({
        filter,
        componentType: 'SELECT_MENU',
        time: 60000,
      });
      await selectionInteraction.deferUpdate();

      const choice = selectionInteraction.values[0];
      balance = await client.eco.fetchMoney(userId);
      betAmount =
        choice === 'all' ? Math.min(balance, 250000) : parseInt(choice, 10);

      if (isNaN(betAmount) || betAmount < 10 || betAmount > 250000) {
        await selectionInteraction.followUp({
          content: `${emojis.bot.error} | **${displayName}**, geçersiz bahis seçtin~ Lütfen 10 ile 250.000 arasında bir değer seç, olur mu~?`,
          ephemeral: true,
        });
        continue;
      }

      if (betAmount > balance) {
        await selectionInteraction.followUp({
          content: `${emojis.bot.error} | **${displayName}**, yeterli bakiye yok~ Bahis menüsü süresi uzatıldı, lütfen yeniden seç~`,
          ephemeral: true,
        });
        continue;
      }

      break;
    } catch (err) {
      await betMsg.edit({
        content: `${emojis.bot.error} | **${displayName}**, süre doldu~ Bahis yapılmadı, istersen tekrar deneyebilirsin~`,
        embeds: [],
        components: [],
      });
      return;
    }
  }

  await client.eco.removeMoney(userId, betAmount);
  const betEmoji = chooseEmoji(betAmount);

  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId('high')
      .setLabel('Yüksek (11-17)')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId('low')
      .setLabel('Alçak (4-10)')
      .setStyle('DANGER'),
  );

  const chooseEmbed = new MessageEmbed()
    .setTitle(
      isVip ? `👑 [VIP] Sic Bo Seçim` : `${emojis.bot.succes} Sic Bo Seçim`,
    )
    .setDescription(
      `Bahis: **${betAmount.toLocaleString()}** ${betEmoji}\n\n` +
        'Yüksek mi (11-17), yoksa Alçak mı (4-10) seç?',
    )
    .setColor(isVip ? '#e1b12c' : 'BLUE');

  const chooseMsg = await selectionInteraction.followUp({
    embeds: [chooseEmbed],
    components: [row],
    fetchReply: true,
  });

  const btnFilter = (i) => i.user.id === userId;
  try {
    const btn = await chooseMsg.awaitMessageComponent({
      filter: btnFilter,
      componentType: 'BUTTON',
      time: 30000,
    });
    await btn.deferUpdate();
    const btnChoice = btn.customId;

    const roll = () => Math.floor(Math.random() * 6) + 1;
    let dices = [roll(), roll(), roll()];
    let total = dices.reduce((a, b) => a + b, 0);

    let isHigh = total >= 11 && total <= 17;
    let isLow = total >= 4 && total <= 10;
    let won =
      (btnChoice === 'high' && isHigh) || (btnChoice === 'low' && isLow);

    if (!won && isVip && Math.random() < 0.25) {
      for (let attempt = 0; attempt < 15; attempt++) {
        dices = [roll(), roll(), roll()];
        total = dices.reduce((a, b) => a + b, 0);
        isHigh = total >= 11 && total <= 17;
        isLow = total >= 4 && total <= 10;
        won =
          (btnChoice === 'high' && isHigh) || (btnChoice === 'low' && isLow);
        if (won) break;
      }
    }

    if (won) {
      await client.eco.addMoney(userId, betAmount);
    }

    const resultEmbed = new MessageEmbed()
      .setTitle(
        won
          ? isVip
            ? `👑 [VIP] Sic Bo Sonuç (Kazandın!)`
            : `${emojis.bot.succes} Sic Bo Sonuç`
          : isVip
            ? `👑 [VIP] Sic Bo Sonuç`
            : `${emojis.bot.error} 🎲 Sic Bo Sonuç`,
      )
      .setDescription(
        `Zarlar: **${dices.join(' - ')}** (Toplam: **${total}**)\n` +
          (won
            ? `✅ **Kazandın, bravo~ ${displayName}!**\n\nKazanç: **${betAmount.toLocaleString()}** ${chooseEmoji(betAmount)}`
            : `❌ **Kaybettin, üzgünüm~ :c**\n\nKaybettiğin: **${betAmount.toLocaleString()}** ${chooseEmoji(betAmount)}`),
      )
      .setColor(won ? (isVip ? '#FFD700' : 'GREEN') : 'RED');

    await btn.editReply({ embeds: [resultEmbed], components: [] });
  } catch (err) {
    await chooseMsg.edit({
      content: `${emojis.bot.error} | **${displayName}**, Süre doldu, seçim yapılmadı. :c`,
      embeds: [],
      components: [],
    });
  }
};
