const { MessageEmbed } = require('discord.js');
const { sendChallenge } = require('../utils/battlefriend');
const { applyXpAndLevel } = require('../utils/levelup');
const {
  readPlayers,
  writePlayers,
  readPetsPool,
  readWeaponsPool,
  readWeaponsDb,
  writeWeaponsDb,
  readBattleStats,
  writeBattleStats,
} = require('../utils/battleData');
const emojis = require('../emoji.json');

function getPlayer(userId) {
  const p = readPlayers();
  return p[userId] || null;
}
function savePlayer(userId, data) {
  const p = readPlayers();
  p[userId] = data;
  writePlayers(p);
}

function resolvePet(player, petRef) {
  if (!petRef) return null;
  if (typeof petRef === 'object') {
    return petRef;
  }
  const pool = (player && player.pool) || {};
  return pool[petRef] || null;
}

function savePetToPlayer(player, pet) {
  player.pool = player.pool || {};
  if (pet && pet.id) {
    player.pool[pet.id] = pet;
  } else {

  }
  if (Array.isArray(player.team)) {
    for (let i = 0; i < player.team.length; i++) {
      const t = player.team[i];
      if (t && typeof t === 'object' && t.id && pet.id && t.id === pet.id) {
        player.team[i] = pet;
      }
    }
  }
}

function normalizePlayerData(player) {
  const defaults = {
    team: [null, null, null],
    pool: {},
    inventory: { diamonds: [], emeralds: [], hearts: [] },
    activeGems: { diamond: false, emerald: false, heart: false },
    streak: 0,
    winTimestamps: [],
    lastBattleAt: 0,
  };
  const out = Object.assign({}, defaults, player || {});

  if (!Array.isArray(out.team)) out.team = [null, null, null];
  if (!out.pool) out.pool = {};

  if (Array.isArray(out.pool)) {
    const tmp = {};
    out.pool.forEach((p) => {
      if (p && p.id) tmp[p.id] = p;
    });
    out.pool = tmp;
  }

  for (let i = 0; i < out.team.length; i++) {
    const v = out.team[i];
    if (v && typeof v === 'object' && v.id) {
      out.pool[v.id] = out.pool[v.id] || v;
      out.team[i] = v.id;
    }
  }

  return out;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function rarityMult(r) {
  return { common: 1, rare: 1.1, epic: 1.25, legendary: 1.45 }[r] || 1;
}

function sumStats(a, b) {
  const out = Object.assign({ atk: 0, def: 0, mag: 0 }, a || {});
  const bb = b || {};
  out.atk += bb.atk || 0;
  out.def += bb.def || 0;
  out.mag += bb.mag || 0;
  return out;
}

function weaponStats(weapon) {
  if (!weapon || typeof weapon !== 'object') return { atk: 0, def: 0, mag: 0 };
  if (!weapon.parts || typeof weapon.parts !== 'object')
    return { atk: 0, def: 0, mag: 0 };
  const a = weapon.parts.attack && weapon.parts.attack.stats;
  const d = weapon.parts.armor && weapon.parts.armor.stats;
  const m = weapon.parts.magic && weapon.parts.magic.stats;
  return sumStats(sumStats(a, d), m);
}

function getPetWeapon(pet, weaponsDb) {
  const wid = pet && pet.items ? pet.items.weaponId : null;
  if (!wid) return null;
  const w = weaponsDb ? weaponsDb[wid] : null;
  if (!w) return null;
  return w;
}

function computePetStats(pet, weaponsDb) {
  const lvl = pet.level || 1;
  const w = getPetWeapon(pet, weaponsDb);
  const r = (w && w.rarity) || (pet.items && pet.items.rarity) || 'common';
  const mult = rarityMult(r);
  const bonus = weaponStats(w);
  const baseHp = 22 + lvl * 7;
  const baseAtk = 4 + lvl * 2;
  const baseDef = 2 + lvl * 1;
  const baseMag = 3 + lvl * 1;
  const maxHp = Math.round(baseHp * mult + (bonus.def || 0) * 2);
  return {
    rarity: r,
    maxHp,
    atk: Math.round((baseAtk + (bonus.atk || 0)) * mult),
    def: Math.round((baseDef + (bonus.def || 0)) * mult),
    mag: Math.round((baseMag + (bonus.mag || 0)) * mult),
  };
}

function pickWeighted(weights) {
  const entries = Object.entries(weights || {}).filter(([, v]) => (v || 0) > 0);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  if (sum <= 0) return 'common';
  let r = Math.random() * sum;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function buildEnemyTeamFromPlayer(playerTeam, weaponsDb) {
  const poolFile = readPetsPool() || {};
  const pool = poolFile.PET_POOL || {};
  const rarities = { common: 0, rare: 0, epic: 0, legendary: 0 };

  playerTeam.forEach((p) => {
    const st = computePetStats(p, weaponsDb);
    rarities[st.rarity] = (rarities[st.rarity] || 0) + 1;
  });

  const baseLevel = Math.max(
    1,
    Math.round(playerTeam.reduce((s, p) => s + (p.level || 1), 0) / Math.max(1, playerTeam.length))
  );

  const enemy = [];
  for (let i = 0; i < 3; i++) {
    const rarity = pickWeighted({
      common: 60 + (rarities.common || 0) * 10,
      rare: 25 + (rarities.rare || 0) * 15,
      epic: 12 + (rarities.epic || 0) * 18,
      legendary: 3 + (rarities.legendary || 0) * 22,
    });
    const lvl = clamp(baseLevel + (Math.floor(Math.random() * 5) - 2), 1, 999);
    const choices = pool[rarity] || pool.common || [];
    const choice = choices[Math.floor(Math.random() * choices.length)] || { name: 'Vahşi' };
    enemy.push({
      id: `enemy_${Date.now()}_${i}`,
      level: lvl,
      name: choice.name || 'Vahşi',
      xp: 0,
      items: { rarity },
    });
  }
  return enemy;
}

function simulateBattle(myTeam, enemyTeam, weaponsDb, opts) {
  const maxTurns = (opts && opts.maxTurns) || 24;
  const log = [];

  function initSide(team, side) {
    return team.map((p) => {
      const st = computePetStats(p, weaponsDb);
      const w = getPetWeapon(p, weaponsDb);
      const gear =
        w && w.parts
          ? `${(w.parts.attack && w.parts.attack.emoji) || '🗡️'}${
              (w.parts.armor && w.parts.armor.emoji) || '🛡️'
            }${(w.parts.magic && w.parts.magic.emoji) || '✨'}`
          : '';
      return {
        id: p.id,
        name: p.name || 'Vahşi',
        level: p.level || 1,
        side,
        rarity: st.rarity,
        gear,
        maxHp: st.maxHp,
        hp: st.maxHp,
        atk: st.atk,
        def: st.def,
        mag: st.mag,
      };
    });
  }

  const A = initSide(myTeam, 'player');
  const B = initSide(enemyTeam, 'enemy');

  function alive(list) {
    return list.filter((p) => p.hp > 0);
  }

  function pickActor(list) {
    const al = alive(list);
    if (al.length === 0) return null;
    return al[Math.floor(Math.random() * al.length)];
  }

  function pickTarget(list) {
    const al = alive(list);
    if (al.length === 0) return null;
    const sorted = al.slice().sort((x, y) => x.hp - y.hp);
    const pickLow = Math.random() < 0.6;
    if (pickLow) return sorted[0];
    return al[Math.floor(Math.random() * al.length)];
  }

  function doHit(attacker, target) {
    if (!attacker || !target) return;
    const useMagic =
      attacker.mag > attacker.atk ? Math.random() < 0.45 : Math.random() < 0.25;
    const dodgeChance = clamp(0.05 + target.mag / 350, 0.05, 0.2);
    if (Math.random() < dodgeChance) {
      log.push(`💨 ${attacker.name} saldırdı ama ${target.name} kaçtı!`);
      return;
    }

    const critChance = clamp(0.08 + attacker.mag / 450, 0.08, 0.22);
    const crit = Math.random() < critChance;
    const base = useMagic ? attacker.mag : attacker.atk;
    const mitig = target.def * (useMagic ? 0.32 : 0.6);
    let dmg = Math.max(1, Math.round(base - mitig + Math.random() * 4));
    if (crit) dmg = Math.round(dmg * 1.6);
    target.hp = Math.max(0, target.hp - dmg);

    const typeEmoji = useMagic ? '✨' : '⚔️';
    const critEmoji = crit ? '💥' : '';
    log.push(`${typeEmoji}${critEmoji} ${attacker.name} → ${target.name} (-${dmg})`);
    if (target.hp <= 0) log.push(`☠️ ${target.name} düştü!`);
  }

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (alive(A).length === 0 || alive(B).length === 0) break;
    const a1 = pickActor(A);
    const b1 = pickActor(B);
    const aSpeed = (a1 ? a1.level : 1) + Math.random() * 6 + (a1 ? a1.mag : 0) / 25;
    const bSpeed = (b1 ? b1.level : 1) + Math.random() * 6 + (b1 ? b1.mag : 0) / 25;

    if (aSpeed >= bSpeed) {
      doHit(a1, pickTarget(B));
      if (alive(B).length === 0) break;
      doHit(b1, pickTarget(A));
    } else {
      doHit(b1, pickTarget(A));
      if (alive(A).length === 0) break;
      doHit(a1, pickTarget(B));
    }
  }

  const aAlive = alive(A).length;
  const bAlive = alive(B).length;
  let winner = 'draw';
  if (aAlive > 0 && bAlive === 0) winner = 'player';
  else if (bAlive > 0 && aAlive === 0) winner = 'enemy';

  return { winner, log, my: A, enemy: B };
}

function maybeCreateBoxForPlayer(userId, player, now) {
  const pool = readWeaponsPool() || {};
  const weaponsDB = readWeaponsDb() || {};
  const counts = { legendary: 0, epic: 0, rare: 0, common: 0 };

  const teamRefs = player.team || [];
  teamRefs.forEach((pRef) => {
    const p = resolvePet(player, pRef);
    if (p && p.items && p.items.rarity)
      counts[p.items.rarity] = (counts[p.items.rarity] || 0) + 1;
  });

  let majority = 'common';
  let max = -1;
  for (const r of Object.keys(counts)) {
    if (counts[r] > max) {
      max = counts[r];
      majority = r;
    }
  }
  if (max <= 0) majority = 'common';
  const chosenRarity = majority;

  const parts = pool.parts || {};

  function pickFrom(list, fallback) {
    if (!Array.isArray(list) || list.length === 0) return fallback;
    return list[Math.floor(Math.random() * list.length)] || fallback;
  }

  const legacyPool = pool.WEAPON_OF_ATTACK ? pool : null;
  const attackList = legacyPool
    ? legacyPool.WEAPON_OF_ATTACK?.[chosenRarity] || legacyPool.WEAPON_OF_ATTACK?.common
    : parts.attack?.[chosenRarity] || parts.attack?.common;
  const armorList = legacyPool
    ? legacyPool.WEAPON_OF_ARMOR?.[chosenRarity] || legacyPool.WEAPON_OF_ARMOR?.common
    : parts.armor?.[chosenRarity] || parts.armor?.common;
  const magicList = legacyPool
    ? legacyPool.WEAPON_OF_MAGIC?.[chosenRarity] || legacyPool.WEAPON_OF_MAGIC?.common
    : parts.magic?.[chosenRarity] || parts.magic?.common;

  const attack = pickFrom(attackList, { emoji: '🗡️', desc: 'Keskin darbe', stats: { atk: 1 } });
  const armor = pickFrom(armorList, { emoji: '🛡️', desc: 'Basit kalkan', stats: { def: 1 } });
  const magic = pickFrom(magicList, { emoji: '✨', desc: 'Parıltı', stats: { mag: 1 } });

  function genId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < 6; i++)
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }
  let id;
  do {
    id = genId();
  } while (weaponsDB[id]);

  weaponsDB[id] = {
    id,
    rarity: chosenRarity,
    parts: { attack, armor, magic },
    createdAt: now,
    owner: userId,
    v: 2,
  };
  writeWeaponsDb(weaponsDB);

  function statsLine(p) {
    const s = p && p.stats ? p.stats : {};
    const a = s.atk ? `+${s.atk} atk` : '';
    const d = s.def ? `+${s.def} def` : '';
    const m = s.mag ? `+${s.mag} mag` : '';
    return [a, d, m].filter(Boolean).join(' ');
  }

  const short = `Kutu açıldı: (${chosenRarity[0].toUpperCase()}) ${attack.emoji || '🗡️'}${armor.emoji || '🛡️'}${magic.emoji || '✨'} — ID: ${id}\n${attack.emoji || '🗡️'} ${attack.desc || '—'} ${statsLine(attack)}\n${armor.emoji || '🛡️'} ${armor.desc || '—'} ${statsLine(armor)}\n${magic.emoji || '✨'} ${magic.desc || '—'} ${statsLine(magic)}`;
  return { created: true, message: short };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function showBoxOpening(channel, boxMessage) {
  const openingEmbed = new MessageEmbed()
    .setTitle(`${emojis.bot.succes} | Kutu Açılıyor...`)
    .setDescription('Biraz sabret, gizemli enerjiler toplanıyor ✨')
    .setColor('GREEN');
  const sent = await channel.send({ embeds: [openingEmbed] });
  const frames = ['[■□□□□]', '[■■□□□]', '[■■■□□]', '[■■■■□]', '[■■■■■]'];
  for (let i = 0; i < frames.length; i++) {
    const e = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Kutu Açılıyor...`)
      .setDescription(`${frames[i]}\nEnerji birikiyor...`)
      .setColor('GREEN');
    await sleep(700);
    try {
      await sent.edit({ embeds: [e] });
    } catch (e) {}
  }
  const finalEmbed = new MessageEmbed()
    .setTitle(`${emojis.bot.succes} | Kutu Açıldı!`)
    .setDescription(boxMessage)
    .setColor('GOLD');
  try {
    await sent.edit({ embeds: [finalEmbed] });
  } catch (e) {
    await channel.send({ embeds: [finalEmbed] });
  }
}

module.exports.help = {
  name: 'battle',
  aliases: ['savaş'],
  usage: 'battle',
  description: 'Takımdaki hayvanlarla savaşmaya başla (veya birini etiketle).',
  category: 'Battle',
  cooldown: 10,
};

module.exports.execute = async (client, message, args) => {
  try {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    const mention = message.mentions.users.first();

    if (sub === 'stats' || sub === 'istatistik' || sub === 'history') {
      const statsDb = readBattleStats();
      const s = statsDb[userId] || {};
      const embed = new MessageEmbed()
        .setTitle(`${emojis.bot.succes} | Battle İstatistik`)
        .setColor('GREEN')
        .addField('Toplam', `Win: ${s.wins || 0}\nLose: ${s.losses || 0}`, true)
        .addField(
          'PvE',
          `Win: ${s.pveWins || 0}\nLose: ${s.pveLosses || 0}`,
          true
        )
        .addField(
          'PvP',
          `Win: ${s.pvpWins || 0}\nLose: ${s.pvpLosses || 0}`,
          true
        );
      if (s.lastBattleAt) embed.setFooter({ text: `Son savaş: ${new Date(s.lastBattleAt).toLocaleString()}` });
      return message.channel.send({ embeds: [embed] });
    }

    const weaponsDb = readWeaponsDb();
    const rawPlayer = getPlayer(userId);
    const player = normalizePlayerData(rawPlayer);

    if (!rawPlayer || !player.team || player.team.filter(Boolean).length === 0) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Takım Bulunamadı`)
        .setDescription(
          'Takımın yok! Önce `team add` ile takımı kur. ｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡'
        )
        .setColor('RED');
      return message.channel.send({ embeds: [e] });
    }

    const now = Date.now();
    const cdMs = 8000;
    if (player.lastBattleAt && now - player.lastBattleAt < cdMs) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Çok Hızlı`)
        .setDescription('Biraz nefeslen~ Birkaç saniye sonra tekrar dene.')
        .setColor('ORANGE');
      return message.channel.send({ embeds: [e] });
    }
    player.lastBattleAt = now;

    const resolvedMyTeam = player.team
      .slice(0, 3)
      .map((pRef) => resolvePet(player, pRef))
      .filter(Boolean)
      .map((p) => {
        p.items = p.items || {};
        return p;
      });

    if (resolvedMyTeam.length === 0) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Takım Boş`)
        .setDescription('Takım slotlarında geçerli bir hayvan bulunamadı.')
        .setColor('RED');
      return message.channel.send({ embeds: [e] });
    }

    function teamLines(teamState) {
      const remap = { common: '⬜', rare: '🟦', epic: '🟪', legendary: '🟨' };
      return (teamState || [])
        .map((p, i) => {
          const r = remap[p.rarity] || '⬜';
          const hp = `${p.hp}/${p.maxHp}`;
          const gear = p.gear ? ` ${p.gear}` : '';
          return `${i + 1}. ${r}${gear} ${p.name} (Lv ${p.level}) ❤️ ${hp}`;
        })
        .join('\n');
    }

    function buildEmbed(title, sim, resultText, footer) {
      const log = (sim.log || []).slice(-12);
      const embed = new MessageEmbed()
        .setTitle(title)
        .setColor('#2f3136')
        .addField('Senin takımın', teamLines(sim.my) || '—', false)
        .addField('Rakip', teamLines(sim.enemy) || '—', false)
        .addField('Savaş günlüğü', log.length ? log.join('\n') : '—', false)
        .addField('Sonuç', resultText || '—', false)
        .setTimestamp();
      if (footer) embed.setFooter(footer);
      return embed;
    }

    function recordBattle(kind, won) {
      const statsDb = readBattleStats();
      const s = statsDb[userId] || {};
      s.wins = s.wins || 0;
      s.losses = s.losses || 0;
      s.pveWins = s.pveWins || 0;
      s.pveLosses = s.pveLosses || 0;
      s.pvpWins = s.pvpWins || 0;
      s.pvpLosses = s.pvpLosses || 0;

      if (won) s.wins += 1;
      else s.losses += 1;
      if (kind === 'pvp') {
        if (won) s.pvpWins += 1;
        else s.pvpLosses += 1;
      } else {
        if (won) s.pveWins += 1;
        else s.pveLosses += 1;
      }
      s.lastBattleAt = now;
      statsDb[userId] = s;
      writeBattleStats(statsDb);
    }

    if (mention && mention.id !== userId) {
      const rawTarget = getPlayer(mention.id);
      const targetPlayer = normalizePlayerData(rawTarget);
      if (!rawTarget || !targetPlayer.team || targetPlayer.team.filter(Boolean).length === 0) {
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | Hedefin Takımı Yok`)
          .setDescription(
            'Etiketlediğin kişinin takımı yok. Maceralar beklesin... ｡•́︿•̀｡'
          )
          .setColor('RED');
        return message.channel.send({ embeds: [e] });
      }

      const targetResolved = targetPlayer.team
        .slice(0, 3)
        .map((pRef) => resolvePet(targetPlayer, pRef))
        .filter(Boolean)
        .map((p) => {
          p.items = p.items || {};
          return p;
        });

      if (targetResolved.length === 0) {
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | Hedef Takımı Boş`)
          .setDescription('Hedef takım slotlarında geçerli bir hayvan bulunamadı.')
          .setColor('RED');
        return message.channel.send({ embeds: [e] });
      }

      const res = await sendChallenge(message, message.author, mention, 300000);
      if (!res.accepted) {
        if (res.timeout) return;
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | Reddedildi`)
          .setDescription(
            'Karşı taraf savaşı reddetti. Belki başka sefer? (╥﹏╥)'
          )
          .setColor('DARK_RED');
        return message.channel.send({ embeds: [e] });
      }

      const sim = simulateBattle(resolvedMyTeam, targetResolved, weaponsDb, {
        maxTurns: 28,
      });

      const iWon = sim.winner === 'player';
      const isDraw = sim.winner === 'draw';
      player.streak = iWon ? (player.streak || 0) + 1 : 0;

      const enemyScore = (sim.enemy || []).reduce(
        (s, p) => s + p.atk + p.def + p.mag + Math.round(p.maxHp / 8),
        0
      );
      const baseXp = 20 + Math.round(enemyScore / 10);
      const xpGain = isDraw ? 10 : iWon ? baseXp + Math.min(60, player.streak * 10) : 10;
      const levelUpMessages = [];

      for (const pet of resolvedMyTeam) {
        if (!pet) continue;
        pet.xp = (pet.xp || 0) + xpGain;
        const resLevel = applyXpAndLevel(pet, { maxLevel: 999 });
        if (resLevel.levelsGained > 0)
          levelUpMessages.push(
            `${pet.name} ${resLevel.levelsGained} seviye kazandı! Yeni seviye: ${pet.level}`
          );
        savePetToPlayer(player, pet);
      }

      savePlayer(userId, player);
      if (!isDraw) recordBattle('pvp', iWon);

      const resultText = isDraw
        ? `Berabere! Her hayvanın ${xpGain} XP kazandı.`
        : iWon
        ? `Zafer! Streak: ${player.streak} • Her hayvanın ${xpGain} XP kazandı.`
        : `Kaybettin. Her hayvanın ${xpGain} XP kazandı.`;

      const embed = buildEmbed(
        `${message.member.displayName || message.author.username} vs ${mention.username}`,
        sim,
        resultText,
        { text: 'PvP savaşı — kutu kazanma yok.' }
      );
      await message.channel.send({ embeds: [embed] });

      if (levelUpMessages.length) await message.channel.send(levelUpMessages.join('\n'));
      return;
    }

    const enemyTeam = buildEnemyTeamFromPlayer(resolvedMyTeam, weaponsDb);
    const sim = simulateBattle(resolvedMyTeam, enemyTeam, weaponsDb, { maxTurns: 26 });
    const iWon = sim.winner === 'player';
    const isDraw = sim.winner === 'draw';

    player.streak = iWon ? (player.streak || 0) + 1 : 0;
    const enemyScore = (sim.enemy || []).reduce(
      (s, p) => s + p.atk + p.def + p.mag + Math.round(p.maxHp / 8),
      0
    );
    const baseXp = 20 + Math.round(enemyScore / 10);
    const xpGain = isDraw ? 10 : iWon ? baseXp + Math.min(60, player.streak * 10) : 10;
    const levelUpMessages = [];

    for (const petObj of resolvedMyTeam) {
      if (!petObj) continue;
      petObj.xp = (petObj.xp || 0) + xpGain;
      const res = applyXpAndLevel(petObj, { maxLevel: 999 });
      if (res.levelsGained > 0)
        levelUpMessages.push(
          `${petObj.name} ${res.levelsGained} seviye kazandı! Yeni seviye: ${petObj.level}`
        );
      savePetToPlayer(player, petObj);
    }

    player.winTimestamps = (player.winTimestamps || []).filter(
      (ts) => now - ts < 24 * 3600 * 1000
    );
    if (iWon) player.winTimestamps.push(now);
    savePlayer(userId, player);
    if (!isDraw) recordBattle('pve', iWon);

    const resultText = isDraw
      ? `Berabere! Her hayvanın ${xpGain} XP kazandı.`
      : iWon
      ? `Zafer! Streak: ${player.streak} • Her hayvanın ${xpGain} XP kazandı.`
      : `Yenildin. Her hayvanın ${xpGain} XP kazandı.`;

    const embed = buildEmbed(
      `${message.member.displayName || message.author.username} vs Vahşi Takım`,
      sim,
      resultText,
      { text: 'PvE savaşı — kutu düşebilir.' }
    );
    await message.channel.send({ embeds: [embed] });

    if (iWon) {
      const winsIn24h = player.winTimestamps.length;
      const chance = clamp(0.8 - Math.max(0, winsIn24h - 1) * 0.15, 0.2, 0.8);
      if (Math.random() < chance) {
        const box = maybeCreateBoxForPlayer(userId, player, now);
        if (box && box.created) {
          await showBoxOpening(message.channel, box.message);
        }
      }

      if (levelUpMessages.length) await message.channel.send(levelUpMessages.join('\n'));
    } else {
      if (levelUpMessages.length) await message.channel.send(levelUpMessages.join('\n'));
    }
  } catch (err) {
    const errEmbed = new MessageEmbed()
      .setTitle(`${emojis.bot.error} | Uwaa~ Bir hata oldu!`)
      .setDescription(
        `Hata: ${
          err.message || String(err)
        }\nLütfen daha sonra tekrar dene. (；へ：)`
      )
      .setColor('DARK_RED');
    return message.channel.send({ embeds: [errEmbed] });
  }
};
