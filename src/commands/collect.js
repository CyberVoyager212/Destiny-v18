const { MessageEmbed } = require('discord.js');
const { readPlayers, writePlayers, readPetsPool } = require('../utils/battleData');
const emojis = require('../emoji.json');
const vipAd = require('../utils/vipAd');

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports.help = {
  name: 'collect',
  usage:
    'collect | collect env | collect use <diamond|emerald|heart> | collect stop <diamond|emerald|heart>',
  description:
    'Hayvan toplama komutu. (diamonds/emeralds/hearts etkiler). collect env ile sahip olduklarını gör, collect use ile gem kullan.',
  category: 'Battle',
  cooldown: 10,
};

module.exports.execute = async (client, message, args) => {
  const userId = message.author.id;
  const isVip = !!(await client.db.get(`vips.${userId}`));
  const sub = (args[0] || '').toLowerCase();

  const playerDB = readPlayers();
  const pools = readPetsPool();

  const defaults = {
    inventory: { diamonds: [], emeralds: [], hearts: [] },
    team: [],
    pool: {},
    activeGems: { diamond: false, emerald: false, heart: false },
  };

  const player = Object.assign({}, defaults, playerDB[userId] || {});

  if (sub === 'env') {
    const fields = [];
    fields.push({
      name: 'Diamonds',
      value: `${player.inventory.diamonds.length} adet`,
      inline: true,
    });
    fields.push({
      name: 'Emeralds',
      value: `${player.inventory.emeralds.length} adet`,
      inline: true,
    });
    fields.push({
      name: 'Hearts',
      value: `${player.inventory.hearts.length} adet`,
      inline: true,
    });
    fields.push({
      name: 'Kullanılan Gemler',
      value: `Diamond: ${
        player.activeGems.diamond ? 'Aktif' : 'Kapalı'
      }\nEmerald: ${player.activeGems.emerald ? 'Aktif' : 'Kapalı'}\nHeart: ${
        player.activeGems.heart ? 'Aktif' : 'Kapalı'
      }`,
      inline: false,
    });

    const chunks = chunkArray(fields, 6);
    for (let i = 0; i < chunks.length; i++) {
      const embed = new MessageEmbed()
        .setTitle(isVip ? `👑 [VIP] Gem Envanteri` : `${emojis.bot.succes} | Gem Envanteri`)
        .setDescription(isVip ? 'Değerli VIP üyemizin gem envanteri aşağıdadır~ ✨' : 'Elindeki gemlerin özeti aşağıda, senpai~')
        .setColor(isVip ? '#e1b12c' : 'GREEN');
      chunks[i].forEach((f) => embed.addField(f.name, f.value, f.inline));
      if (isVip) {
        embed.setFooter({ text: `👑 VIP Üye • Sayfa ${i + 1}/${chunks.length}` });
      } else {
        embed.setFooter({ text: `Sayfa ${i + 1}/${chunks.length}` });
        if (i === chunks.length - 1) {
          vipAd.sendAd(message);
        }
      }
      await message.channel.send({ embeds: [embed] });
    }
    return;
  }

  if (sub === 'use') {
    const t = (args[1] || '').toLowerCase();
    if (!['diamond', 'emerald', 'heart'].includes(t)) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hatalı Kullanım`)
        .setDescription(
          'Kullanım: collect use <diamond|emerald|heart> — hangi gemi kullanmak istediğini yaz, senpai~'
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }
    if (player.activeGems[t]) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Zaten Aktif`)
        .setDescription(
          `Bu kategoriden zaten 1 adet aktif. Aynı kategoriden yalnızca 1 gem kullanabilirsin, ne yazık ki... (╥﹏╥)`
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }
    const invKey =
      t === 'diamond' ? 'diamonds' : t === 'emerald' ? 'emeralds' : 'hearts';
    if (!player.inventory[invKey] || player.inventory[invKey].length === 0) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Bulunamadı`)
        .setDescription(
          `Elinde ${t} yokmuş gibi görünüyor. Önce onu toplamayı dene, sempai.`
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }
    player.activeGems[t] = true;
    playerDB[userId] = player;
    writePlayers(playerDB);

    const s = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Gem Kullanıldı`)
      .setDescription(
        `${t} artık aktif. Collect kullandıkça bu gemden 1 adet tükenir. (İstersen: collect stop ${t})`
      )
      .setColor('GREEN');
    return message.channel.send({ embeds: [s] });
  }

  if (sub === 'stop') {
    const t = (args[1] || '').toLowerCase();
    if (!['diamond', 'emerald', 'heart'].includes(t)) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hatalı Kullanım`)
        .setDescription(
          'Kullanım: collect stop <diamond|emerald|heart> — hangi gemi devre dışı bırakacağını yaz.'
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }
    if (!player.activeGems[t]) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Zaten Kapalı`)
        .setDescription(
          `Bu kategoride aktif bir gemin yok ki devre dışı bırakabileyim, sempai. (。_。)`
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }
    player.activeGems[t] = false;
    playerDB[userId] = player;
    writePlayers(playerDB);
    const s = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Gem Devre Dışı`)
      .setDescription(
        `${t} artık devre dışı. Dinlenip geri gelebilirsin, sempai~`
      )
      .setColor('GREEN');
    return message.channel.send({ embeds: [s] });
  }

  const weightBase = isVip
    ? { common: 40, rare: 35, epic: 18, legendary: 7 }
    : { common: 70, rare: 20, epic: 8, legendary: 2 };
  const weight = Object.assign({}, weightBase);

  function invKeyOf(type) {
    return type === 'diamond' ? 'diamonds' : type === 'emerald' ? 'emeralds' : 'hearts';
  }

  function hasGem(type) {
    const k = invKeyOf(type);
    return !!(player.inventory[k] && player.inventory[k].length > 0);
  }

  function ensureActiveGem(type) {
    if (!player.activeGems[type]) return false;
    if (!hasGem(type)) {
      player.activeGems[type] = false;
      return false;
    }
    return true;
  }

  function consumeActiveGem(type) {
    if (!player.activeGems[type]) return false;
    const k = invKeyOf(type);
    if (!player.inventory[k] || player.inventory[k].length === 0) {
      player.activeGems[type] = false;
      return false;
    }
    player.inventory[k].pop();
    if (player.inventory[k].length === 0) player.activeGems[type] = false;
    return true;
  }

  const emeraldActive = ensureActiveGem('emerald');
  const heartActive = ensureActiveGem('heart');
  const diamondActive = ensureActiveGem('diamond');

  const invEmeralds = player.inventory.emeralds || [];
  if (invEmeralds.length > 0) {
    weight.common = Math.max(0, weight.common - 20);
    weight.rare += 10;
    weight.epic += 8;
    weight.legendary += 2;
  }
  if (emeraldActive) {
    weight.common = Math.max(0, weight.common - 30);
    weight.rare += 15;
    weight.epic += 10;
    weight.legendary += 5;
  }

  const sum = Object.values(weight).reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  let cum = 0;
  let rarity = 'common';
  for (const k of Object.keys(weight)) {
    cum += weight[k];
    if (r <= cum) {
      rarity = k;
      break;
    }
  }

  const choices =
    (pools.PET_POOL && pools.PET_POOL[rarity]) ||
    (pools.PET_POOL && pools.PET_POOL.common) ||
    [];
  if (!choices.length) {
    const e = new MessageEmbed()
      .setTitle(`${emojis.bot.error} | Havuz Boş`)
      .setDescription(
        'Maalesef pet havuzunda uygun bir pet bulunamadı. Admin ile konuşur musun, sempai?'
      )
      .setColor('DARK_RED');
    return message.channel.send({ embeds: [e] });
  }

  const pick = choices[Math.floor(Math.random() * choices.length)];
  const newPet = {
    id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: pick.name || 'Vahşi',
    level: pick.baseLevel || 1,
    xp: 0,
    items: {},
  };

  const invHearts = player.inventory.hearts || [];
  if (invHearts.length > 0) newPet.xp += 50;
  if (heartActive) newPet.xp += 100;

  const foundGems = [];
  const gemRoll = Math.random() * 100;
  let diamondChance = isVip ? 15 : 5;
  let emeraldChance = isVip ? 25 : 10;
  let heartChance = isVip ? 45 : 25;

  if (diamondActive) diamondChance += 10;
  if (emeraldActive) {
    /* already applied to rarity */
  }
  if (heartActive) {
    /* heart gives xp above */
  }

  if (gemRoll <= diamondChance) {
    player.inventory.diamonds = player.inventory.diamonds || [];
    player.inventory.diamonds.push({
      id: `${Date.now()}d${Math.floor(Math.random() * 1000)}`,
    });
    foundGems.push('diamond');
  } else if (gemRoll <= diamondChance + emeraldChance) {
    player.inventory.emeralds = player.inventory.emeralds || [];
    player.inventory.emeralds.push({
      id: `${Date.now()}e${Math.floor(Math.random() * 1000)}`,
    });
    foundGems.push('emerald');
  } else if (gemRoll <= diamondChance + emeraldChance + heartChance) {
    player.inventory.hearts = player.inventory.hearts || [];
    player.inventory.hearts.push({
      id: `${Date.now()}h${Math.floor(Math.random() * 1000)}`,
    });
    foundGems.push('heart');
  }

  player.pool = player.pool || {};
  player.pool[newPet.id] = newPet;

  if (player.inventory.diamonds && player.inventory.diamonds.length > 0)
    player.inventory.diamonds = player.inventory.diamonds;
  if (player.inventory.emeralds && player.inventory.emeralds.length > 0)
    player.inventory.emeralds = player.inventory.emeralds;
  if (player.inventory.hearts && player.inventory.hearts.length > 0)
    player.inventory.hearts = player.inventory.hearts;

  const usedActives = [];
  if (emeraldActive && consumeActiveGem('emerald')) usedActives.push('emerald');
  if (heartActive && consumeActiveGem('heart')) usedActives.push('heart');
  if (diamondActive && consumeActiveGem('diamond')) usedActives.push('diamond');

  playerDB[userId] = player;
  writePlayers(playerDB);

  const fields = [];
  fields.push({
    name: 'Pet',
    value: `${newPet.name} (Lv ${newPet.level})`,
    inline: true,
  });
  fields.push({ name: 'Rarity', value: rarity.toUpperCase(), inline: true });
  fields.push({ name: 'Gained XP', value: `${newPet.xp} XP`, inline: true });
  if (foundGems.length)
    fields.push({
      name: 'Bulunan Gemler',
      value: foundGems.map((g) => g.toUpperCase()).join(', '),
      inline: false,
    });
  fields.push({
    name: 'Envanter (Özet)',
    value: `Diamonds: ${player.inventory.diamonds.length} • Emeralds: ${player.inventory.emeralds.length} • Hearts: ${player.inventory.hearts.length}`,
    inline: false,
  });
  fields.push({
    name: 'Aktif Gemler',
    value: `Diamond: ${
      player.activeGems.diamond ? 'Aktif' : 'Kapalı'
    }\nEmerald: ${player.activeGems.emerald ? 'Aktif' : 'Kapalı'}\nHeart: ${
      player.activeGems.heart ? 'Aktif' : 'Kapalı'
    }`,
    inline: false,
  });
  if (usedActives.length) {
    fields.push({
      name: 'Tükenen (Aktif)',
      value: usedActives.map((g) => g.toUpperCase()).join(', '),
      inline: false,
    });
  }

  const chunks = chunkArray(fields, 6);
  for (let i = 0; i < chunks.length; i++) {
    const embed = new MessageEmbed()
      .setTitle(isVip ? `👑 [VIP] Yeni Hayvan Toplandı` : `${emojis.bot.succes} | Yeni Hayvan Toplandı`)
      .setDescription(isVip ? `Yatta! Değerli VIP üyemiz **${message.member.displayName}** yeni bir pet topladı! ✨` : 'Yatta! Yeni bir pet topladın, çok sevimli! Kawaii~')
      .setColor(isVip ? '#e1b12c' : 'GREEN');
    chunks[i].forEach((f) => embed.addField(f.name, f.value, f.inline));
    if (i === 0 && foundGems.length === 0) {
      if (isVip) {
        embed.setFooter({ text: 'Şans bu sefer gülmedi ama VIP gücünle bir dahaki sefere kesin bulursun! ✨' });
      } else {
        embed.setFooter({ text: 'Hiç gem bulamadın bu sefer ama üzülme, tekrar dene~' });
      }
    }
    if (chunks.length > 1) {
      embed.setFooter({ text: `Sayfa ${i + 1}/${chunks.length}` });
    }
    if (!isVip && i === chunks.length - 1) {
      vipAd.sendAd(message);
    }
    await message.channel.send({ embeds: [embed] });
  }
};
