const { MessageEmbed } = require('discord.js');
const {
  readPlayers,
  writePlayers,
  readWeaponsDb,
  writeWeaponsDb,
} = require('../utils/battleData');
const emojis = require('../emoji.json');

module.exports.help = {
  name: 'team',
  aliases: ['takım'],
  usage: 'team add/remove/list | team weapon <slot> <weaponId|remove>',
  description:
    'Takım yönetimi: add/remove/list ve team weapon <slot> <weaponId|remove>',
  category: 'Battle',
  cooldown: 10,
};

module.exports.execute = async (client, message, args) => {
  const userId = message.author.id;
  const sub = (args[0] || '').toLowerCase();

  const players = readPlayers();
  const weaponsDB = readWeaponsDb();

  const defaultMe = {
    team: [null, null, null], 
    pool: {},  
    inventory: { diamonds: [], emeralds: [], hearts: [] },
  };

  const meRaw = players[userId] || {};
  const me = Object.assign({}, defaultMe, meRaw);

  try {
    if (Array.isArray(me.team)) {
      for (let i = 0; i < me.team.length; i++) {
        const slotVal = me.team[i];
        if (slotVal && typeof slotVal === 'object' && slotVal.id) {
          const pet = slotVal;
          me.pool[pet.id] = me.pool[pet.id] || pet;
          me.team[i] = pet.id;
        }
      }
    } else {
      me.team = [null, null, null];
    }

    if (Array.isArray(me.pool)) {
      const newPool = {};
      me.pool.forEach((p) => {
        if (p && p.id) newPool[p.id] = p;
      });
      me.pool = newPool;
    }
  } catch (err) {
    console.error('Normalization error:', err);
  }

  function findPetInPool(identifier) {
    if (!identifier) return null;
    if (me.pool[identifier]) return me.pool[identifier];
    const byName = Object.values(me.pool).find(
      (p) => p && p.name && p.name.toLowerCase() === identifier.toLowerCase()
    );
    return byName || null;
  }

  function normalizeWeaponParts(weapon) {
    if (!weapon) return { attack: null, armor: null, magic: null };
    const parts = weapon.parts || {};
    const a = parts.attack;
    const r = parts.armor;
    const m = parts.magic;
    if (a || r || m) {
      return {
        attack: (a && (a.emoji || a.name)) || null,
        armor: (r && (r.emoji || r.name)) || null,
        magic: (m && (m.emoji || m.name)) || null,
      };
    }
    if (Array.isArray(weapon.items)) {
      return {
        attack: weapon.items[0] || null,
        armor: weapon.items[1] || null,
        magic: weapon.items[2] || null,
      };
    }
    return { attack: null, armor: null, magic: null };
  }

  function clearWeaponFromPet(petObj) {
    if (!petObj || !petObj.items) return;
    delete petObj.items.attack;
    delete petObj.items.armor;
    delete petObj.items.magic;
    delete petObj.items.weaponId;
    delete petObj.items.rarity;
  }

  function unequipWeaponRecord(weaponId, expected) {
    if (!weaponId) return;
    const w = weaponsDB[weaponId];
    if (!w) return;
    if (w.equippedTo && expected) {
      const ok =
        (!expected.userId || w.equippedTo.userId === expected.userId) &&
        (!expected.slot || w.equippedTo.slot === expected.slot) &&
        (!expected.petId || w.equippedTo.petId === expected.petId);
      if (!ok) return;
    }
    delete w.equippedTo;
    weaponsDB[weaponId] = w;
  }

  function unequipWeaponIfEquippedByMe(weaponId) {
    const w = weaponsDB[weaponId];
    if (!w || !w.equippedTo) return;
    if (w.equippedTo.userId !== userId) return;
    const petId = w.equippedTo.petId;
    const direct = me.pool && petId ? me.pool[petId] : null;
    if (direct && direct.items && direct.items.weaponId === weaponId) {
      clearWeaponFromPet(direct);
      me.pool[petId] = direct;
    } else if (me.pool && typeof me.pool === 'object') {
      const found = Object.values(me.pool).find(
        (pp) => pp && pp.items && pp.items.weaponId === weaponId
      );
      if (found && found.id) {
        clearWeaponFromPet(found);
        me.pool[found.id] = found;
      }
    }
    delete w.equippedTo;
    weaponsDB[weaponId] = w;
  }

  function equipWeaponToPet(slot, petObj, weaponId) {
    const weapon = weaponsDB[weaponId];
    if (!weapon) return { ok: false, msg: 'weapon_not_found' };
    if (weapon.owner && weapon.owner !== userId) return { ok: false, msg: 'not_owner' };

    petObj.items = petObj.items || {};
    const oldWeaponId = petObj.items.weaponId;
    if (oldWeaponId && oldWeaponId !== weaponId) {
      unequipWeaponRecord(oldWeaponId, { userId, petId: petObj.id });
    }

    unequipWeaponIfEquippedByMe(weaponId);

    const parts = normalizeWeaponParts(weapon);
    weapon.owner = userId;
    weapon.equippedTo = { userId, slot, petId: petObj.id };

    petObj.items.attack = parts.attack || null;
    petObj.items.armor = parts.armor || null;
    petObj.items.magic = parts.magic || null;
    petObj.items.rarity = weapon.rarity || petObj.items.rarity || 'common';
    petObj.items.weaponId = weaponId;

    weaponsDB[weaponId] = weapon;
    me.pool[petObj.id] = petObj;
    return { ok: true };
  }

  if (sub === 'add') {
    const slot = parseInt(args[1]);
    const petIdentifier = args[2];
    const weaponId = args[3];

    if (!slot || slot < 1 || slot > 3) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hatalı Slot`)
        .setDescription(
          'Slot 1-3 arası olmalı! Lütfen doğru bir slot numarası gir.'
        )
        .setColor('RED');
      return message.channel.send({ embeds: [e] });
    }

    if (!petIdentifier) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Eksik Argüman`)
        .setDescription(
          'Kullanım: `team add <slot 1-3> <petId|petName> [weaponId]`'
        )
        .setColor('ORANGE');
      return message.channel.send({ embeds: [e] });
    }

    const pet = findPetInPool(petIdentifier);

    if (!pet) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hayvan Bulunamadı`)
        .setDescription(
          "Üzgünüm~ Pool'unda aradığın hayvan yok. Önce hayvanı pool'a eklemelisin (ör: `pet add <id> <name>`)." 
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }

    if (weaponId) {
      const weapon = weaponsDB[weaponId];
      if (!weapon) {
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | Silah Yok`)
          .setDescription(
            "Bu ID'ye sahip bir silah bulunamadı. ID'yi kontrol et, sonra tekrar dene. (；へ：)"
          )
          .setColor('DARK_RED');
        return message.channel.send({ embeds: [e] });
      }

      if (weapon.owner && weapon.owner !== userId) {
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | Sahiplik Hatası`)
          .setDescription(
            'Bu eşyaya başka biri sahipmiş gibi görünüyor. Başkalarının eşyalarını alamazsın! (╥﹏╥)'
          )
          .setColor('RED');
        return message.channel.send({ embeds: [e] });
      }

      me.pool[pet.id] = me.pool[pet.id] || pet;
      const resEquip = equipWeaponToPet(slot, me.pool[pet.id], weaponId);
      if (!resEquip.ok) {
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | İşlem Başarısız`)
          .setDescription('Silah takılırken bir hata oluştu.')
          .setColor('DARK_RED');
        return message.channel.send({ embeds: [e] });
      }

      me.team[slot - 1] = pet.id;

      players[userId] = me;
      writeWeaponsDb(weaponsDB);
      writePlayers(players);

      const s = new MessageEmbed()
        .setTitle(`${emojis.bot.succes} | Başarı!`)
        .setDescription(
          `${pet.name} başarıyla slot ${slot}'e eklendi ve weapon ${weaponId} takıldı.`
        )
        .setColor('GREEN');
      return message.channel.send({ embeds: [s] });
    }

    me.team[slot - 1] = pet.id;
    players[userId] = me;
    writePlayers(players);

    const s = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Tamamlandı`)
      .setDescription(`${pet.name} başarıyla slot ${slot}'e eklendi.`)
      .setColor('GREEN');
    return message.channel.send({ embeds: [s] });
  } else if (sub === 'remove' || sub === 'sil') {
    const slot = parseInt(args[1]);
    if (!slot || slot < 1 || slot > 3) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hatalı Slot`)
        .setDescription('Slot 1-3 arası olmalı. Lütfen geçerli bir slot gir.')
        .setColor('RED');
      return message.channel.send({ embeds: [e] });
    }

    const petId = me.team[slot - 1];
    if (petId) {
      const petObj = me.pool[petId];
      if (petObj && petObj.items && petObj.items.weaponId) {
        const wid = petObj.items.weaponId;
        const w = weaponsDB[wid];
        if (
          w &&
          w.equippedTo &&
          w.equippedTo.userId === userId &&
          w.equippedTo.slot === slot &&
          w.equippedTo.petId === petId
        ) {
          delete w.equippedTo;
          weaponsDB[wid] = w;
          writeWeaponsDb(weaponsDB);
        }
      }
    }

    me.team[slot - 1] = null;
    players[userId] = me;
    writePlayers(players);

    const s = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Slot Temizlendi`)
      .setDescription(`Slot ${slot} başarıyla temizlendi.`)
      .setColor('GREEN');
    return message.channel.send({ embeds: [s] });
  } else if (sub === 'weapon') {
    const slot = parseInt(args[1]);
    const opt = args[2];

    if (!slot || slot < 1 || slot > 3) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hatalı Slot`)
        .setDescription(
          'Slot 1-3 arası olmalı. Doğru slotu gir ve tekrar dene.'
        )
        .setColor('RED');
      return message.channel.send({ embeds: [e] });
    }

    const petId = me.team[slot - 1];
    if (!petId) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Slot Boş`)
        .setDescription(
          'Bu slotta bir hayvan yok. Önce hayvanı takıma ekle, sonra silah takmaya çalış.'
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }

    const pet = me.pool[petId];
    if (!pet) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Hata`)
        .setDescription(
          "Slotta görünen pet pool'da mevcut değil. Lütfen admin ile iletişime geç veya veriyi düzelt."
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }

    if (!opt) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Eksik Argüman`)
        .setDescription('Kullanım: `team weapon <slot 1-3> <weaponId|remove>`')
        .setColor('ORANGE');
      return message.channel.send({ embeds: [e] });
    }

    if (opt.toLowerCase() === 'remove' || opt.toLowerCase() === 'unequip') {
      if (pet.items && pet.items.weaponId) {
        const wid = pet.items.weaponId;
        const w = weaponsDB[wid];
        if (
          w &&
          w.equippedTo &&
          w.equippedTo.userId === userId &&
          w.equippedTo.slot === slot &&
          w.equippedTo.petId === petId
        ) {
          delete w.equippedTo;
          weaponsDB[wid] = w;
        }
        delete pet.items.attack;
        delete pet.items.armor;
        delete pet.items.magic;
        delete pet.items.weaponId;
        delete pet.items.rarity;
        me.pool[petId] = pet;

        players[userId] = me;
        writeWeaponsDb(weaponsDB);
        writePlayers(players);

        const s = new MessageEmbed()
          .setTitle(`${emojis.bot.succes} | Silah Çıkarıldı`)
          .setDescription(`Slot ${slot}'teki silah başarıyla çıkarıldı.`)
          .setColor('GREEN');
        return message.channel.send({ embeds: [s] });
      } else {
        const e = new MessageEmbed()
          .setTitle(`${emojis.bot.error} | Silah Yok`)
          .setDescription(
            'Bu slotta takılı bir silah yokmuş gibi görünüyor. (。_。)'
          )
          .setColor('DARK_RED');
        return message.channel.send({ embeds: [e] });
      }
    }

    const weaponId = opt;
    const weapon = weaponsDB[weaponId];
    if (!weapon) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Silah Bulunamadı`)
        .setDescription(
          "Böyle bir weapon ID'si bulunamadı. ID'yi kontrol et lütfen."
        )
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }

    if (weapon.owner && weapon.owner !== userId) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | Sahiplik Hatası`)
        .setDescription(
          'Bu eşyaya başka bir kullanıcı sahip. Başkalarının eşyalarını takamazsın!'
        )
        .setColor('RED');
      return message.channel.send({ embeds: [e] });
    }

    const resEquip = equipWeaponToPet(slot, pet, weaponId);
    if (!resEquip.ok) {
      const e = new MessageEmbed()
        .setTitle(`${emojis.bot.error} | İşlem Başarısız`)
        .setDescription('Silah takılırken bir hata oluştu.')
        .setColor('DARK_RED');
      return message.channel.send({ embeds: [e] });
    }
    players[userId] = me;
    writeWeaponsDb(weaponsDB);
    writePlayers(players);

    const s = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Silah Takıldı`)
      .setDescription(`Slot ${slot}'e weapon ${weaponId} başarıyla takıldı.`)
      .setColor('GREEN');
    return message.channel.send({ embeds: [s] });
  } else {
    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.succes} | Takımın`)
      .setDescription('Aşağıda takımdaki slotların özeti bulunuyor:')
      .setColor('GREEN');

    (me.team || [null, null, null]).forEach((petId, i) => {
      const idx = i + 1;
      if (petId) {
        const p = me.pool[petId];
        if (p) {
          embed.addField(
            `Slot ${idx}`,
            `${p.name} (Lv ${p.level || 1})${
              p.items && p.items.weaponId ? ` — Weapon:${p.items.weaponId}` : ''
            }`
          );
        } else {
          embed.addField(
            `Slot ${idx}`,
            `— (petId:${petId} bulundu ama pool'da yok)`
          );
        }
      } else {
        embed.addField(`Slot ${idx}`, `—`);
      }
    });

    return message.channel.send({ embeds: [embed] });
  }
};
