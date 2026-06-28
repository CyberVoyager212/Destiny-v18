const fs = require('fs');
const path = require('path');
const { QuickDB } = require('quick.db');
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const botConfig = require('./src/botConfig.js');

const C_GREEN = '\x1b[32m';
const C_YELLOW = '\x1b[33m';
const C_RED = '\x1b[31m';
const C_CYAN = '\x1b[36m';
const C_RESET = '\x1b[0m';

const token = botConfig.token;
if (!token) {
  console.error('Hata: botConfig.js içinde token bulunamadı.');
  process.exit(1);
}

const dbPath = path.join(__dirname, 'src', 'json.sqlite');
const db = new QuickDB({ filePath: dbPath });

const client = new Client({
  intents: [Intents.FLAGS.GUILDS],
});
client.db = db;

const createdPath = path.join(__dirname, 'src', 'createdChannels.json');
if (!fs.existsSync(createdPath)) {
  console.error('Hata: createdChannels.json bulunamadı.');
  process.exit(1);
}

const { createdRoles, createdChannels } = JSON.parse(
  fs.readFileSync(createdPath, 'utf8'),
);

async function safeDbSet(db, key, value, label) {
  if (value === undefined) {
    console.warn(`quick.db atlandi, deger eksik: ${label}`);
    return false;
  }

  await db.set(key, value);
  return true;
}

client.once('ready', async () => {
  console.log(`${C_CYAN}Bot hazır: ${client.user.tag}${C_RESET}`);

  const prefix = botConfig.prefix || 'k!';
  const bName = botConfig.botname || client.user.username;
  const webhookName = bName.toUpperCase();
  const ownerId = botConfig.ownerId;

  for (const [guildId, guild] of client.guilds.cache) {
    const webhookAvatarPath = path.join(__dirname, 'src', 'webhook.png');
    let webhookAvatar = undefined;
    if (fs.existsSync(webhookAvatarPath)) {
      webhookAvatar = fs.readFileSync(webhookAvatarPath);
    }

    async function sendWebhookMessage(channelId, contentArr) {
      if (!channelId) return;
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return;

      try {
        const webhook = await channel.createWebhook(webhookName, {
          avatar: fs.existsSync(webhookAvatarPath) ? webhookAvatarPath : client.user.displayAvatarURL(),
        });

        for (const content of contentArr) {
          await webhook.send({ content });
        }

        await webhook.delete();
      } catch (err) {
        console.error(
          `Webhook mesajı gönderilirken hata oluştu (${channelId}):`,
          err.message,
        );
      }
    }

    await sendWebhookMessage(createdChannels['muted-only'], [
      `# \`${prefix}amute süre @kullanıcı adınız\` komutunu kullanarak muteli kalcağınız süreyi öğrenebilirsiniz`,
    ]);

    await sendWebhookMessage(createdChannels['doğrulama'], [
      `# BU KANALI GÖRÜYORSANIZ KENDİNİZİ DOĞRULAMANIZ GEREKMEKTEDİR  \`${prefix}verify\` KULLANIN\n\n*eski rollerinizi tekrar alamıcaksınız tekrar member olarak baştan başlıcaksınız*`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃staff・rules'], [
      `# ⟦*S T A F F*⟧ işte uymanız **gereken** kurallar\n\n## Genel\n*⪢* Küfür etmeyin\n*⪢* Kullanıcılara adil davranın\n*⪢* Yetkinizi kötüye kullanmayın\n*⪢* Kural ihlalini görmezden gelmeye çalışmayın\n*⪢* Ticketlar ile olabildiğince ilgilenmeye çalışın`,
      `## Yetki\n***!!▷*** **TİMEOUT CEZASI**\n\n***!▷*** *Uygulama Çeşitleri*\n - ${bName} komutlarından mute / advencedmute kullanmak\n - Kullanıcıya <@&${createdRoles['VERIFY']}> / <@&${createdRoles['MUTE']}> rolü vermek\n - Kullanıcıya discord üzerinden timeout uygulamak\n\n***!▷*** *Ceza Süreleri*\n - .\n   - Küfür / Saygısızlık \n  ↪ İlk sefer →  **uyarı**\n  ↪ İkinci ve sonraki zamanlar → **5-10 dk mute**\n  - Sohbet Kirliliği \n  ↪ İlk sefer → **uyarı**\n  ↪ İkinci ve sonraki zamanlar → **10-15 dk timeout**\n  - Yetkiliye hakaret\n  ↪ ilk sefer → **4 saat mute**\n  - Aşırı Büyük Harf\n  ↪ İlk sefer →  **uyarı**\n  ↪ İkinci ve sonraki zamanlar → **5-10 dk mute**\n  - Hafif Tartışmalar ve Ortamı Germe\n  ↪ İlk sefer →  **uyarı**\n  ↪ İkinci ve sonraki zamanlar → **1 saat mute**`,
      `***!!▷*** **KİCK CEZASI**\n\n***!▷*** *Uygulama Çeşitleri*\n - ${bName} komutlarından kick komutu kullanmak\n - Discord üzerinden atmak\n\n***!▷*** *Ceza Süreleri*\n - .\n   - Reklam / Tanıtım Yapmak\n  ↪ İlk sefer → **10-15 dk timeout**\n  ↪ İkinci ve sonraki zamanlar → **Kick**\n  - Din, Dil, Irk ve Siyaset Tartışmaları\n  ↪ İlk sefer → **1 saat timeout**\n  ↪ İkinci ve sonraki zamanlar → **Kick**\n   - İllegal / +18 İçerik Paylaşımı\n  ↪ İlk sefer → **Kick**\n  - Kişisel Verilerin Paylaşımı (Doxxing)\n  ↪ İlk sefer → **Kick**\n   - Spam / Link Paylaşımı\n  ↪ İlk sefer → **5-10 dk timeout**\n  ↪ İkinci ve sonraki zamanlar → **Kick**`,
      `***!!▷*** **BAN CEZASI**\n\n***!▷*** *Uygulama Çeşitleri*\n - ${bName} komutlarından ban invisban kullanmak\n - Discord üzerinden banlamak\n\n***!▷*** *Ceza Süreleri*\n- .\n  - İllegal / +18 İçerik Paylaşımı\n  ↪ İlk sefer → **Kick**\n  ↪ İkinci ve sonraki zamanlar → **Ban**\n  - Kişisel Verilerin Paylaşımı\n  ↪ İlk sefer → **Ban**\n  - Ağır Hakaret / Tehdit / Şantaj\n  ↪ İlk sefer → **Ban**\n  - Sunucuya Zarar Verme / Sabotaj\n  ↪ İlk sefer → **Ban**\n  - Dolandırıcılık / Sahtekarlık\n  ↪ İlk sefer → **Ban**\n\n## Görev\n\n⫸ SİZDEN YETKİLİ BİRİ SİZE BİR GÖREV VERDİĞİNDE YETKİNİZ YETİĞİNCE **REDDETMEKSİZİN** YAPIN`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃guardian・quests'], [
      `sizin göreviniz...\nartık siz bir **yönetici**siniz yani artık bir göreve sahip __değilsiniz__ alt yetkililere görev verin hiçbir işe manuel müdehale etmeyin alt yetkililerin yapmasını bekleyin yapmazlarsa yetkisini **düşürün veya alın**\n\n*Görevleriniz için teşekürler~*`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃manager・quests'], [
      `Sizlerin görevi kurallara uyup yetkililerin yetkisini nası kullandığını incelemek ve bildirmektir\n\n<@&${createdRoles['MODERATOR']}> ve <@&${createdRoles['TRIALMOD']}> yetkililerinin hata yaptığını görürseniz bu kanala fotoğraf ekleyerek bildirin\n\n<@&${createdRoles['GUIDE']}> ve <@&${createdRoles['TRIALGUIDE']}> yetkililerinin hata yaptığını görürseniz doğrudan yetkisini alın\n\nGörevini aşırı derece kötüye kullanan moderatör dahi olsa **BANLAYIN**\nörneğin birden fazla kullanıcıyı suçsuz yere spam şeklinde banlamak\n\n**Sıradaki rütbeniz GUARDİAN olacaktır**`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃mod・quests'], [
      `Sizlerin görevi kurallara uyup tüm yetkilerinizi doğru zamanda kullanarak terfi almaktır\n\n**Sıradaki rütbeniz MANAGER olacaktır**`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃trialmod・quests'], [
      `Sizlerin görevi kurallara uyup üyelere zaman aşımı ve atma gibi yetkilerinizi doğru zamanda kullanarak terfi almaktır\n\n**Sıradaki rütbeniz MODERATÖR olacaktır**`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃guide・quests'], [
      `Sizlerin görevi kurallara uyup kanalları düzenleme rolleri düzenleme üyelere timeout uygulama gibi yetkilerinizi doğru zamanda kullanarak terfi almaktır\n\n**Sıradaki rütbeniz TRİAL MODERATÖR olacaktır**`,
    ]);

    await sendWebhookMessage(createdChannels['💠┃trialguide・quests'], [
      `Sizlerin görevi kurallara uyup kanalları düzenleme rolleri düzenleme gibi yetkilerinizi doğru zamanda kullanarak terfi almaktır\n\n**Sıradaki rütbeniz GUİDE olacaktır**`,
    ]);

    await sendWebhookMessage(createdChannels[`📜・${bName}・rules`], [
      `* **Genel Saygı ve Üslup**\n↪ Sunucu içi her türlü küfür, argo, toksiklik ve saygısızlık yasaktır.\n↪ Diğer üyelere veya yetkililere karşı kışkırtıcı, iğneleyici ve kırıcı bir dil kullanılmamalıdır.\n* **Sohbet Düzeni (Spam & Caps)**\n↪ Kelimeleri veya harfleri uzatarak sohbet akışını bozmak, ard arda mesaj atmak (Spam) yasaktır.\n↪ Cümlelerin tamamını ya da büyük çoğunluğunu büyük harfle yazmak (Aşırı Caps) hoş karşılanmaz.\n* **Yasaklı Konular ve İçerikler**\n↪ Din, dil, ırk, cinsiyet ve siyaset gibi topluluğu bölebilecek hassas konularda tartışma yaratmak kesinlikle yasaktır.\n↪ İllegal, +18 (NSFW), şiddet veya kan içeren görsellerin/bağlantıların paylaşılması kesinlikle yasaktır.\n* **Reklam ve Tanıtım**\n↪ Üyelerin DM (Özel Mesaj) yoluyla ya da sunucu kanallarında izinsiz sunucu, kanal veya ürün reklamı yapması yasaktır.\n↪ Diğer platformların linkleri yalnızca ilgili kanallarda (eğer varsa) paylaşılabilir.\n* **Kişisel Verilerin Gizliliği (Doxxing)**\n↪ Herhangi bir üyenin gerçek adı, soyadı, fotoğrafı veya sosyal medya hesabı gibi kişisel bilgilerinin izinsiz paylaşılması yasaktır.\n* **Ses Kanalları ve Odalar**\n↪ Sesli kanallarda soundpad, çığlık, yüksek sesli müzik veya mikrofon patlatma gibi diğer üyeleri rahatsız edecek davranışlar yasaktır.\n* **Sunucu Düzeni ve Yetkililer**\n↪ Rolleri veya yetkilileri gereksiz yere etiketlemek (Pinglemek) yasaktır.\n↪ Sunucu kurallarında açıkça belirtilmeyen durumlarda bile, yetkililerin insiyatif alma ve topluluk huzurunu sağlama hakkı saklıdır.`,
    ]);

    await sendWebhookMessage(createdChannels['❓・i̇stek・şikayet'], [
      `# \`${prefix}bildir\` komutu __botun sahibine__ yada sunucuda var olan __admin__lerden birine botla alakalı bildirinizi gönderir.\n\n**Kullanım:**\n- **${prefix}bildir [mesaj]** yazarak bildiri oluşturursunuz.\n- Mesaj gönderilmeden önce sizden __onay__ alınır.\n- Mesajınızla beraber __fotoğraf__da gönderebilirsiniz.\n- Size __dm__ üzerinden cevap verilecektir.\n- Bu komutu başka sunuculardan __sunucuyla alakalı rapor__ için kullanmayınız\n- Bu sunucuda sunucuyla alakalı problemleriniz için komutu *__kullanabilirsiniz__*.\n- **Bu kanalda sadece bildir komutu kullanın.**`,
    ]);

    await sendWebhookMessage(createdChannels['❓・açıkla'], [
      `# \`${prefix}açıkla [komut ismi]\` kullanarak **doğrudan yapay zekadan** komutla alakalı açıklama alırsınız yapay zekayla sohbete devam __**edemezsiniz**__.`,
    ]);

    await sendWebhookMessage(createdChannels['🔥・anime・öneri'], [
      `BU KANALA ANİME İSMİ YAZARAK ANİME TAVSİYESİNDE BULUNABİLİRSİNİZ RASTGELE TAVSİYE ALMAK İÇİN <#${createdChannels['🧩・komut']}> KANALINDA \n> \`${prefix}animeöner\`\n KOMUTU KULLANABİLİRSİNİZ\nYAZDIĞINIZ ANİMEYİ SİLEREK HAVUZDAN SİLİNMESİNİ SAĞLAYABİLİRSİNİZ\nUYGUNSUZ ANİMELER ENGELENECEKTİR`,
    ]);

    await sendWebhookMessage(createdChannels['📻・desnet'], [
      `# DesNet discord __sunucular arası__ sohbet \n## \`${prefix}desnet\` ile sosyal medyanıza girebilirsiniz`,
    ]);

    await sendWebhookMessage(createdChannels['🌙'], [
      `# \`${prefix}afk [sebep]\` yazarak afk moduna girersiniz başkaları sizi etiketlerse botumuz onlara neden afk olduğunuzuda ekleyerek **söyleyecektir.**\n__*sebep opsiyoneldir*__`,
    ]);

    const engelKanalIds = [
      createdChannels['doğrulama'],
      createdChannels['muted-only'],
      createdChannels['❓・i̇stek・şikayet'],
      createdChannels['📸・foto・üret'],
      createdChannels['❓・açıkla'],
      createdChannels['⚽・connect4'],
      createdChannels['📻・desnet'],
      createdChannels['🌙'],
    ];

    for (const cid of engelKanalIds) {
      if (cid) {
        await client.db.set(`mesajEngel_${guild.id}.${cid}`, [
          '#kelime#',
          '#sayı#',
        ]);
      }
    }

    await client.db.set(`kkBehavior_guild_${guild.id}`, 'uyar_sonra_sil');

    await client.db.set(`kkRule_guild_${guild.id}`, {
      mode: 'block',
      commands: [
        'social',
        'connect4',
        'connectfour',
        'resfebe',
        'chaptcha',
        'blur',
        'avatarfusion',
        'clyde',
        'delete',
        'drake-meme',
        'eject',
        'facepalm',
        'wideavatar',
        'minecraft',
        'rip',
        'qrkodoluştur',
        'harita',
        'bildir',
        'afk',
        'desnet',
      ],
      categories: [],
    });

    const channelRules = [
      { id: createdChannels['❓・i̇stek・şikayet'], cmds: ['bildir'] },
      {
        id: createdChannels['📸・foto・üret'],
        cmds: [
          'chaptcha',
          'blur',
          'avatarfusion',
          'clyde',
          'delete',
          'drake-meme',
          'eject',
          'facepalm',
          'wideavatar',
          'minecraft',
          'rip',
          'qrkodoluştur',
          'harita',
        ],
      },
      { id: createdChannels['❓・açıkla'], cmds: ['acikla'] },
      { id: createdChannels['💯・resfebe'], cmds: ['resfebe'] },
      { id: createdChannels['⚽・connect4'], cmds: ['connectfour'] },
      { id: createdChannels['📻・desnet'], cmds: ['social'] },
      { id: createdChannels['🌙'], cmds: ['afk'] },
    ];

    for (const rule of channelRules) {
      if (rule.id) {
        await client.db.set(`kkRule_channel_${guild.id}_${rule.id}`, {
          mode: 'allow',
          commands: rule.cmds,
          categories: [],
        });
      }
    }
    const sohbetChannelId = createdChannels['💬・sohbet'];
    if (sohbetChannelId) {
      await client.db.set(`kkRule_channel_${guild.id}_${sohbetChannelId}`, {
        mode: 'all',
        commands: [],
        categories: [],
      });
    }
    const aiChatChannelId = createdChannels['🤖・ai・chat'];
    if (aiChatChannelId) {
      const channelChatKey = `ai_chat_channel_${aiChatChannelId}`;
      await client.db.set(channelChatKey, 'active');
    }
    await safeDbSet(
      client.db,
      `kelime_${guild.id}`,
      createdChannels['⭐・kelime'],
      '⭐・kelime',
    );
    await safeDbSet(
      client.db,
      `bom_${guild.id}`,
      createdChannels['💣・bom'],
      '💣・bom',
    );
    await safeDbSet(
      client.db,
      `aciklaChannel_${guild.id}`,
      createdChannels['❓・açıkla'],
      '❓・açıkla',
    );
    await safeDbSet(
      client.db,
      `ai_chat_channel_${guild.id}`,
      createdChannels['🤖・ai・chat'],
      '🤖・ai・chat',
    );
    await safeDbSet(
      client.db,
      `animeChannel_${guild.id}`,
      createdChannels['🔥・anime・öneri'],
      '🔥・anime・öneri',
    );
    if (createdChannels['➕'] && createdChannels['➕ Özel Oda Oluştur']) {
      await client.db.set(`privateses_${guild.id}`, {
        categoryId: createdChannels['➕'],
        hubId: createdChannels['➕ Özel Oda Oluştur'],
      });
    } else {
      console.warn('quick.db atlandi, ozel ses kanallari eksik.');
    }

    const sunucuLinkiId =
      createdChannels[botConfig.supportServer] ||
      createdChannels['sunucu-linki'] ||
      (botConfig.supportServer &&
        createdChannels[
          botConfig.supportServer.replace('https://discord.gg/', '')
        ]);
    if (sunucuLinkiId) {
      await client.db.set(`autoVC_${guild.id}`, {
        id: sunucuLinkiId,
        name: botConfig.supportServer || 'sunucu-linki',
      });
    }

    if (createdRoles['MEMBER'] && createdChannels['doğrulama']) {
      await client.db.set(`verify_${guild.id}`, {
        roleIDs: [createdRoles['MEMBER']],
        channelID: createdChannels['doğrulama'],
        customRoleID: createdRoles['VERIFY'],
      });
    } else {
      console.warn(
        'quick.db atlandi, verify kurulumu icin gereken rol/kanal eksik.',
      );
    }

    if (
      createdChannels['⚕️・gelen・giden'] &&
      createdRoles['MEMBER'] &&
      createdRoles['BOT']
    ) {
      await client.db.set(`welcomegoodbye_${guild.id}`, {
        incomingChannel: createdChannels['⚕️・gelen・giden'],
        outgoingChannel: createdChannels['⚕️・gelen・giden'],
        entryMessage:
          'Hoş geldin $etiket seninle $sayı kişi olduk seni davet eden $davet kişisine teşekkürler',
        exitMessage: 'Güle güle $etiket sen gidince $sayı kişi kaldık',
        otorol: {
          kullanıcı: [createdRoles['MEMBER']],
          bot: [createdRoles['BOT']],
        },
        inviteTracking: true,
        enabled: true,
      });
    } else {
      console.warn(
        'quick.db atlandi, welcome/goodbye kurulumu icin gereken idler eksik.',
      );
    }

    const ticketCh = guild.channels.cache.get(createdChannels['🎟️・ticket']);
    if (ticketCh) {
      // Ticket paneli veritabanı kaydı
      await client.db.set(`ticketPanel_${guild.id}`, {
        channelId: ticketCh.id,
        title: '🎫 Destek Paneli',
        description:
          'Aşağıdaki butona basarak yeni bir destek talebi oluşturabilirsin.',
      });

      const panelButtons = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('ticket_open')
          .setLabel('🎫 Ticket Aç')
          .setStyle('PRIMARY'),
      );

      const panelEmbed = new MessageEmbed()
        .setTitle('🎫 Destek Paneli')
        .setDescription(
          'Aşağıdaki butona basarak yeni bir destek talebi oluşturabilirsin.',
        )
        .setColor('#57F287')
        .setFooter({ text: 'Destek talebi oluşturmak için butona bas.' });

      await ticketCh.send({
        embeds: [panelEmbed],
        components: [panelButtons],
      });
    }

    const rolAlCh = guild.channels.cache.get(createdChannels['🍭・rol・al']);

    if (rolAlCh) {
      const roleGroups = [
        [
          { roleId: createdRoles['KELIME'], emoji: '⭐' },
          { roleId: createdRoles['BOM'], emoji: '💣' },
          { roleId: createdRoles['RESFEBE'], emoji: '💯' },
          { roleId: createdRoles['CONNECT4'], emoji: '🔢' },
        ],
        [
          { roleId: createdRoles['ACIKLA'], emoji: '❓' },
          { roleId: createdRoles['AICHAT'], emoji: '🤖' },
          { roleId: createdRoles['DUYURU'], emoji: '🔔' },
          { roleId: createdRoles['KURALLAR'], emoji: '📜' },
        ],
        [
          { roleId: createdRoles['BILDIR'], emoji: '🗣️' },
          { roleId: createdRoles['OZELSES'], emoji: '➕' },
          { roleId: createdRoles['GELENGIDEN'], emoji: '⚕️' },
          { roleId: createdRoles['TICKET'], emoji: '🎟️' },
        ],
        [
          { roleId: createdRoles['FOTOURET'], emoji: '📸' },
          { roleId: createdRoles['DESNET'], emoji: '📻' },
          { roleId: createdRoles['ANIMEONER'], emoji: '🔥' },
          { roleId: createdRoles['KOMUT_BAKIM'], emoji: '🛠️' },
        ],
        [
          { roleId: createdRoles['18PLUS'], emoji: '🔞' },
          { roleId: createdRoles['18'], emoji: '🧑' },
          { roleId: createdRoles['17'], emoji: '👦' },
          { roleId: createdRoles['16'], emoji: '🧒' },
          { roleId: createdRoles['15'], emoji: '👶' },
        ],
        [
          { roleId: createdRoles['ALONE'], emoji: '👤' },
          { roleId: createdRoles['COUPLED'], emoji: '👥' },
          { roleId: createdRoles['VALORANT'], emoji: '🔫' },
        ],
        [
          { roleId: createdRoles['GENSHIN'], emoji: '🗡️' },
          { roleId: createdRoles['CS'], emoji: '💣' },
          { roleId: createdRoles['MC'], emoji: '⛏️' },
          { roleId: createdRoles['ROBLOX'], emoji: '🧱' },
        ],
      ];

      for (const group of roleGroups) {
        const panelKey = `butonrol_${guild.id}_${group[0].roleId}`;
        await client.db.set(panelKey, {
          channelId: rolAlCh.id,
          pairs: group,
        });

        const embed = new MessageEmbed()
          .setTitle('🎭 Rol Alım Menüsü')
          .setDescription(
            'Aşağıdaki butonlara tıklayarak rollerini alabilirsin.',
          )
          .setColor('PURPLE');

        const row = new MessageActionRow();
        group.forEach((p) => {
          row.addComponents(
            new MessageButton()
              .setCustomId(`butonrol_${p.roleId}`)
              .setLabel(' ')
              .setEmoji(p.emoji)
              .setStyle('SECONDARY'),
          );
        });

        await rolAlCh.send({ embeds: [embed], components: [row] });
      }
    }
  }

  if (fs.existsSync(createdPath)) {
    fs.unlinkSync(createdPath);
  }

  const webhookAvatarPathEnd = path.join(__dirname, 'src', 'webhook.png');
  if (fs.existsSync(webhookAvatarPathEnd)) {
    fs.unlinkSync(webhookAvatarPathEnd);
  }

  console.log(
    `${C_GREEN}✔ Kurulum tamamlandı. quick.db atamaları ve webhook mesajları başarıyla gönderildi.${C_RESET}`
  );
  process.exit(0);
});

client.login(token);
