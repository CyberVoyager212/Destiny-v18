const {
  MessageEmbed,
  MessageActionRow,
  MessageSelectMenu,
  MessageButton,
} = require('discord.js');

const emojis = require('../emoji.json');

const SELECT_TIMEOUT = 120000;
const ACTION_TIMEOUT = 120000;

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
    'A',
  ];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const cardOrder = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function getCombinations(arr, k) {
  const results = [];
  function comb(tmp, start) {
    if (tmp.length === k) {
      results.push(tmp);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      comb(tmp.concat(arr[i]), i + 1);
    }
  }
  comb([], 0);
  return results;
}

function evaluate5(hand) {
  const numsDesc = hand.map((c) => cardOrder[c.value]).sort((a, b) => b - a);
  const numsAsc = [...numsDesc].reverse();
  const suits = hand.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniqAsc = [...new Set(numsAsc)].sort((a, b) => a - b);
  let isStraight = false;
  let straightHigh = null;
  if (uniqAsc.length === 5) {
    if (uniqAsc[4] - uniqAsc[0] === 4) {
      isStraight = true;
      straightHigh = uniqAsc[4];
    } else if (uniqAsc.toString() === [2, 3, 4, 5, 14].toString()) {
      isStraight = true;
      straightHigh = 5;
    }
  }
  const freq = {};
  for (const c of hand) freq[c.value] = (freq[c.value] || 0) + 1;
  const pairs = Object.entries(freq)
    .map(([v, cnt]) => ({ v, cnt, n: cardOrder[v] }))
    .sort((a, b) => b.cnt - a.cnt || b.n - a.n);

  if (isStraight && isFlush && straightHigh === 14) {
    return { rank: 10, name: 'Royal Flush', tiebreak: [14], pretty: numsDesc };
  }
  if (isStraight && isFlush) {
    return {
      rank: 9,
      name: 'Straight Flush',
      tiebreak: [straightHigh],
      pretty: numsDesc,
    };
  }
  if (pairs[0] && pairs[0].cnt === 4) {
    const four = pairs[0].n;
    const kicker = numsDesc.find((n) => n !== four);
    return {
      rank: 8,
      name: 'Four of a Kind',
      tiebreak: [four, kicker],
      pretty: numsDesc,
    };
  }
  if (pairs[0] && pairs[0].cnt === 3 && pairs[1] && pairs[1].cnt === 2) {
    const three = pairs[0].n;
    const pairv = pairs[1].n;
    return {
      rank: 7,
      name: 'Full House',
      tiebreak: [three, pairv],
      pretty: numsDesc,
    };
  }
  if (isFlush) {
    return {
      rank: 6,
      name: 'Flush',
      tiebreak: numsDesc.slice(),
      pretty: numsDesc,
    };
  }
  if (isStraight) {
    return {
      rank: 5,
      name: 'Straight',
      tiebreak: [straightHigh],
      pretty: numsDesc,
    };
  }
  if (pairs[0] && pairs[0].cnt === 3) {
    const three = pairs[0].n;
    const kickers = numsDesc.filter((n) => n !== three).slice(0, 2);
    return {
      rank: 4,
      name: 'Three of a Kind',
      tiebreak: [three, ...kickers],
      pretty: numsDesc,
    };
  }
  if (pairs[0] && pairs[0].cnt === 2 && pairs[1] && pairs[1].cnt === 2) {
    const pairVals = [pairs[0].n, pairs[1].n].sort((a, b) => b - a);
    const highPair = pairVals[0];
    const lowPair = pairVals[1];
    const kicker = numsDesc.find((n) => n !== highPair && n !== lowPair);
    return {
      rank: 3,
      name: 'Two Pair',
      tiebreak: [highPair, lowPair, kicker],
      pretty: numsDesc,
    };
  }
  if (pairs[0] && pairs[0].cnt === 2) {
    const pairv = pairs[0].n;
    const kickers = numsDesc.filter((n) => n !== pairv).slice(0, 3);
    return {
      rank: 2,
      name: 'One Pair',
      tiebreak: [pairv, ...kickers],
      pretty: numsDesc,
    };
  }
  return {
    rank: 1,
    name: 'High Card',
    tiebreak: numsDesc.slice(),
    pretty: numsDesc,
  };
}

function compareTiebreak(aArr, bArr) {
  for (let i = 0; i < Math.max(aArr.length, bArr.length); i++) {
    const a = aArr[i] || 0;
    const b = bArr[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function compareHands(a, b) {
  if (a.rank > b.rank) return 1;
  if (a.rank < b.rank) return -1;
  return compareTiebreak(a.tiebreak, b.tiebreak);
}

function evaluateHand(allCards) {
  const combos = getCombinations(allCards, 5);
  let best = null;
  for (const combo of combos) {
    const res = evaluate5(combo);
    if (!best) best = Object.assign({}, res, { combo: combo.slice() });
    else {
      const cmp = compareHands(res, best);
      if (cmp === 1) best = Object.assign({}, res, { combo: combo.slice() });
    }
  }
  return best;
}

const cardEmoji = emojis.cards || {};
const cardBack = emojis.cardBack || '❔';

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money?.high || '💰';
  if (amount > 10000) return emojis.money?.medium || '💵';
  return emojis.money?.low || '🪙';
}

const SUCC = (emojis.bot && emojis.bot.succes) || '✅';
const ERR = (emojis.bot && emojis.bot.error) || '❌';

async function safeUpdateInteraction(interaction, data) {
  try {
    if (!interaction.replied && !interaction.deferred)
      return await interaction.update(data);
    if (interaction.deferred || interaction.replied) {
      try {
        return await interaction.followUp?.(data);
      } catch (e) {
        try {
          return await interaction.editReply?.(data);
        } catch (e2) {
          return null;
        }
      }
    }
    return null;
  } catch (err) {
    console.error('safeUpdateInteraction error:', err);
    return null;
  }
}

const toEmoji = (cards) =>
  cards
    .map(
      (c) =>
        cardEmoji[`${c.value}${c.suit}`] ||
        cardEmoji[c.value] ||
        `${c.value}${c.suit}`
    )
    .join(' ');

exports.execute = async (client, message, args) => {
  const user = message.author;
  const isVip = !!(await client.db.get(`vips.${user.id}`));
  const displayName = message.member?.displayName || user.username;

  const raiseMessages = [
    'Dostum, raise yapıyorum, hadi oyunu ısıtalım~',
    'Raise: Bahsi artırıyorum, ne yapacaksın owo?',
    'Ben raise yapıyorum, meydanı sallıyorum~',
    'Raise yapıyorum, hamleni göreyim~',
    'Raise: Bahsimi yükseltiyorum, oyuna renk katıyorum~',
  ];
  const callMessages = [
    'Call yapıyorum, seninle aynıyım~',
    'Call: Bahsi eşitliyorum, devam ediyorum~',
    'Ben call yapıyorum, hamlemi takip ediyorum~',
    'Call: Oyunda kalıyorum, bakalım ne olacak~',
    'Call yapıyorum, hamleni görüyorum~',
  ];
  const foldMessages = [
    'Fold: Bu eli bırakıyorum, benim için şanslı değil~',
    'Fold ediyorum, bugün şansım yaver gitmedi~',
    'Fold: Elimde iyi bir şey yok, çekiliyorum~',
    'Fold ediyorum, oyundan çıkıyorum~',
    'Fold: Bu tur bana göre değil~',
  ];

  let balanceData;
  try {
    balanceData = await client.eco.fetchMoney(user.id);
  } catch (e) {
    console.error('eco.fetchMoney hata:', e);
    return message.channel.send(
      `${ERR} Sunucudan bakiye alınamadı, sonra tekrar dene.`
    );
  }

  const balance =
    typeof balanceData === 'object' && balanceData.amount != null
      ? balanceData.amount
      : Number(balanceData) || 0;

  if (balance < 10) {
    return message.channel.send(
      `${ERR} **${displayName}**, oynamak için en az 10 ${chooseEmoji(
        10
      )} gerekiyor~ Biraz daha biriktir, sonra gel nyaa~`
    );
  }

  const betEmbed = new MessageEmbed()
    .setTitle(isVip ? '👑 [VIP] Poker Bahsi' : `${SUCC} Poker Bahsi`)
    .setDescription(
      `Bakiyen: **${balance.toLocaleString()}** ${chooseEmoji(
        balance
      )}\nLütfen bir bahis miktarı seç.`
    )
    .setColor(isVip ? '#e1b12c' : 'BLUE');

  const betRow = new MessageActionRow().addComponents(
    new MessageSelectMenu()
      .setCustomId('poker_bet')
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
      ])
  );

  const menuMsg = await message.channel.send({
    embeds: [betEmbed],
    components: [betRow],
  });

  const filter = (i) => i.user.id === user.id && i.customId === 'poker_bet';

  let selectionInteraction;
  let betAmount;

  while (true) {
    try {
      selectionInteraction = await menuMsg.awaitMessageComponent({
        filter,
        componentType: 'SELECT_MENU',
        time: SELECT_TIMEOUT,
      });

      const choice = selectionInteraction.values[0];
      const refreshed = await client.eco.fetchMoney(user.id);
      const refreshedBalance =
        typeof refreshed === 'object' && refreshed.amount != null
          ? refreshed.amount
          : Number(refreshed) || 0;

      betAmount =
        choice === 'all'
          ? Math.min(refreshedBalance, 250000)
          : parseInt(choice, 10);

      if (isNaN(betAmount) || betAmount < 10 || betAmount > 250000) {
        await selectionInteraction.reply({
          content: `${ERR} **${displayName}**, geçersiz bahis seçtin~ Lütfen 10 ile 250.000 arasında bir değer seç, tamam mı~`,
          ephemeral: true,
        });
        continue;
      }

      if (betAmount > refreshedBalance) {
        await selectionInteraction.reply({
          content: `${ERR} **${displayName}**, yeterli bakiye yok~ Bahis menüsünü tekrar açıyorum, lütfen yeniden seç owo~`,
          ephemeral: true,
        });
        continue;
      }

      break;
    } catch (err) {
      try {
        await menuMsg.edit({
          content: `${ERR} Süre doldu~ Bahis seçilmedi, istersen tekrar deneyebilirsin~`,
          embeds: [],
          components: [],
        });
      } catch (e) {
        console.error('menuMsg.edit hata:', e);
      }
      return;
    }
  }

  try {
    await client.eco.removeMoney(user.id, betAmount);
  } catch (e) {
    console.error('eco.removeMoney hata:', e);
    return message.channel.send(`${ERR} Bahis alınırken bir hata oldu.`);
  }

  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const bots = [
    { name: 'Bot 1', hand: [deck.pop(), deck.pop()] },
    { name: 'Bot 2', hand: [deck.pop(), deck.pop()] },
    { name: 'Bot 3', hand: [deck.pop(), deck.pop()] },
  ];
  const community = [
    deck.pop(),
    deck.pop(),
    deck.pop(),
    deck.pop(),
    deck.pop(),
  ];

  const startEmbed = new MessageEmbed()
    .setTitle(isVip ? '👑 [VIP] Poker Oyunu Başladı!' : `${SUCC} Poker Oyunu Başladı!`)
    .setColor(isVip ? '#e1b12c' : 'GREEN');

  const playerBest = evaluateHand(playerHand.concat(community));

  startEmbed.setDescription(
    `**Senin Kartların:** ${toEmoji(playerHand)}\n\n` +
      `**Bot Kartları:**\n${bots
        .map((b) => `${b.name}: ${cardBack} ${cardBack}`)
        .join('\n')}\n\n` +
      `**Topluluk Kartları:** ${toEmoji(community)}\n\n` +
      `**En iyi elin:** ${playerBest.name} — ${playerBest.combo
        .map((c) => `${c.value}${c.suit}`)
        .join(' ')}\n${toEmoji(playerBest.combo)}\n\n` +
      `Bahis: **${betAmount}** ${chooseEmoji(betAmount)}`
  );

  try {
    await safeUpdateInteraction(selectionInteraction, {
      embeds: [startEmbed],
      components: [],
    });
  } catch (e) {
    try {
      await menuMsg.edit({ embeds: [startEmbed], components: [] });
    } catch (e2) {
      console.error('Embed güncelleme başarısız:', e2);
    }
  }

  const actionRow = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId('action_raise')
      .setLabel('Raise')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId('action_call')
      .setLabel('Call')
      .setStyle('SUCCESS'),
    new MessageButton()
      .setCustomId('action_fold')
      .setLabel('Fold')
      .setStyle('DANGER')
  );

  const actionMsg = await message.channel.send({
    content: 'Hamleni seç (daha fazla zaman verildi):',
    components: [actionRow],
  });

  const actionCollector = actionMsg.createMessageComponentCollector({
    filter: (i) => i.user.id === user.id,
    componentType: 'BUTTON',
    time: ACTION_TIMEOUT,
  });

  actionCollector.on('collect', async (ai) => {
    try {
      let extraBet = 0;
      if (ai.customId === 'action_fold') {
        try {
          await ai.update({
            content: `${ERR} ${displayName}, fold ettin~ Oyunu kaybettin, üzgünüm~`,
            components: [],
          });
        } catch (e) {
          await ai.reply({
            content: `${ERR} ${displayName}, fold ettin~`,
            ephemeral: true,
          });
        }
        return actionCollector.stop('user_fold');
      }

      if (ai.customId === 'action_raise') {
        extraBet = Math.floor(betAmount * 0.5);
        const refreshed = await client.eco.fetchMoney(user.id);
        const refreshedBalance =
          typeof refreshed === 'object' && refreshed.amount != null
            ? refreshed.amount
            : Number(refreshed) || 0;
        if (extraBet > refreshedBalance) {
          try {
            await ai.update({
              content: `${ERR} **${displayName}**, raise için yeterli bakiye yok~`,
              components: [],
            });
          } catch (e) {
            await ai.reply({
              content: `${ERR} raise için yeterli bakiye yok~`,
              ephemeral: true,
            });
          }
          return actionCollector.stop('insufficient_raise');
        }
        await client.eco.removeMoney(user.id, extraBet);
        betAmount += extraBet;
        await ai.update({
          content: `${SUCC} Raise yaptın! Yeni bahis: **${betAmount}** ${chooseEmoji(
            betAmount
          )}`,
          components: [],
        });
      } else if (ai.customId === 'action_call') {
        await ai.update({
          content: `${SUCC} Call yaptın. Oyuna devam ediyorsun~`,
          components: [],
        });
      }

      bots.forEach((bot) => {
        const score = evaluateHand(bot.hand.concat(community));
        let action, msg;
        if (score.rank >= 9) {
          action = 'raises';
          msg = raiseMessages[Math.floor(Math.random() * raiseMessages.length)];
          bot.active = true;
        } else if (score.rank >= 2) {
          action = 'calls';
          msg = callMessages[Math.floor(Math.random() * callMessages.length)];
          bot.active = true;
        } else {
          if (Math.random() < 0.3) {
            action = Math.random() < 0.5 ? 'raises' : 'calls';
            msg = (action === 'raises' ? raiseMessages : callMessages)[
              Math.floor(Math.random() * 5)
            ];
            bot.active = true;
          } else {
            action = 'folds';
            msg = foldMessages[Math.floor(Math.random() * foldMessages.length)];
            bot.active = false;
          }
        }
        bot.action = `${bot.name}: ${msg} (El: ${score.name})`;
      });

      const botEmbed = new MessageEmbed()
        .setTitle('🤖 Bot Hamleleri')
        .setDescription(bots.map((b) => b.action).join('\n'))
        .setColor('ORANGE');
      await message.channel.send({ embeds: [botEmbed] });
      await message.channel.send(
        '💬 Botlar arasında kısa bir sohbet geçiyor...'
      );

      setTimeout(async () => {
        const activeBots = bots.filter((b) => b.active);
        if (activeBots.length === 0) {
          try {
            await client.eco.addMoney(user.id, betAmount * 2);
          } catch (e) {
            console.error('eco.addMoney hata:', e);
          }
          return message.channel.send(
            `${SUCC} Kazandın! Tüm botlar fold etti. **${
              betAmount * 2
            }** ${chooseEmoji(betAmount)} kazandın~`
          );
        }

        const playerScore = evaluateHand(playerHand.concat(community));
        const botScores = activeBots.map((b) => ({
          name: b.name,
          score: evaluateHand(b.hand.concat(community)),
        }));

        let winner = { name: 'Sen', score: playerScore };
        for (const bs of botScores) {
          if (compareHands(bs.score, winner.score) === 1) winner = bs;
        }

        if (winner.name !== 'Sen' && isVip && Math.random() < 0.25) {
          for (let attempt = 0; attempt < 25; attempt++) {
            const tempHand = [deck[Math.floor(Math.random() * deck.length)], deck[Math.floor(Math.random() * deck.length)]];
            if (!tempHand[0] || !tempHand[1]) continue;
            const tempScore = evaluateHand(tempHand.concat(community));
            let beatsAll = true;
            for (const bs of botScores) {
              if (compareHands(bs.score, tempScore) === 1) beatsAll = false;
            }
            if (beatsAll) {
              playerHand[0] = tempHand[0];
              playerHand[1] = tempHand[1];
              playerScore = tempScore;
              winner = { name: 'Sen', score: playerScore };
              break;
            }
          }
        }

        if (winner.name === 'Sen') {
          try {
            await client.eco.addMoney(user.id, betAmount * 2);
          } catch (e) {
            console.error('eco.addMoney hata:', e);
          }
          return message.channel.send(
            isVip
              ? `👑 **[VIP] Kazanan: Sen!** (${playerScore.name}) VIP şansınız sayesinde kazandınız! 👑✨\n> Kazanılan VIP Ödül: **${
                  betAmount * 2
                }** ${chooseEmoji(betAmount * 2)}`
              : `${SUCC}  Kazanan: Sen! (${playerScore.name}) **${
                  betAmount * 2
                }** ${chooseEmoji(betAmount)} kazandın~`
          );
        } else {
          return message.channel.send(
            isVip
              ? `👑 **[VIP] Kaybettiniz!** Kazanan: **${winner.name}** (${winner.score.name}).`
              : `${ERR}  Kaybettin! Kazanan: **${winner.name}** (${winner.score.name}).`
          );
        }
      }, 5000);
    } catch (e) {
      console.error('actionCollector collect hatasi:', e);
      try {
        await ai?.reply?.({
          content: `${ERR} Bir hata oldu.`,
          ephemeral: true,
        });
      } catch (e) {}
    }
  });

  actionCollector.on('end', async (collected, reason) => {
    if (collected.size === 0) {
      try {
        await actionMsg.edit({
          content: `${ERR}  Süre doldu, hamle yapmadın~`,
          components: [],
        });
      } catch (e) {
        console.error('actionMsg.edit hata:', e);
      }
    }
  });
};
