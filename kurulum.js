const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { Client, Intents, Permissions } = require('discord.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) =>
  new Promise((res) => rl.question(q, (a) => res(String(a).trim())));

let botName = '';
let PROMPT_OWNER_ID = '';
let PROMPT_PREFIX = '';
let PROMPT_GROQ_API = '';
let PROMPT_GROQ_MODEL = '';
let PROMPT_SERPER = '';
let setupStarted = false;

const resolveRoot = (...segments) => path.join(__dirname, ...segments);

function capitalizeFirst(text) {
  const value = String(text || '').trim();
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getBotDisplayName(inputName, fallbackName) {
  return capitalizeFirst(inputName || fallbackName || 'Bot');
}

function findFirstExistingPath(paths) {
  return paths.find((filePath) => fs.existsSync(filePath)) || null;
}

function ensureClientToken(client, token) {
  if (client.token) {
    return;
  }

  client.token = token;
  if (client.rest && typeof client.rest.setToken === 'function') {
    client.rest.setToken(token);
  }
  console.warn('Discord istemci tokeni eksikti, tekrar yüklendi.');
}

async function withTokenRetry(client, token, action) {
  ensureClientToken(client, token);

  try {
    return await action();
  } catch (err) {
    if (err && /token was unavailable to the client/i.test(err.message)) {
      ensureClientToken(client, token);
      return await action();
    }
    throw err;
  }
}

function runSecondStage() {
  const secondStagePath = resolveRoot('kurulum2.js');
  if (!fs.existsSync(secondStagePath)) {
    console.log('kurulum2.js bulunamadı, ilk kurulum sonrası çıkılıyor.');
    process.exit(0);
    return;
  }

  console.log('İlk kurulum tamamlandı, kurulum2.js başlatılıyor...');
  rl.close();

  const child = spawn(process.execPath, [secondStagePath], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('kurulum2.js başlatılamadı:', err.message);
    process.exit(1);
  });
}

(async () => {
  try {
    const token = await ask('Bot tokenini girin: ');
    if (!token) {
      process.exit(1);
    }

    PROMPT_PREFIX = await ask('Bot prefixini girin: ');
    PROMPT_OWNER_ID = await ask('Owner ID girin: ');
    PROMPT_GROQ_API = await ask('GROQ API key girin : ');

    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ];

    console.log('\nLütfen kullanmak istediğiniz GROQ modelini seçin:');
    groqModels.forEach((m, i) => console.log(`${i + 1}. ${m}`));

    while (true) {
      const choice = await ask('Seçiminiz (1-4): ');
      const index = parseInt(choice, 10) - 1;
      if (index >= 0 && index < groqModels.length) {
        PROMPT_GROQ_MODEL = groqModels[index];
        break;
      }
      console.log('Geçersiz seçim! Lütfen 1 ile 4 arasında bir sayı girin.');
    }

    PROMPT_SERPER = await ask('\nSerper API key girin : ');

    const client = new Client({
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
      ],
    });

    client.once('ready', async () => {
      const change = (
        await ask('Bot avatari ve banner degistirilsin mi? (evet/hayir): ')
      ).toLowerCase();
      if (change === 'evet' || change === 'e') {
        try {
          const avatarPath = resolveRoot('src', 'emojiler', 'botpp.png');
          const bannerPath = findFirstExistingPath([
            resolveRoot('src', 'emojiler', 'botbanner.png'),
            resolveRoot('src', 'emojiler', 'botbanner.jpg'),
            resolveRoot('src', 'emojiler', 'botbanner.jpeg'),
          ]);

          const C_GREEN = '\x1b[32m';
          const C_YELLOW = '\x1b[33m';
          const C_RED = '\x1b[31m';
          const C_CYAN = '\x1b[36m';
          const C_RESET = '\x1b[0m';

          if (fs.existsSync(avatarPath)) {
            const ext = path.extname(avatarPath).replace('.', '');
            const mimeType =
              ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            const avatarData = fs.readFileSync(avatarPath);
            const avatarBase64 = `data:${mimeType};base64,${avatarData.toString('base64')}`;
            try {
              await withTokenRetry(client, token, () =>
                client.user.setAvatar(avatarBase64),
              );
              console.log(
                `${C_GREEN}✔ Bot avatarı başarıyla güncellendi.${C_RESET}`,
              );
            } catch (err) {
              console.error(
                `${C_RED}✖ Bot avatarı değiştirilemedi: ${err.message}${C_RESET}`,
              );
            }
          } else {
            console.warn(
              `${C_YELLOW}⚠ botpp.png bulunamadı, bot avatarı değiştirilemedi.${C_RESET}`,
            );
          }

          if (bannerPath && fs.existsSync(bannerPath)) {
            const ext = path.extname(bannerPath).replace('.', '');
            const mimeType =
              ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            const bannerData = fs.readFileSync(bannerPath);
            const bannerBase64 = `data:${mimeType};base64,${bannerData.toString('base64')}`;

            try {
              if (typeof client.user.setBanner === 'function') {
                await withTokenRetry(client, token, () =>
                  client.user.setBanner(bannerBase64),
                );
              } else {
                await withTokenRetry(client, token, () =>
                  client.user.edit({ banner: bannerBase64 }),
                );
              }
              console.log(
                `${C_GREEN}✔ Bot bannerı başarıyla güncellendi.${C_RESET}`,
              );
            } catch (err) {
              console.error(
                `${C_RED}✖ Bot bannerı değiştirilemedi: ${err.message}${C_RESET}`,
              );
            }
          } else {
            console.warn(
              `${C_YELLOW}⚠ botbanner dosyası bulunamadı, atlanıyor.${C_RESET}`,
            );
          }
        } catch (err) {
          console.error(
            'Bot profil dosyaları uygulanırken hata oluştu:',
            err.message,
          );
        }
      }

      botName = await ask('Botun ismini girin: ');
      botName = getBotDisplayName(botName, client.user.username);

      const inviteURL = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=${Permissions.FLAGS.ADMINISTRATOR}&scope=bot%20applications.commands`;
      console.log('\n== DAVET LINKI ==');
      console.log(inviteURL);
      console.log('Bot bir sunucuya katılmayı bekliyor...');
    });

    client.on('guildCreate', async (guild) => {
      if (setupStarted) {
        console.log(
          'Kurulum zaten başlatıldı, yeni guildCreate olayı atlanıyor.',
        );
        return;
      }
      setupStarted = true;
      ensureClientToken(client, token);

      console.log(`Bot sunucuya katıldı: ${guild.name} (${guild.id})`);
      console.log('Kurulum işlemleri başlıyor, lütfen bekleyin...');
      try {
        const botDisplayName = getBotDisplayName(botName, client.user.username);
        const botUpperName = botDisplayName.toUpperCase();
        const logChannelName = `✍️┃${botDisplayName}・log`;
        const newName = `${botDisplayName} Support Server`;
        try {
          await withTokenRetry(client, token, () => guild.setName(newName));
        } catch (err) {}

        const avatarPath = resolveRoot('src', 'emojiler', 'botpp.png');
        if (fs.existsSync(avatarPath)) {
          const icon = fs.readFileSync(avatarPath);
          try {
            await withTokenRetry(client, token, () => guild.setIcon(icon));
          } catch (err) {}
        }

        let logChannelId = '';
        try {
          const existingLog = guild.channels.cache.find(
            (c) => c.name === logChannelName && c.type === 'GUILD_TEXT',
          );
          if (existingLog) {
            logChannelId = existingLog.id;
          } else {
            const createdLog = await withTokenRetry(client, token, () =>
              guild.channels.create(logChannelName, {
                type: 'GUILD_TEXT',
                permissionOverwrites: [
                  {
                    id: guild.roles.everyone.id,
                    deny: [Permissions.FLAGS.VIEW_CHANNEL],
                  },
                ],
              }),
            );
            logChannelId = createdLog.id;
          }
        } catch (err) {}

        const emojisDir = resolveRoot('src', 'emojiler');
        const uploadedMap = {};

        if (fs.existsSync(emojisDir)) {
          const files = fs
            .readdirSync(emojisDir)
            .filter((f) =>
              ['.png', '.gif'].some((ext) => f.toLowerCase().endsWith(ext)),
            );
          const toUpload = files.filter(
            (f) =>
              ![
                'botpp.png',
                'botbanner.png',
                'botbanner.jpg',
                'botbanner.jpeg',
              ].includes(f.toLowerCase()),
          );

          for (const file of toUpload) {
            const full = path.join(emojisDir, file);
            const name = path.parse(file).name;
            try {
              const buffer = fs.readFileSync(full);
              const created = await withTokenRetry(client, token, () =>
                guild.emojis.create(buffer, name),
              );
              uploadedMap[name] = created;
              console.log(`Emoji yüklendi: ${name}`);
            } catch (err) {
              console.error(`Emoji yüklenemedi (${file}):`, err.message);
            }
          }
          console.log(
            `Toplam yüklenen emoji sayısı: ${Object.keys(uploadedMap).length}`,
          );
        } else {
          console.warn(
            'src/emojiler klasörü bulunamadı, emoji yükleme atlandı.',
          );
        }

        const template = {
          cards: {
            2: '<:maa2:>',
            3: '<:maa3:>',
            4: '<:maa4:>',
            5: '<:maa5:>',
            6: '<:maa6:>',
            7: '<:maa7:>',
            8: '<:maa8:>',
            9: '<:maa9:>',
            10: '<:maa10:>',
            J: '<:maajoker:>',
            Q: '<:maakz:>',
            K: '<:maakral:>',
            A: '<:maaas:>',
          },
          cardBack: '<:iskambilkadarkadangrn:>',
          money: {
            high: '<:cuvalDestinex:>',
            medium: '<:banknotDestinex:>',
            low: '<:Destinex:>',
            AI: '<:aidestiniex:>',
          },
          slot: {
            spinning: '<a:slotd:>',
            slot1: '<:slot1:>',
            slot2: '<:slot2:>',
            slot3: '<:slot3:>',
          },
          guns: {
            bos: '<:38Specialbos:>',
            ates: '<:38Specialates:>',
          },
          coinflip: {
            spinner: '<a:dnyor:>',
            heads: '<:Destinex:>',
            tails: '<:Destinex2:>',
          },
          wifi: {
            4: '<:4tikliwifi:>',
            3: '<:3tikliwifi:>',
            2: '<:2tikliwifi:>',
            1: '<:1tikliwifi:>',
          },
          bot: {
            error: '<:error:>',
            succes: '<:succes:>',
          },
        };

        function fillIds(obj) {
          if (typeof obj === 'string') {
            return obj.replace(/<(a?):([^:>]+):>/g, (m, animatedFlag, name) => {
              const found = uploadedMap[name];
              if (found) {
                return animatedFlag === 'a'
                  ? `<a:${name}:${found.id}>`
                  : `<:${name}:${found.id}>`;
              }
              return m;
            });
          }
          if (Array.isArray(obj)) return obj.map(fillIds);
          if (obj && typeof obj === 'object') {
            const out = {};
            for (const k of Object.keys(obj)) out[k] = fillIds(obj[k]);
            return out;
          }
          return obj;
        }

        const filled = fillIds(template);

        const emojiJsonPath = resolveRoot('src', 'emoji.json');
        try {
          fs.mkdirSync(path.dirname(emojiJsonPath), { recursive: true });
          fs.writeFileSync(
            emojiJsonPath,
            JSON.stringify(filled, null, 2),
            'utf8',
          );
          console.log('emoji.json dosyası oluşturuldu.');
        } catch (err) {
          console.error('emoji.json oluşturulamadı:', err.message);
        }

        try {
          await guild.members.fetch();
        } catch (e) {
          console.warn(
            'Üyeler çekilemedi (Intents kapalı olabilir):',
            e.message,
          );
        }

        let ownerId = PROMPT_OWNER_ID || '';
        if (!ownerId) {
          const nonBotMembers = guild.members.cache
            .filter((m) => !m.user.bot)
            .map((m) => m.user.id);
          ownerId = nonBotMembers[0] || '';
        }
        const adminIds = ownerId ? [ownerId] : [];

        let supportInvite = '';
        try {
          const me = guild.members.me || guild.me;
          const targetChannel = guild.channels.cache.find(
            (c) =>
              c.type === 'GUILD_TEXT' &&
              me &&
              c.permissionsFor(me).has(Permissions.FLAGS.CREATE_INSTANT_INVITE),
          );
          if (targetChannel) {
            const invite = await withTokenRetry(client, token, () =>
              targetChannel.createInvite({
                maxAge: 0,
                maxUses: 0,
                unique: true,
              }),
            );
            supportInvite = `discord.gg/${invite.code}`;
          }
        } catch (err) {}

        try {
          for (const ch of guild.channels.cache.values()) {
            if (ch.id === logChannelId) {
              continue;
            }
            try {
              await withTokenRetry(client, token, () => ch.delete());
            } catch (err) {
              console.error(`Kanal silinemedi (${ch.name}):`, err.message);
            }
          }
          for (const r of guild.roles.cache.values()) {
            if (r.id === guild.id) continue;
            if (r.managed) continue;
            try {
              await withTokenRetry(client, token, () => r.delete());
            } catch (err) {
              console.error(`Rol silinemedi (${r.name}):`, err.message);
            }
          }
        } catch (err) {}

        const moderatePerm =
          Permissions.FLAGS.MODERATE_MEMBERS || Permissions.FLAGS.MUTE_MEMBERS;

        const roleDefinitions = [
          {
            key: '.',
            name: '.',
            color: '#3498db',
            perms: [Permissions.FLAGS.ADMINISTRATOR],
            hoist: true,
          },
          {
            key: 'LOCK',
            name: '🔒',
            color: '#e74c3c',
            perms: [Permissions.FLAGS.ADMINISTRATOR],
            hoist: true,
          },
          {
            key: 'QUEN',
            name: 'Vibe | Quen',
            color: '#8e44ad',
            perms: [],
            hoist: false,
          },
          {
            key: 'LEADER',
            name: 'Vibe | Leader',
            color: '#f1c40f',
            perms: [Permissions.FLAGS.ADMINISTRATOR],
            hoist: false,
          },
          {
            key: 'GUARDIAN',
            name: 'Epic | Guardian',
            color: '#e67e22',
            perms: [Permissions.FLAGS.ADMINISTRATOR],
            hoist: false,
          },
          {
            key: 'MANAGER',
            name: 'Hang | Manager',
            color: '#2ecc71',
            perms: [
              Permissions.FLAGS.MANAGE_CHANNELS,
              Permissions.FLAGS.MANAGE_ROLES,
              Permissions.FLAGS.KICK_MEMBERS,
              Permissions.FLAGS.BAN_MEMBERS,
              Permissions.FLAGS.MANAGE_NICKNAMES,
            ],
            hoist: false,
          },
          {
            key: 'MODERATOR',
            name: 'Qlax | Moderatör',
            color: '#1abc9c',
            perms: [
              Permissions.FLAGS.MANAGE_CHANNELS,
              Permissions.FLAGS.KICK_MEMBERS,
              Permissions.FLAGS.BAN_MEMBERS,
              Permissions.FLAGS.MANAGE_NICKNAMES,
            ],
            hoist: false,
          },
          {
            key: 'TRIALMOD',
            name: 'Qlax | Trial Moderatör',
            color: '#9b59b6',
            perms: [
              Permissions.FLAGS.KICK_MEMBERS,
              Permissions.FLAGS.MANAGE_NICKNAMES,
            ],
            hoist: false,
          },
          {
            key: 'GUIDE',
            name: 'Slar | Guide',
            color: '#34495e',
            perms: [
              Permissions.FLAGS.MANAGE_CHANNELS,
              Permissions.FLAGS.MANAGE_ROLES,
              moderatePerm,
            ],
            hoist: false,
          },
          {
            key: 'TRIALGUIDE',
            name: 'Slar | Trial Guide',
            color: '#e84393',
            perms: [
              Permissions.FLAGS.MANAGE_CHANNELS,
              Permissions.FLAGS.MANAGE_ROLES,
            ],
            hoist: false,
          },
          {
            key: 'GUEST',
            name: 'Hang | Guest',
            color: '#fdcb6e',
            perms: [],
            hoist: false,
          },
          {
            key: 'MEMBER',
            name: 'Hang | Member',
            color: '#00cec9',
            perms: [],
            hoist: false,
          },
          {
            key: 'BOT',
            name: 'Hang | Bot',
            color: '#6c5ce7',
            perms: [Permissions.FLAGS.ADMINISTRATOR],
            hoist: false,
          },
          {
            key: 'MUTE',
            name: 'mute',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'VERIFY',
            name: 'verify',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: '18PLUS',
            name: '18+ years old',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: '18',
            name: '18 years old',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: '17',
            name: '17 years old',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: '16',
            name: '16 years old',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: '15',
            name: '15 years old',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'ALONE',
            name: 'alone',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'COUPLED',
            name: 'coupled',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'VALORANT',
            name: 'valorant',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'GENSHIN',
            name: 'genshin impact',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'CS',
            name: 'counter strike',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'MC',
            name: 'minecraft',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'ROBLOX',
            name: 'roblox',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'KELIME',
            name: 'kelime',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'BOM',
            name: 'bom',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'RESFEBE',
            name: 'resfebe',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'CONNECT4',
            name: 'connect4',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'ACIKLA',
            name: 'açıkla',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'AICHAT',
            name: 'aichat',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'DUYURU',
            name: 'duyuru',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'KURALLAR',
            name: 'kurallar',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'BILDIR',
            name: 'bildir',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'OZELSES',
            name: 'özelses',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'GELENGIDEN',
            name: 'gelengiden',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'TICKET',
            name: 'ticket',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'FOTOURET',
            name: 'fotoüret',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'DESNET',
            name: 'desnet',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'ANIMEONER',
            name: 'animeöner',
            color: undefined,
            perms: [],
            hoist: false,
          },
          {
            key: 'KOMUT_BAKIM',
            name: 'komut bakım duyuru',
            color: undefined,
            perms: [],
            hoist: false,
          },
        ];

        const createdRoles = {};
        for (const rd of roleDefinitions) {
          try {
            const hoistRole = rd.color && rd.key !== 'QUEN' ? true : rd.hoist;
            const r = await withTokenRetry(client, token, () =>
              guild.roles.create({
                name: rd.name,
                color: rd.color,
                permissions: rd.perms,
                hoist: hoistRole,
              }),
            );
            createdRoles[rd.key] = r.id;
          } catch (err) {
            console.error(`Rol oluşturulamadı (${rd.name}):`, err.message);
          }
        }

        const createdChannels = {};

        const roleId = (key) => createdRoles[key] || null;
        const everyone = guild.roles.everyone;

        const yetkiliIds = [
          roleId('.'),
          roleId('LOCK'),
          roleId('LEADER'),
          roleId('GUARDIAN'),
          roleId('MANAGER'),
          roleId('MODERATOR'),
          roleId('TRIALMOD'),
          roleId('GUIDE'),
          roleId('TRIALGUIDE'),
        ].filter(Boolean);

        const adminIdsArray = [
          roleId('.'),
          roleId('LOCK'),
          roleId('LEADER'),
          roleId('GUARDIAN'),
        ].filter(Boolean);

        async function createCategory(name, permissionOverwrites = []) {
          try {
            const cat = await withTokenRetry(client, token, () =>
              guild.channels.create(name, {
                type: 'GUILD_CATEGORY',
                permissionOverwrites,
              }),
            );
            createdChannels[name] = cat.id;
            return cat;
          } catch (err) {
            return null;
          }
        }

        async function createChannel(
          name,
          type,
          parent,
          permissionOverwrites = [],
          extra = {},
        ) {
          try {
            const ch = await withTokenRetry(client, token, () =>
              guild.channels.create(name, {
                type,
                parent: parent ? parent.id : undefined,
                permissionOverwrites,
                ...extra,
              }),
            );
            createdChannels[name] = ch.id;
            return ch;
          } catch (err) {
            return null;
          }
        }

        const verifyId = roleId('VERIFY');
        const mutedId = roleId('MUTE');

        await createChannel(
          'doğrulama',
          'GUILD_TEXT',
          null,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            verifyId
              ? {
                  id: verifyId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        await createChannel(
          'muted-only',
          'GUILD_TEXT',
          null,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            mutedId
              ? {
                  id: mutedId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        createdChannels[logChannelName] = logChannelId;
        createdChannels.LOG_CHANNEL = logChannelId;

        const cat_staff = await createCategory('S T A F F');

        await createChannel(
          '👑┃owner・chat',
          'GUILD_TEXT',
          cat_staff,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            ...adminIdsArray.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        await createChannel(
          '💠┃staff・rules',
          'GUILD_TEXT',
          cat_staff,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            ...yetkiliIds.map((id) => ({
              id,
              allow: [Permissions.FLAGS.VIEW_CHANNEL],
              deny: [Permissions.FLAGS.SEND_MESSAGES],
            })),
          ].filter(Boolean),
        );

        await createChannel(
          '💠┃staff・chat',
          'GUILD_TEXT',
          cat_staff,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        const questMap = {
          GUARDIAN: '💠┃guardian・quests',
          MANAGER: '💠┃manager・quests',
          MODERATOR: '💠┃mod・quests',
          TRIALMOD: '💠┃trialmod・quests',
          GUIDE: '💠┃guide・quests',
          TRIALGUIDE: '💠┃trialguide・quests',
        };

        for (const [rKey, cName] of Object.entries(questMap)) {
          const rId = roleId(rKey);
          await createChannel(
            cName,
            'GUILD_TEXT',
            cat_staff,
            [
              { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
              rId
                ? {
                    id: rId,
                    allow: [Permissions.FLAGS.VIEW_CHANNEL],
                    deny: [Permissions.FLAGS.SEND_MESSAGES],
                  }
                : null,
            ].filter(Boolean),
          );
        }

        const spacedBotName = botDisplayName.split('').join(' ').toUpperCase();

        const cat_bot_spaced = await createCategory(spacedBotName);
        await createChannel(
          supportInvite || 'sunucu-linki',
          'GUILD_VOICE',
          cat_bot_spaced,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.CONNECT] },
            verifyId
              ? { id: verifyId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
            mutedId
              ? { id: mutedId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
          ].filter(Boolean),
        );

        const cat_plus = await createCategory('➕');
        await createChannel(
          '➕ Özel Oda Oluştur',
          'GUILD_VOICE',
          cat_plus,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            roleId('OZELSES')
              ? {
                  id: roleId('OZELSES'),
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [
                    Permissions.FLAGS.SPEAK,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
            verifyId
              ? { id: verifyId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
            mutedId
              ? { id: mutedId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
          ].filter(Boolean),
          { userLimit: 1 },
        );

        const cat_bot_normal = await createCategory(botUpperName);
        const bName = botDisplayName;

        const duyuruId = roleId('DUYURU');
        await createChannel(
          '🔔・announcements',
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            duyuruId
              ? {
                  id: duyuruId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [Permissions.FLAGS.SEND_MESSAGES],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        const komutBakimId = roleId('KOMUT_BAKIM');
        await createChannel(
          `🔔・${bName}・bakım`,
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            komutBakimId
              ? {
                  id: komutBakimId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [Permissions.FLAGS.SEND_MESSAGES],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        await createChannel(
          `🔔・${bName}・bakım・log`,
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            komutBakimId
              ? {
                  id: komutBakimId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [Permissions.FLAGS.SEND_MESSAGES],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        const gelenGidenId = roleId('GELENGIDEN');
        await createChannel(
          '⚕️・gelen・giden',
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            gelenGidenId
              ? {
                  id: gelenGidenId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [Permissions.FLAGS.SEND_MESSAGES],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        const kurallarId = roleId('KURALLAR');
        await createChannel(
          `📜・${bName}・rules`,
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            kurallarId
              ? {
                  id: kurallarId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [Permissions.FLAGS.SEND_MESSAGES],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        const bildirId = roleId('BILDIR');
        await createChannel(
          '❓・i̇stek・şikayet',
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            bildirId
              ? {
                  id: bildirId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const ticketId = roleId('TICKET');
        await createChannel(
          '🎟️・ticket',
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            ticketId
              ? {
                  id: ticketId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [Permissions.FLAGS.SEND_MESSAGES],
                }
              : null,
            ...yetkiliIds.map((id) => ({
              id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            })),
          ].filter(Boolean),
        );

        await createChannel(
          '👑・vip・al',
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.SEND_MESSAGES] },
            ...yetkiliIds.map((id) => ({
              id,
              allow: [Permissions.FLAGS.SEND_MESSAGES],
            })),
            verifyId
              ? { id: verifyId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
            mutedId
              ? { id: mutedId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
          ].filter(Boolean),
        );

        await createChannel(
          '🍭・rol・al',
          'GUILD_TEXT',
          cat_bot_normal,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.SEND_MESSAGES] },
            ...yetkiliIds.map((id) => ({
              id,
              allow: [Permissions.FLAGS.SEND_MESSAGES],
            })),
            verifyId
              ? { id: verifyId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
            mutedId
              ? { id: mutedId, deny: [Permissions.FLAGS.VIEW_CHANNEL] }
              : null,
          ].filter(Boolean),
        );

        const cat_ribbon = await createCategory('🎀');
        const memberId = roleId('MEMBER');

        await createChannel(
          '💬・sohbet',
          'GUILD_TEXT',
          cat_ribbon,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            memberId
              ? {
                  id: memberId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const aichatId = roleId('AICHAT');
        await createChannel(
          '🤖・ai・chat',
          'GUILD_TEXT',
          cat_ribbon,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            aichatId
              ? {
                  id: aichatId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const fotouretId = roleId('FOTOURET');
        await createChannel(
          '📸・foto・üret',
          'GUILD_TEXT',
          cat_ribbon,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            fotouretId
              ? {
                  id: fotouretId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        await createChannel(
          '🧩・komut',
          'GUILD_TEXT',
          cat_ribbon,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            memberId
              ? {
                  id: memberId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const aciklaId = roleId('ACIKLA');
        await createChannel(
          '❓・açıkla',
          'GUILD_TEXT',
          cat_ribbon,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            aciklaId
              ? {
                  id: aciklaId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const cat_star = await createCategory('⭐');

        const kelimeId = roleId('KELIME');
        await createChannel(
          '⭐・kelime',
          'GUILD_TEXT',
          cat_star,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            kelimeId
              ? {
                  id: kelimeId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const bomId = roleId('BOM');
        await createChannel(
          '💣・bom',
          'GUILD_TEXT',
          cat_star,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            bomId
              ? {
                  id: bomId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const resfebeId = roleId('RESFEBE');
        await createChannel(
          '💯・resfebe',
          'GUILD_TEXT',
          cat_star,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            resfebeId
              ? {
                  id: resfebeId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const connect4Id = roleId('CONNECT4');
        await createChannel(
          '⚽・connect4',
          'GUILD_TEXT',
          cat_star,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            connect4Id
              ? {
                  id: connect4Id,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const animeonerId = roleId('ANIMEONER');
        await createChannel(
          '🔥・anime・öneri',
          'GUILD_TEXT',
          cat_star,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            animeonerId
              ? {
                  id: animeonerId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const desnetId = roleId('DESNET');
        await createChannel(
          '📻・desnet',
          'GUILD_TEXT',
          cat_star,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            desnetId
              ? {
                  id: desnetId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const cat_zzz = await createCategory('「ᶻᶻᶻ」');

        await createChannel(
          '🌙',
          'GUILD_TEXT',
          cat_zzz,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            memberId
              ? {
                  id: memberId,
                  allow: [
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        await createChannel(
          'process.sleep(ᶻᶻᶻ)',
          'GUILD_VOICE',
          cat_zzz,
          [
            { id: everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
            memberId
              ? {
                  id: memberId,
                  allow: [Permissions.FLAGS.VIEW_CHANNEL],
                  deny: [
                    Permissions.FLAGS.SPEAK,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ],
                }
              : null,
          ].filter(Boolean),
        );

        const createdData = {
          createdRoles,
          createdChannels,
          supportServer: supportInvite || '',
          logChannelId,
        };

        const createdPath = resolveRoot('src', 'createdChannels.json');
        try {
          fs.mkdirSync(path.dirname(createdPath), { recursive: true });
          fs.writeFileSync(
            createdPath,
            JSON.stringify(createdData, null, 2),
            'utf8',
          );
        } catch (err) {}

        const botConfig = {
          token: token,
          prefix: PROMPT_PREFIX || '',
          admins: adminIds,
          ownerId: ownerId || '',
          botname: botName || client.user.username,
          SERPER_API_KEY: PROMPT_SERPER || '',
          GROQ_API_KEY: PROMPT_GROQ_API || '',
          model: PROMPT_GROQ_MODEL || '',
          supportServer: supportInvite,
          logChannelId: logChannelId,
          debug: true,
        };

        const configPath = resolveRoot('src', 'botConfig.js');
        try {
          const configContent = `module.exports = {
  token: "${botConfig.token}",
  prefix: "${botConfig.prefix}",
  admins: ${JSON.stringify(botConfig.admins, null, 2)},
  ownerId: "${botConfig.ownerId}",
  botname: "${botConfig.botname}",
  SERPER_API_KEY: "${botConfig.SERPER_API_KEY}",
  GROQ_API_KEY: "${botConfig.GROQ_API_KEY}",
  model: "${botConfig.model}",
  supportServer: "${botConfig.supportServer}",
  logChannelId: "${botConfig.logChannelId}",
  debug: ${botConfig.debug}
};\n`;

          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          fs.writeFileSync(configPath, configContent, 'utf8');
        } catch (err) {}

        try {
          const emojisFolder = resolveRoot('src', 'emojiler');
          if (fs.existsSync(emojisFolder)) {
            fs.rmSync(emojisFolder, { recursive: true, force: true });
          }
        } catch (err) {}

        console.log('Kurulumun ilk aşaması başarıyla tamamlandı.');
        runSecondStage();
      } catch (err) {
        console.error(
          'Sunucu ayarları yapılırken kritik bir hata oluştu:',
          err,
        );
        rl.close();
        process.exit(1);
      }
    });

    client.login(token).catch((err) => {
      console.error('Bot giriş yaparken hata:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('Beklenmedik hata:', err);
    rl.close();
    process.exit(1);
  }
})();
