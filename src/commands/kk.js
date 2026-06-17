const emojis = require('../emoji.json');

module.exports.help = {
  name: 'kk',
  aliases: ['kanalkısıtlama'],
  description:
    'Kanal ve sunucu bazlı komut, yapay zeka ve bot işlemi kısıtlamalarını yönetir.',
  usage: 'kk <kapat|aç|davranış|sıfırla> [kanal|sunucu] <komut|ai|bot|#hepsi#>',
  category: 'Bot',
  cooldown: 5,
  permissions: ['ADMINISTRATOR'],
};

function isAllToken(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  return v === '#hepsi#' || v === 'hepsi' || v === 'all';
}

function isGuildToken(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  return v === '/sunucu' || v === 'sunucu' || v === 'guild' || v === 'server';
}

function isChannelToken(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  return v === 'kanal' || v === 'channel';
}

function isAiToken(raw) {
  return String(raw || '').trim().toLowerCase() === 'ai';
}

function isBotToken(raw) {
  return String(raw || '').trim().toLowerCase() === 'bot';
}

function normalizeToken(raw) {
  return String(raw || '')
    .trim()
    .replace(/^[#]+/g, '')
    .replace(/[,]+$/g, '')
    .toLowerCase();
}

function normalizeCategoryToken(raw) {
  const v = String(raw || '').trim();
  const m = v.match(/^\((.+)\)$/);
  if (!m) return null;
  return String(m[1] || '')
    .trim()
    .toLowerCase();
}

function parseBehavior(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'sil') return 'sil';
  if (v === 'uyar') return 'uyar';
  if (v === 'uyarsonrasil') return 'uyar_sonra_sil';
  return null;
}

function behaviorLabel(b) {
  if (b === 'sil') return 'sil';
  if (b === 'uyar') return 'uyar';
  if (b === 'uyar_sonra_sil') return 'uyar sonra sil';
  return 'uyar';
}

function getRuleKey(guildId, scope, channelId) {
  return scope === 'guild'
    ? `kkRule_guild_${guildId}`
    : `kkRule_channel_${guildId}_${channelId}`;
}

function getBehaviorKey(guildId, scope, channelId) {
  return scope === 'guild'
    ? `kkBehavior_guild_${guildId}`
    : `kkBehavior_channel_${guildId}_${channelId}`;
}

function getAiKey(guildId, scope, channelId) {
  return scope === 'guild'
    ? `aiKapali_guild_${guildId}`
    : `aiKapali_channel_${guildId}_${channelId}`;
}

function getBotKey(guildId, scope, channelId) {
  return scope === 'guild'
    ? `botKapali_guild_${guildId}`
    : `botKapali_channel_${guildId}_${channelId}`;
}

function ruleBlocks(rule, baseCmd, cmdCategory) {
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
  if (mode === 'block') {
    return list.includes(baseCmd) || (!!cmdCategory && cats.includes(cmdCategory));
  }
  return false;
}

function resolveCommandInfo(client, input) {
  const target = String(input || '').toLowerCase();
  let found = null;

  client.commands.forEach((cmd, origName) => {
    if (found) return;
    const baseName = String(origName || '').toLowerCase();
    const aliases = Array.isArray(cmd.help?.aliases)
      ? cmd.help.aliases.map((a) => String(a).toLowerCase())
      : [];

    if (baseName === target || aliases.includes(target)) {
      found = {
        baseName: String(cmd.help?.name || origName || target)
          .trim()
          .toLowerCase(),
        category: String(cmd.help?.category || '')
          .trim()
          .toLowerCase(),
      };
    }
  });

  return found;
}

async function ensureBehavior(db, guildId, scope, channelId) {
  const behaviorKey = getBehaviorKey(guildId, scope, channelId);
  const current = await db.get(behaviorKey);
  if (!current) await db.set(behaviorKey, 'uyar');
}

module.exports.execute = async (client, message, args) => {
  const db = client.db;
  const guildId = message.guild && message.guild.id;
  if (!guildId) return;
  const channelId = message.channel.id;

  const sub = (args[0] || '').toLowerCase();

  if (sub === 'sıfırla' || sub === 'sifirla') {
    const rows = (await db.all()) || [];
    const toDelete = rows
      .map((r) => r && r.id)
      .filter(Boolean)
      .filter(
        (id) =>
          id.startsWith(`kkRule_channel_${guildId}_`) ||
          id.startsWith(`kkRule_${guildId}_`) ||
          id === `kkRule_guild_${guildId}` ||
          id.startsWith(`kkBehavior_channel_${guildId}_`) ||
          id === `kkBehavior_guild_${guildId}` ||
          id.startsWith(`aiKapali_channel_${guildId}_`) ||
          id === `aiKapali_guild_${guildId}` ||
          id.startsWith(`botKapali_channel_${guildId}_`) ||
          id === `botKapali_guild_${guildId}`,
      );
    for (const id of toDelete) {
      try {
        await db.delete(id);
      } catch {}
    }
    return message
      .reply(
        `${emojis.bot.succes} | Sunucu için tüm KK yapılandırmaları silindi.`,
      )
      .catch(() => {});
  }

  if (sub === 'davranış' || sub === 'davranis') {
    let scope = 'channel';
    const maybeGuild = args.findIndex((x) => isGuildToken(x));
    const maybeChannel = args.findIndex((x) => isChannelToken(x));
    let channel = message.mentions.channels.first() || message.channel;

    if (maybeGuild !== -1) {
      scope = 'guild';
    } else if (maybeChannel !== -1 || !message.mentions.channels.first()) {
      scope = 'channel';
    }

    let startIdx = 1;
    if (scope === 'guild') {
      startIdx = maybeGuild + 1;
    } else {
      const idx = args.findIndex(
        (x) => channel && String(x).includes(channel.id),
      );
      startIdx = idx !== -1 ? idx + 1 : 1;
    }

    const rest = args.slice(startIdx).join(' ').trim();
    const compact = rest.replace(/\s+/g, ' ').trim();
    const b =
      parseBehavior(compact) ||
      parseBehavior(compact.replace(/\s+/g, '')) ||
      (compact === 'uyar sonra sil' ? 'uyar_sonra_sil' : null);

    if (!b) {
      return message
        .reply(
          `${emojis.bot.error} | Kullanım: kk davranış [#kanal|/sunucu] <sil|uyar|uyar sonra sil>`,
        )
        .catch(() => {});
    }

    if (scope === 'guild') {
      await db.set(getBehaviorKey(guildId, 'guild', channel.id), b);
      return message
        .reply(
          `${emojis.bot.succes} | Sunucu davranışı ayarlandı: ${behaviorLabel(b)}`,
        )
        .catch(() => {});
    }

    await db.set(getBehaviorKey(guildId, 'channel', channel.id), b);
    return message
      .reply(
        `${emojis.bot.succes} | ${channel} kanal davranışı ayarlandı: ${behaviorLabel(
          b,
        )}`,
      )
      .catch(() => {});
  }

  const action = sub;
  if (!action || (action !== 'kapat' && action !== 'aç' && action !== 'ac')) {
    return message
      .reply(
        `${emojis.bot.error} | Kullanım: kk <kapat|aç> [#kanal|/sunucu] <...>`,
      )
      .catch(() => {});
  }

  let scope = 'channel';
  let scopeChannel = message.mentions.channels.first() || message.channel;
  const guildIdx = args.findIndex((x) => isGuildToken(x));
  const channelIdx = args.findIndex((x) => isChannelToken(x));

  if (guildIdx !== -1) {
    scope = 'guild';
  } else if (channelIdx !== -1) {
    scope = 'channel';
  }

  let startIdx = 1;
  if (scope === 'guild') {
    startIdx = guildIdx + 1;
  } else {
    const mentionIdx = args.findIndex((x) => String(x).includes(scopeChannel.id));
    if (mentionIdx !== -1) {
      startIdx = mentionIdx + 1;
    } else if (channelIdx !== -1) {
      startIdx = channelIdx + 1;
    }
  }

  const listPart = args.slice(startIdx).join(' ').trim();
  if (!listPart) {
    return message
      .reply(
        `${emojis.bot.error} | Hedef komutları yaz. Örn: kk kapat ${
          scope === 'guild' ? '/sunucu' : `${scopeChannel}`
        } #hepsi#`,
      )
      .catch(() => {});
  }

  const targetRaw = normalizeToken(listPart);
  const scopeLabel = scope === 'guild' ? 'sunucuda' : `${scopeChannel} kanalında`;

  if (isAiToken(targetRaw) || isBotToken(targetRaw)) {
    const key = isAiToken(targetRaw)
      ? getAiKey(guildId, scope, scopeChannel.id)
      : getBotKey(guildId, scope, scopeChannel.id);
    const label = isAiToken(targetRaw) ? 'yapay zeka' : 'tüm bot işlemleri';

    if (action === 'kapat') {
      await db.set(key, true);
      return message
        .reply(`${emojis.bot.succes} | ${scopeLabel} ${label} kapatıldı.`)
        .catch(() => {});
    }

    await db.delete(key);
    return message
      .reply(`${emojis.bot.succes} | ${scopeLabel} ${label} yeniden açıldı.`)
      .catch(() => {});
  }

  const ruleKey = getRuleKey(guildId, scope, scopeChannel.id);
  const rawTokens = listPart
    .split(/[\s,]+/g)
    .map((t) => String(t || '').trim())
    .filter(Boolean);

  const hasAll = rawTokens.some((t) => isAllToken(t));
  const categories = rawTokens
    .map((t) => normalizeCategoryToken(t))
    .filter(Boolean);
  const isAllowStyle = rawTokens.some((t) => String(t).trim().startsWith('#'));
  const cmdTokens = rawTokens
    .filter((t) => !isAllToken(t))
    .filter((t) => !normalizeCategoryToken(t))
    .map((t) => normalizeToken(t))
    .filter(Boolean);

  const resolveName = (name) => {
    const n = String(name || '').toLowerCase();
    if (client.aliases && client.aliases.get && client.aliases.get(n)) {
      return String(client.aliases.get(n)).toLowerCase();
    }
    return n;
  };

  const baseNames = Array.from(new Set(cmdTokens.map(resolveName)));

  const botCategoryToken = categories.includes('bot');
  const normalizedCategories = Array.from(
    new Set(categories.map((c) => String(c).toLowerCase())),
  );

  let expanded = baseNames;
  if (botCategoryToken) {
    const extra = [];
    if (client.commands && client.commands.forEach) {
      client.commands.forEach((cmd) => {
        const cat =
          cmd && cmd.help && cmd.help.category ? String(cmd.help.category) : '';
        if (cat && String(cat).toLowerCase() === 'bot') {
          if (cmd.help && cmd.help.name)
            extra.push(String(cmd.help.name).toLowerCase());
        }
      });
    }
    expanded = Array.from(new Set(expanded.concat(extra)));
  }

  if (action === 'kapat') {
    await ensureBehavior(db, guildId, scope, scopeChannel.id);

    if (hasAll) {
      await db.set(ruleKey, { mode: 'all', commands: [], categories: [] });
      return message
        .reply(
          `${emojis.bot.succes} | ${
            scope === 'guild' ? 'Sunucuda' : `${scopeChannel} kanalında`
          } tüm komutlar kapatıldı.`,
        )
        .catch(() => {});
    }

    if (!expanded.length && !normalizedCategories.length) {
      return message
        .reply(`${emojis.bot.error} | En az 1 komut yaz.`)
        .catch(() => {});
    }

    if (isAllowStyle) {
      await db.set(ruleKey, {
        mode: 'allow',
        commands: expanded,
        categories: [],
      });
      return message
        .reply(
          `${emojis.bot.succes} | ${
            scope === 'guild' ? 'Sunucuda' : `${scopeChannel} kanalında`
          } sadece şu komutlar açık: ${expanded
            .map((x) => `\`${x}\``)
            .join(', ')}`,
        )
        .catch(() => {});
    }

    await db.set(ruleKey, {
      mode: 'block',
      commands: expanded,
      categories: normalizedCategories.filter((c) => c !== 'bot'),
    });
    return message
      .reply(
        `${emojis.bot.succes} | ${
          scope === 'guild' ? 'Sunucuda' : `${scopeChannel} kanalında`
        } komut kısıtlaması ayarlandı.`,
      )
      .catch(() => {});
  }

  if (hasAll) {
    await db.delete(ruleKey);
    return message
      .reply(
        `${emojis.bot.succes} | ${
          scope === 'guild' ? 'Sunucuda' : `${scopeChannel} kanalında`
        } tüm komutlar açıldı.`,
      )
      .catch(() => {});
  }

  if (!expanded.length && !normalizedCategories.length) {
    return message
      .reply(`${emojis.bot.error} | En az 1 komut yaz.`)
      .catch(() => {});
  }

  const current = (await db.get(ruleKey)) || null;
  const curMode =
    current && current.mode ? String(current.mode).toLowerCase() : '';
  const curList =
    current && Array.isArray(current.commands) ? current.commands : [];
  const curCats =
    current && Array.isArray(current.categories) ? current.categories : [];

  if (
    scope === 'channel' &&
    expanded.length === 1 &&
    !normalizedCategories.length &&
    !current &&
    !hasAll
  ) {
    const targetCommand = resolveCommandInfo(client, expanded[0]);
    const guildRule = await db.get(getRuleKey(guildId, 'guild', scopeChannel.id));
    if (
      targetCommand &&
      ruleBlocks(guildRule, targetCommand.baseName, targetCommand.category)
    ) {
      await ensureBehavior(db, guildId, scope, scopeChannel.id);
      await db.set(ruleKey, {
        mode: 'allow',
        commands: [targetCommand.baseName],
        categories: [],
      });
      return message
        .reply(
          `${emojis.bot.succes} | \`${targetCommand.baseName}\` komutu bu kanalda açıldı. Sunucuda kapalı olsa da burada çalışacak.`,
        )
        .catch(() => {});
    }
  }

  if (!current) {
    return message
      .reply(`${emojis.bot.error} | Bu hedef için bir kısıtlama yok.`)
      .catch(() => {});
  }

  if (curMode === 'block') {
    const removeCmd = new Set(expanded.map((x) => String(x).toLowerCase()));
    const removeCat = new Set(
      normalizedCategories.map((x) => String(x).toLowerCase()),
    );
    const nextCmd = curList
      .map((x) => String(x).toLowerCase())
      .filter((x) => !removeCmd.has(x));
    const nextCat = curCats
      .map((x) => String(x).toLowerCase())
      .filter((x) => !removeCat.has(x));
    if (!nextCmd.length && !nextCat.length) {
      await db.delete(ruleKey);
      return message
        .reply(
          `${emojis.bot.succes} | ${
            scope === 'guild' ? 'Sunucuda' : `${scopeChannel} kanalında`
          } kısıtlama kaldırıldı.`,
        )
        .catch(() => {});
    }
    await db.set(ruleKey, {
      mode: 'block',
      commands: nextCmd,
      categories: nextCat,
    });
    return message
      .reply(`${emojis.bot.succes} | Seçilenler açıldı.`)
      .catch(() => {});
  }

  if (curMode === 'allow') {
    const next = Array.from(
      new Set(
        curList
          .map((x) => String(x).toLowerCase())
          .concat(expanded.map((x) => String(x).toLowerCase())),
      ),
    );
    await db.set(ruleKey, { mode: 'allow', commands: next, categories: [] });
    return message
      .reply(`${emojis.bot.succes} | Seçilen komutlar açıldı.`)
      .catch(() => {});
  }

  if (curMode === 'all') {
    await db.set(ruleKey, {
      mode: 'allow',
      commands: expanded,
      categories: [],
    });
    return message
      .reply(
        `${emojis.bot.succes} | ${
          scope === 'guild' ? 'Sunucuda' : `${scopeChannel} kanalında`
        } sadece şu komutlar açık: ${expanded
          .map((x) => `\`${x}\``)
          .join(', ')}`,
      )
      .catch(() => {});
  }

  await db.delete(ruleKey);
  return message
    .reply(`${emojis.bot.succes} | Kısıtlama kaldırıldı.`)
    .catch(() => {});
};
