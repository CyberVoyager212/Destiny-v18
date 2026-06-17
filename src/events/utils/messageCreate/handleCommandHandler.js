const { MessageEmbed } = require('discord.js');
const emojis = require('../../../emoji.json');
const botConfig = require('../../../botConfig.js');
const { levenshtein, chooseEmoji } = require('./helpers');

module.exports = async (client, message, prefix) => {
  const db = client.db;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const channelId = message.channel.id;
  const content = (message.content || '').trim();
  const ownerId = client.config && client.config.ownerId;
  const admins = (client.config && client.config.admins) || [];

  if (!content.startsWith(prefix)) return;

  const parts = content.slice(prefix.length).trim().split(/\s+/);
  const cmdName = parts.shift().toLowerCase();

  const candidates = [];
  client.commands.forEach((cmd, origName) => {
    candidates.push({
      entryName: origName,
      trigger: origName.toLowerCase(),
      cmd,
    });
    const aliases = cmd.help?.aliases || [];
    for (const a of aliases) {
      candidates.push({ entryName: origName, trigger: a.toLowerCase(), cmd });
    }
  });

  function userCanUse(cmd) {
    const help = cmd.help || {};
    const callerId = typeof userId !== 'undefined' ? userId : message.author.id;
    const botAdmins = Array.isArray(admins)
      ? admins
      : Array.isArray(botConfig?.admins)
        ? botConfig.admins
        : [];
    if (typeof ownerId !== 'undefined' && callerId === ownerId) return true;
    if (Array.isArray(botAdmins) && botAdmins.includes(callerId)) return true;
    if (help.permissions) {
      const perms = Array.isArray(help.permissions)
        ? help.permissions
        : [help.permissions];
      if (!message.guild || !message.member) return false;
      try {
        return message.member.permissions.has(perms);
      } catch {
        return false;
      }
    }
    if (help.admin) {
      return Array.isArray(botAdmins) && botAdmins.includes(callerId);
    }
    return true;
  }

  let command = null;
  let commandName = null;
  for (const c of candidates) {
    if (c.trigger === cmdName) {
      if (!userCanUse(c.cmd)) {
        command = null;
        commandName = null;
      } else {
        command = c.cmd;
        commandName = c.entryName;
      }
      break;
    }
  }

  if (!command) {
    const allNames = Array.from(
      new Set(
        candidates
          .filter((c) => userCanUse(c.cmd))
          .map((c) => c.entryName.toLowerCase()),
      ),
    );
    const sug = allNames
      .map((n) => ({ n, d: levenshtein(cmdName, n) }))
      .filter((x) => x.d <= 3)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => `\`${prefix}${x.n}\``);

    const embed = new MessageEmbed()
      .setTitle(`${emojis.bot.error} | Komut Bulunamadı`)
      .setColor('#FF5555')
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({
        text: `${
          global.botName || botConfig?.botname || 'Bot'
        } | Komut Öneri Sistemi`,
      })
      .setDescription(
        sug.length
          ? `\`${cmdName}\` bulunamadı. Belki şunları denediniz:\n${sug.join(
              '\n',
            )}`
          : `\`${cmdName}\` bulunamadı. \`${prefix}help\` ile listeye bakabilirsiniz.`,
      );

    const warnMsg = await message.channel
      .send({ embeds: [embed] })
      .catch(() => null);

    setTimeout(() => {
      try {
        if (warnMsg && warnMsg.delete) warnMsg.delete().catch(() => {});
      } catch {}
      try {
        if (message && message.delete) message.delete().catch(() => {});
      } catch {}
    }, 6000);
    return;
  }

  const isCommandDisabled = await db.get(`kapaliKomut_${cmdName}`);
  if (isCommandDisabled) {
    await message.channel.send(
      `${emojis.bot.error} | Üzgünüm, **${prefix}${cmdName}** komutu bot yöneticileri tarafından geçici olarak **kullanıma kapatılmıştır**.`,
    );
    return;
  }

  {
    const baseCmd = (
      command && command.help && command.help.name
        ? String(command.help.name)
        : String(cmdName)
    ).toLowerCase();
    const isPrivileged = admins.includes(userId) || userId === ownerId;
    if (!(baseCmd === 'kk' && isPrivileged)) {
      const cmdCategory =
        command && command.help && command.help.category
          ? String(command.help.category).toLowerCase()
          : '';

      const channelRuleKey = `kkRule_channel_${guildId}_${channelId}`;
      const guildRuleKey = `kkRule_guild_${guildId}`;
      const channelBehaviorKey = `kkBehavior_channel_${guildId}_${channelId}`;
      const guildBehaviorKey = `kkBehavior_guild_${guildId}`;

      let channelRule = await db.get(channelRuleKey);
      if (!channelRule) {
        channelRule = await db.get(`kkRule_${guildId}_${channelId}`);
      }
      const guildRule = await db.get(guildRuleKey);

      function ruleBlocks(rule) {
        if (!rule || typeof rule !== 'object') return false;
        const mode = String(rule.mode || '').toLowerCase();
        const list = Array.isArray(rule.commands)
          ? rule.commands.map((x) => String(x).toLowerCase())
          : [];
        const cats = Array.isArray(rule.categories)
          ? rule.categories.map((x) => String(x).toLowerCase())
          : [];

        if (mode === 'all') return true;
        if (mode === 'allow') return !list.includes(baseCmd);
        if (mode === 'block')
          return (
            list.includes(baseCmd) ||
            (!!cmdCategory && cats.includes(cmdCategory))
          );
        return false;
      }

      const hasChannelRule =
        channelRule &&
        typeof channelRule === 'object' &&
        (String(channelRule.mode || '').trim() ||
          (Array.isArray(channelRule.commands) &&
            channelRule.commands.length) ||
          (Array.isArray(channelRule.categories) &&
            channelRule.categories.length));
      const hasGuildRule =
        guildRule &&
        typeof guildRule === 'object' &&
        (String(guildRule.mode || '').trim() ||
          (Array.isArray(guildRule.commands) && guildRule.commands.length) ||
          (Array.isArray(guildRule.categories) && guildRule.categories.length));

      let blockedBy = null;
      let blockedRule = null;

      if (hasChannelRule) {
        if (ruleBlocks(channelRule)) {
          blockedBy = 'channel';
          blockedRule = channelRule;
        } else {
          blockedBy = null;
          blockedRule = null;
        }
      } else if (hasGuildRule && ruleBlocks(guildRule)) {
        blockedBy = 'guild';
        blockedRule = guildRule;
      }

      if (blockedBy) {
        const channelBehavior = await db.get(channelBehaviorKey);
        const guildBehavior = await db.get(guildBehaviorKey);
        const behavior =
          blockedBy === 'channel' && channelBehavior
            ? String(channelBehavior)
            : guildBehavior
              ? String(guildBehavior)
              : 'uyar';

        async function doWarn(text) {
          return message.reply(text).catch(() => null);
        }

        if (behavior === 'sil') {
          if (message.deletable) await message.delete().catch(() => {});
          return;
        }

        if (behavior === 'uyar_sonra_sil') {
          const warnMsg = await doWarn(
            `${emojis.bot.error} | Bu komut bu kanalda kapalı.`,
          );
          setTimeout(() => {
            warnMsg && warnMsg.delete && warnMsg.delete().catch(() => {});
            message.delete && message.delete().catch(() => {});
          }, 3000);
          return;
        }

        const mode = blockedRule
          ? String(blockedRule.mode || '').toLowerCase()
          : '';
        const list =
          blockedRule && Array.isArray(blockedRule.commands)
            ? blockedRule.commands.map((x) => String(x).toLowerCase())
            : [];
        if (mode === 'allow' && list.length) {
          const warnMsg = await doWarn(
            `${emojis.bot.error} | Bu kanalda sadece şu komutlar açık: ${list
              .map((x) => `\`${prefix}${x}\``)
              .join(', ')}`,
          );
          setTimeout(() => {
            if (warnMsg && typeof warnMsg.delete === 'function')
              warnMsg.delete().catch(() => {});
            if (message && typeof message.delete === 'function')
              message.delete().catch(() => {});
          }, 4000);
          return;
        }
        await doWarn(`${emojis.bot.error} | Bu komut bu kanalda kapalı.`);
        return;
      }
    }
  }

  {
    if (!admins.includes(userId)) {
      const cdSec = command.cooldown || command.help?.cooldown || 5;
      const cdKey = `${commandName}Cooldown_${userId}`;
      const last = await db.get(cdKey);
      if (last && Date.now() - last < cdSec * 1000) {
        const remMs = cdSec * 1000 - (Date.now() - last);
        const timestamp = Math.floor((Date.now() + remMs) / 1000);
        if (!global.cooldownWarningLocks) {
          global.cooldownWarningLocks = new Map();
        }

        if (!global.cooldownWarningLocks.has(cdKey)) {
          global.cooldownWarningLocks.set(cdKey, true);
          const remMsg = await message
            .reply(
              `${emojis.bot.error} | Lütfen <t:${timestamp}:R> sonra tekrar dene, sempai~`,
            )
            .catch(() => {});

          setTimeout(() => {
            if (remMsg && remMsg.delete) remMsg.delete().catch(() => {});
            if (message && message.delete) message.delete().catch(() => {});
            global.cooldownWarningLocks.delete(cdKey);
          }, 5000);
        }
        return;
      }
      await db.set(cdKey, Date.now());
    }
  }

  if (!admins.includes(userId) && userId !== ownerId) {
    const botbans = (await db.get('botbans')) || [];
    if (botbans.includes(userId)) {
      await message
        .reply(
          `${emojis.bot.error} | Botdan banlı olduğunuz için hiçbir komutu kullanamazsınız.`,
        )
        .catch(() => {});
      return;
    }
  }

  if (!admins.includes(userId) && userId !== ownerId) {
    const userLoan = await db.get(`loan_${userId}`);
    if (userLoan && userLoan.amount > 0 && userLoan.time) {
      const loanTime = new Date(userLoan.time).getTime();
      const now = Date.now();
      const fiveDays = 5 * 24 * 60 * 60 * 1000;
      if (now - loanTime > fiveDays && commandName !== 'ödeme') {
        await message
          .reply(
            `${emojis.bot.error} | 5 günü aşan **borcunuz (${
              userLoan.amount
            }) ${chooseEmoji(
              userLoan.amount,
            )}** olduğu için komutları kullanamazsınız.\nLütfen \`${prefix}ödeme <miktar>\` komutu ile borcunuzu ödeyiniz.`,
          )
          .catch(() => {});
        return;
      }
    }
  }

  try {
    await command.execute(client, message, parts);
    try {
      await client.db
        .delete(`${message.author.id}_lastCommand`)
        .catch(() => {});
    } catch {}
  } catch (err) {
    console.error(err);
    try {
      await message
        .reply(
          `${
            emojis.bot.error
          } | ✨ Aaa! Komut çalıştırılırken bir hata patladı — detay: ${
            err.message || 'Bilinmeyen'
          }\nBen de bu hatayı kaydettim, endişelenme, sempai ✨`,
        )
        .catch(() => {});
    } catch {}
  }
};
