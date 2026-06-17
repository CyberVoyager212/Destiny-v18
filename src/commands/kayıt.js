const { Permissions } = require('discord.js');
const emojis = require('../emoji.json');

exports.execute = async (client, message, rawArgs) => {
  try {
    const parts = rawArgs
      .join(' ')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length);

    if (parts.length < 4) {
      return message.reply(
        `${emojis.bot.error} | Eksik parametre girmişsin **${message.member.displayName}**!\n` +
          `Beni biraz üzüyorsun qwq Doğru kullanım:\n\n` +
          `\`kayıt @user/ID, isim, yaş, @üyeRol\` **(normal)**\n` +
          `\`kayıt @user/ID, isim, yaş, erkek/kadın, @üyeRol\` **(cinsiyetli)**`,
      );
    }

    const userPart = parts[0];
    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(userPart) ||
      message.guild.members.cache.find((m) => m.user.tag === userPart);

    if (!member) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, verdiğin kullanıcıyı bulamadım... belki yanlış yazmışsındır >_<`,
      );
    }

    const name = parts[1];
    const age = parseInt(parts[2], 10);
    if (!name || isNaN(age)) {
      return message.reply(
        `${emojis.bot.error} | Hmmm... **${message.member.displayName}**, isim ya da yaş kısmını yanlış yazdın gibi... lütfen düzgün yaz olur mu? :3`,
      );
    }

    const guildId = message.guild.id;
    const unregRoleId = await client.db.get(`kayitsizRol_${guildId}`);
    const maleRoleId = await client.db.get(`maleRol_${guildId}`);
    const femaleRoleId = await client.db.get(`femaleRol_${guildId}`);

    const unregRole = message.guild.roles.cache.get(unregRoleId);
    const maleRole = message.guild.roles.cache.get(maleRoleId);
    const femaleRole = message.guild.roles.cache.get(femaleRoleId);

    const genderMode = Boolean(maleRole && femaleRole);

    const rolePartIndex = genderMode ? 4 : 3;
    const roleInput = parts[rolePartIndex];
    const roleIdMatch = roleInput.match(/^<@&(\d+)>$/);
    let memberRole = null;

    if (roleIdMatch) {
      memberRole = message.guild.roles.cache.get(roleIdMatch[1]);
    } else {
      memberRole =
        message.guild.roles.cache.get(roleInput) ||
        message.guild.roles.cache.find(
          (r) => r.name.toLowerCase() === roleInput.toLowerCase(),
        );
    }

    let genderArg = null;
    if (genderMode) {
      genderArg = parts[3].toLowerCase();
      if (!['erkek', 'male', 'kadın', 'female'].includes(genderArg)) {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, cinsiyet seçimi yanlış... sadece \`erkek/male\` veya \`kadın/female\` yazabilirsin~`,
        );
      }
    }

    const newNick = `${name} ${age}`;
    await member.setNickname(newNick).catch(() => {});

    if (unregRole && member.roles.cache.has(unregRole.id)) {
      await member.roles.remove(unregRole).catch(() => {});
    }

    const assigned = [];
    if (genderMode) {
      let roleToAdd = null;
      if (['erkek', 'male'].includes(genderArg)) roleToAdd = maleRole;
      else roleToAdd = femaleRole;
      await member.roles.add(roleToAdd);
      assigned.push(roleToAdd.name);
    }

    await member.roles.add(memberRole);
    assigned.push(memberRole.name);

    return message.channel.send(
      `${emojis.bot.succes} | **Kayıt Başarılı!**\n` +
        `👤 Kullanıcı: ${member}\n` +
        `📛 Yeni Ad: \`${newNick}\`\n` +
        `🎭 Verilen Roller: \`${assigned.join('`, `')}\`\n\n` +
        `**${message.member.displayName}**, işini harika yaptın! Gurur duyuyorum seninle ^-^`,
    );
  } catch (err) {
    console.error('Kayıt komutu hatası:', err);
    return message.reply(
      `${emojis.bot.error} | Ayyaa~ bir şeyler ters gitti **${message.member.displayName}**... lütfen tekrar dene olur mu? :c`,
    );
  }
};

exports.help = {
  name: 'kayıt',
  aliases: ['k'],
  usage:
    'kayıt @user/ID, isim, yaş, @üyeRol\n' +
    'kayıt @user/ID, isim, yaş, erkek/erkekRol, @üyeRol (cinsiyetli)',
  description:
    'Kayıtsız kullanıcıyı kayıt eder, cinsiyete göre rol verir ve isim|yaş ayarlar.',
  category: 'Moderasyon',
  cooldown: 5,
  permissions: ['MANAGE_ROLES'],
};
