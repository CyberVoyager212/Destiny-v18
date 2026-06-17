const { MessageEmbed } = require('discord.js');
const emojis = require('../emoji.json');

const CONFIG = {
  FUNDS_KEY: 'borsa_funds_v1',
  SHARES_PREFIX: 'borsa_shares_',
  MONEY_PREFIX: 'money_',
  FUND_CREATE_COST: 5000000, 
  TICK_INTERVAL_MS: 5 * 60 * 1000,
  TICK_MAX_MOVE: 0.12,
};

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

function parsePercentToken(token) {
  if (!token) return null;
  const t = String(token).replace(',', '.').trim();
  const m = t.match(/-?[\d.]+/);
  if (!m) return null;
  const num = Number(m[0]);
  if (!isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
}

function parseAmountToken(token) {
  if (!token) return null;
  const t = String(token).replace(/\s+/g, '').replace(/,/g, '.').trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Math.round(Number(t));
  const m = t.match(/^(-?[\d.]+)([kKmM]|mr|MR|t|T)$/);
  if (!m) return null;
  const base = Number(m[1]);
  const suf = m[2].toUpperCase();
  if (!isFinite(base)) return null;
  let mult = 1;
  if (suf === 'K') mult = 1e3;
  else if (suf === 'M') mult = 1e6;
  else if (suf === 'MR') mult = 1e9;
  else if (suf === 'T') mult = 1e12;
  return Math.round(base * mult);
}

function formatShort(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  function pretty(v) {
    return Math.abs(v) % 1 === 0 ? String(Math.abs(v)) : Math.abs(v).toFixed(1);
  }
  if (abs >= 1e12) return sign + pretty(abs / 1e12) + 'T';
  if (abs >= 1e9) return sign + pretty(abs / 1e9) + 'MR';
  if (abs >= 1e6) return sign + pretty(abs / 1e6) + 'M';
  if (abs >= 1e3) return sign + pretty(abs / 1e3) + 'K';
  if (abs % 1 === 0) return sign + String(abs);
  return sign + abs.toFixed(2).replace(/\.00$/, '');
}

let marketTickerStarted = false;
let tickingLock = false;
let tickerHandle = null;

module.exports.help = {
  name: 'borsa',
  aliases: ['borsalar', 'borsa-v1'],
  usage: 'borsa <fon|hisse|tick> <altkomut> [args]',
  description: 'Fon yönetimi, hisse al/sat, haberler, tick başlatma',
  category: 'Ekonomi',
  cooldown: 3,
  extraFields: [
    {
      name: 'Alt Komutlar',
      value:
        '`borsa fon oluştur <Sembol> [başlangıç]`: Yeni bir yatırım fonu açar (5M TL ücret).\n' +
        '`borsa fon sat <Sembol>`: Fonu tasfiye eder ve hisse ortaklarına paylarını dağıtır.\n' +
        '`borsa fon işlem <Sembol> Mesaj ; %50 ; <koy|çek>`: Fona haber ekler, değişken pay havuzuna bakiye ekler/çeker.\n' +
        '`borsa hisse list`: Aktif fonları listeler.\n' +
        '`borsa hisse al <Sembol> %X`: Fondan belirtilen oranda hisse satın alır.\n' +
        '`borsa hisse sat <Sembol> %X`: Sahip olunan hisseyi geri satar (2% komisyon alınır).\n' +
        '`borsa hisse haberler <Sembol>`: Fonun geçmiş operasyon haberlerini listeler.\n' +
        '`borsa tick`: Piyasa fiyatlarının güncellenme döngüsünü elle tetikler/başlatır.',
      inline: false,
    },
    {
      name: 'Kısa Gösterimler',
      value:
        '• Tutar girerken `K` (bin), `M` (milyon), `MR` (milyar), `T` (trilyon) harfleri kullanılabilir. Örn: `5.1M`, `200K`.',
      inline: false,
    },
  ],
};

module.exports.execute = async (client, message, args = []) => {
  if (!client.db)
    return message.reply(
      (emojis.bot && (emojis.bot.error || '❌')) +
        ' | bi hhata oluşt~ :c client.db bulunamadı.'
    );
  const db = client.db;
  const EMOJI_ERROR = (emojis.bot && emojis.bot.error) || '❌';
  if (!args[0]) {
    return message.reply(
      `${EMOJI_ERROR} | **${message.member.displayName}**, lütfen bir alt komut belirtin~ (fon/hisse/tick/yardım)`
    );
  }
  const main = args[0].toLowerCase();

  const EMOJI_SUCCESS =
    (emojis.bot && (emojis.bot.succes || emojis.bot.success)) || '✅';

  try {
    if (['fon', 'fund'].includes(main)) return await handleFund();
    if (['hisse', 'share', 'shares'].includes(main)) return await handleShare();
    if (['tick', 'başlat', 'baslat'].includes(main)) return await handleTick();
    return await sendHelp(); 
  } catch (err) {
    console.error('borsa command error', err);
    return message.reply(
      EMOJI_ERROR +
        ' | bi hhata oluşt~ :c Konsolda detay var, geliştirici bakmalı.'
    );
  }

  async function getAllFunds() {
    return (await db.get(CONFIG.FUNDS_KEY)) || {};
  }

  async function saveAllFunds(obj) {
    await db.set(CONFIG.FUNDS_KEY, obj);
  }

  async function getFund(sym) {
    if (!sym) return null;
    const funds = await getAllFunds();
    return funds[sym.toUpperCase()] || null;
  }

  async function saveFund(sym, fund) {
    const funds = await getAllFunds();
    funds[sym.toUpperCase()] = fund;
    await saveAllFunds(funds);
  }

  async function deleteFund(sym) {
    const funds = await getAllFunds();
    delete funds[sym.toUpperCase()];
    await saveAllFunds(funds);
  }

  async function safeDbDelete(key) {
    if (typeof db.delete === 'function') return await db.delete(key);
    if (typeof db.del === 'function') return await db.del(key);
    return await db.set(key, null);
  }

  async function ensureUserMoney(userId) {
    if (client.eco && typeof client.eco.fetchMoney === 'function') {
      const m = await client.eco.fetchMoney(userId);
      return Number(m) || 0;
    }
    const key = CONFIG.MONEY_PREFIX + userId;
    const val = await db.get(key);
    if (val === null || typeof val === 'undefined') {
      await db.set(key, 0);
      return 0;
    }
    return Number(val) || 0;
  }

  async function addMoney(userId, amount) {
    const amt = Number(amount) || 0;
    if (client.eco && typeof client.eco.addMoney === 'function')
      return await client.eco.addMoney(userId, Math.round(amt));
    const key = CONFIG.MONEY_PREFIX + userId;
    const val = Math.round(Number((await db.get(key)) || 0) + amt);
    await db.set(key, val);
    return val;
  }

  async function subMoney(userId, amount) {
    const amt = Number(amount) || 0;
    if (client.eco && typeof client.eco.removeMoney === 'function')
      return await client.eco.removeMoney(userId, Math.round(amt));
    const key = CONFIG.MONEY_PREFIX + userId;
    const current = Number((await db.get(key)) || 0);
    const val = Math.max(0, Math.round(current - amt));
    await db.set(key, val);
    return val;
  }

  async function getShares(fundSym) {
    return (await db.get(CONFIG.SHARES_PREFIX + fundSym.toUpperCase())) || {};
  }

  async function saveShares(fundSym, obj) {
    await db.set(CONFIG.SHARES_PREFIX + fundSym.toUpperCase(), obj);
  }

  /* --------------------------
     UI helpers
     -------------------------- */

  function makeEmbed(options = {}) {
    const e = new MessageEmbed()
      .setColor(options.color || '#06b6d4')
      .setTitle(options.title || 'Borsa')
      .setDescription(options.description || '')
      .setTimestamp();
    if (options.fields && Array.isArray(options.fields)) {
      for (const f of options.fields)
        e.addField(f.name || '\u200b', f.value || '\u200b', !!f.inline);
    }
    if (options.footer) e.setFooter(options.footer);
    return e;
  }

  function paginateLines(lines, page = 1, perPage = 10) {
    page = Math.max(1, Math.floor(Number(page) || 1));
    const totalPages = Math.max(1, Math.ceil(lines.length / perPage));
    const start = (page - 1) * perPage;
    const pageLines = lines.slice(start, start + perPage);
    return { page, totalPages, pageLines };
  }

  /* --------------------------
     HELP (düzeltme: sendHelp tanımı burada)
     -------------------------- */
  async function sendHelp() {
    const embed = makeEmbed({
      title: 'Borsa Komutları — Yardım',
      description:
        'Fon oluşturma, hisse al/sat, haberler ve piyasa tick komutları.',
      fields: [
        {
          name: 'Fon (Yönetim)',
          value:
            '`borsa fon oluştur <Sembol> [başlangıç]` — Örnek: `borsa fon oluştur ALFA 5M` (başlangıç vermezsen varsayılan: ' +
            formatShort(CONFIG.FUND_CREATE_COST) +
            ').\n`borsa fon sat <Sembol>`\n`borsa fon işlem <Sembol> Mesaj ; %50 ; koy|çek`',
          inline: false,
        },
        {
          name: 'Hisse (Kullanıcı)',
          value:
            '`borsa hisse list [sayfa]`\n`borsa hisse al <Sembol> %?`\n`borsa hisse sat <Sembol> %?`\n`borsa hisse haberler <Sembol> [sayfa]`',
          inline: false,
        },
        {
          name: 'Tick',
          value:
            '`borsa tick` — Piyasa tick zamanlayıcısını başlatır (yetkili).',
          inline: false,
        },
        {
          name: 'Kısa gösterimler',
          value:
            'Kullanılan gösterimler: `K` (bin), `M` (milyon), `MR` (milyar), `T` (trilyon). Örn: `5.1M`, `100K`, `5MR`.',
          inline: false,
        },
      ],
      footer:
        'Örnek: borsa fon oluştur ALFA 5M — ALFA fonunu 5 milyon ile başlatır.',
    });
    return message.channel.send({ embeds: [embed] });
  }

  /* --------------------------
     Fund subcommands
     -------------------------- */

  async function handleFund() {
    const action = (args[1] || '').toLowerCase();
    if (['oluştur', 'olustur', 'create'].includes(action))
      return await fundCreate();
    if (['sat', 'sell'].includes(action)) return await fundSell();
    if (['işlem', 'islem', 'operation'].includes(action))
      return await fundOperation();
    return message.reply(
      EMOJI_ERROR + ' | Kullanım: borsa fon <oluştur|sat|işlem>'
    );
  }

  async function fundCreate() {
    const fundName = (args[2] || '').toUpperCase();
    const amtToken = args[3] || null;
    if (!fundName || !/^[A-Z0-9]{2,12}$/.test(fundName))
      return message.reply(
        EMOJI_ERROR +
          ' | bi hhata oluşt~ :c Sembol 2-12 büyük harf/numara olmalı.'
      );
    const existing = await getFund(fundName);
    if (existing) return message.reply(EMOJI_ERROR + ' | Bu fon zaten var.');

    let startAmount = CONFIG.FUND_CREATE_COST;
    if (amtToken) {
      const parsed = parseAmountToken(amtToken);
      if (parsed === null || parsed <= 0)
        return message.reply(
          EMOJI_ERROR + ' | Başlangıç miktarı hatalı. Örnek: 5M veya 5000000'
        );
      startAmount = parsed;
    }

    const balance = await ensureUserMoney(message.author.id);
    if (balance < startAmount)
      return message.reply(
        EMOJI_ERROR +
          ' | Fon oluşturmak için en az ' +
          formatShort(startAmount) +
          ' gerekli. Şu anki bakiyen: ' +
          formatShort(balance)
      );
    await subMoney(message.author.id, startAmount);

    const fund = {
      symbol: fundName,
      name: fundName + ' Fon',
      manager: message.author.id,
      managerTag: message.author.tag,
      value: Number(startAmount),
      createdAt: Date.now(),
      soldPercentAbsolute: 0,
      salePoolAbsoluteMax: 49,
      news: [],
      variable: { active: false, percentAbsolute: 0, amount: 0 },
      metadata: {},
    };
    await saveFund(fundName, fund);
    await saveShares(fundName, {});
    return message.channel.send(
      EMOJI_SUCCESS +
        ' | başarııı~ :3 Fon ' +
        fundName +
        ' oluşturuldu. Başlangıç değeri: ' +
        formatShort(fund.value)
    );
  }

  async function fundSell() {
    const fundName = (args[2] || '').toUpperCase();
    if (!fundName)
      return message.reply(EMOJI_ERROR + ' | Kullanım: borsa fon sat <FONADI>');
    const fund = await getFund(fundName);
    if (!fund) return message.reply(EMOJI_ERROR + ' | Böyle bir fon yok.');
    if (
      fund.manager !== message.author.id &&
      !(
        client.config &&
        client.config.owners &&
        client.config.owners.map(String).includes(String(message.author.id))
      )
    )
      return message.reply(EMOJI_ERROR + ' | Bu fonun yöneticisi değilsin.');
    const shares = await getShares(fundName);
    const recipients = [];
    const totalProceeds = Number(fund.value) || 0;
    const shareEntries = Object.entries(shares);
    if (shareEntries.length === 0) {
      const amountRounded = Math.round(totalProceeds);
      await addMoney(fund.manager, amountRounded);
      await deleteFund(fundName);
      await safeDbDelete(CONFIG.SHARES_PREFIX + fundName.toUpperCase());
      return message.channel.send(
        EMOJI_SUCCESS +
          ' | başarııı~ :3 Fon satıldı. Hiç hisse sahibi yoktu. Tüm tutar yöneticinin hesabına eklendi: ' +
          formatShort(amountRounded)
      );
    }
    const rawRecipients = [];
    for (const [userId, pct] of shareEntries) {
      const perc = Number(pct) || 0;
      const amount = totalProceeds * (perc / 100);
      rawRecipients.push({ id: userId, percent: perc, amount });
    }
    let sumRounded = 0;
    const roundedRecipients = [];
    for (const r of rawRecipients) {
      const rounded = Math.round(r.amount);
      sumRounded += rounded;
      roundedRecipients.push({ id: r.id, percent: r.percent, rounded });
    }
    let managerShare = Math.round(totalProceeds) - sumRounded;
    if (managerShare < 0) managerShare = 0;
    const lines = [];
    for (const r of roundedRecipients) {
      if (r.rounded > 0) {
        await addMoney(r.id, r.rounded);
        lines.push(
          `<@${r.id}> → ` +
            formatShort(r.rounded) +
            ' (' +
            r.percent.toFixed(6) +
            '%)'
        );
      } else {
        lines.push(`<@${r.id}> → 0 (${r.percent.toFixed(6)}%)`);
      }
    }
    if (managerShare > 0) {
      await addMoney(fund.manager, managerShare);
      lines.push(
        fund.managerTag + ' (yönetici) → ' + formatShort(managerShare)
      );
    }
    await deleteFund(fundName);
    await safeDbDelete(CONFIG.SHARES_PREFIX + fundName.toUpperCase());
    const embed = makeEmbed({
      title: 'Fon Satışı Detayları — ' + fundName,
      description: lines.join('\n'),
      fields: [
        { name: 'Toplam', value: formatShort(totalProceeds), inline: true },
      ],
      color: '#34d399',
      footer: 'Satış işlemi tamamlandı',
    });
    return message.channel.send({ embeds: [embed] });
  }

  async function fundOperation() {
    const fundName = (args[2] || '').toUpperCase();
    if (!fundName)
      return message.reply(
        EMOJI_ERROR +
          ' | Kullanım: borsa fon işlem <FONADI> Mesaj ; %50 ; <koy|çek>'
      );
    const fund = await getFund(fundName);
    if (!fund) return message.reply(EMOJI_ERROR + ' | Böyle bir fon yok.');
    const rest = args.slice(3).join(' ').trim();
    if (!rest)
      return message.reply(
        EMOJI_ERROR + ' | İşlem için mesaj ; %X ; işlem türü yazmalısın.'
      );
    const parts = rest
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    const newsText = parts[0] || '';
    let percentToken = parts[1] || null;
    let actionToken = parts[2] || null;

    if (newsText) {
      fund.news = fund.news || [];
      fund.news.unshift({ t: Date.now(), txt: newsText });
      if (fund.news.length > 20) fund.news.pop();
    }

    if (percentToken) {
      const pct = parsePercentToken(percentToken);
      if (pct === null)
        return message.reply(
          EMOJI_ERROR + ' | Yüzde bilgisi hatalı. Örn: %50 veya 50'
        );
      if (!actionToken)
        return message.reply(
          EMOJI_ERROR + ' | Lütfen değişken için işlem türü yaz: koy veya çek'
        );
      const action = actionToken.toLowerCase();
      if (['koy', 'koyu', 'koyulacak', 'put'].includes(action)) {
        const amount = fund.value * (pct / 100);
        fund.variable = { active: true, percentAbsolute: pct, amount: amount };
        await saveFund(fundName, fund);
        return message.channel.send(
          EMOJI_SUCCESS +
            ' | başarııı~ :3 Değişkene ' +
            formatShort(amount) +
            ' (%' +
            pct +
            ') kondu. Haber eklendi.'
        );
      }
      if (['çek', 'cek', 'withdraw'].includes(action)) {
        if (!fund.variable || !fund.variable.active)
          return message.reply(
            EMOJI_ERROR + ' | Değişkende aktif bir tutar yok.'
          );
        const withdrawPct = pct;
        const toWithdraw = fund.variable.amount * (withdrawPct / 100);
        fund.variable.amount = Math.max(0, fund.variable.amount - toWithdraw);
        if (fund.variable.amount <= 0) fund.variable.active = false;
        fund.value = Math.max(0, fund.value - toWithdraw);
        await saveFund(fundName, fund);
        await addMoney(fund.manager, Math.round(toWithdraw));
        return message.channel.send(
          EMOJI_SUCCESS +
            ' | başarııı~ :3 ' +
            formatShort(Math.round(toWithdraw)) +
            ' çekildi ve yöneticinin hesabına eklendi.'
        );
      }
      return message.reply(
        EMOJI_ERROR + ' | İşlem türü geçersiz. koy veya çek yaz.'
      );
    } else {
      await saveFund(fundName, fund);
      return message.channel.send(
        EMOJI_SUCCESS + ' | Haber eklendi, teşekkürler! 🌸'
      );
    }
  }

  /* --------------------------
     Share subcommands
     -------------------------- */

  async function handleShare() {
    const sub = (args[1] || '').toLowerCase();
    if (['list'].includes(sub) || (!sub && args[1] === undefined))
      return await sharesList();
    if (['al', 'buy'].includes(sub)) return await sharesBuy();
    if (['sat', 'sell'].includes(sub)) return await sharesSell();
    if (['haberler', 'haber', 'news'].includes(sub)) return await sharesNews();
    return message.reply(
      EMOJI_ERROR + ' | Kullanım: borsa hisse <list|al|sat|haberler>'
    );
  }

  async function sharesList() {
    const pageArg = args[2] || '1';
    const funds = await getAllFunds();
    const lines = [];
    for (const k of Object.keys(funds)) {
      const f = funds[k];
      const varActive = f.variable && f.variable.active ? ' (DEĞİŞKENDE)' : '';
      lines.push(
        '**' +
          f.symbol +
          '** — ' +
          formatShort(f.value) +
          varActive +
          ' — Yönetici: ' +
          (f.managerTag || '—')
      );
    }
    if (lines.length === 0)
      return message.channel.send(EMOJI_ERROR + ' | Hiç fon yok şu an.');

    const { page, totalPages, pageLines } = paginateLines(lines, pageArg, 10);
    const embed = makeEmbed({
      title: 'Fon Listesi',
      description: pageLines.join('\n'),
      color: '#06b6d4',
      footer: `Sayfa ${page}/${totalPages}`,
    });
    return message.channel.send({ embeds: [embed] });
  }

  async function sharesNews() {
    const fundName = (args[2] || '').toUpperCase();
    const pageArg = args[3] || '1';
    if (!fundName)
      return message.reply(
        EMOJI_ERROR + ' | Kullanım: borsa hisse haberler <FONADI> [sayfa]'
      );
    const fund = await getFund(fundName);
    if (!fund) return message.reply(EMOJI_ERROR + ' | Böyle bir fon yok.');
    const newsItems = (fund.news || []).map(
      (n) => '• ' + new Date(n.t).toLocaleString('tr-TR') + ' — ' + n.txt
    );
    if (newsItems.length === 0)
      return message.channel.send(
        EMOJI_ERROR + ' | Bu fonun henüz haberi yok.'
      );

    const { page, totalPages, pageLines } = paginateLines(
      newsItems,
      pageArg,
      10
    );
    const embed = makeEmbed({
      title: 'Haberler — ' + fundName,
      description: pageLines.join('\n'),
      color: '#a78bfa',
      footer: `Sayfa ${page}/${totalPages}`,
    });
    return message.channel.send({ embeds: [embed] });
  }

  async function sharesBuy() {
    const fundName = (args[2] || '').toUpperCase();
    const pctToken = args[3] || '';
    if (!fundName || !pctToken)
      return message.reply(
        EMOJI_ERROR +
          ' | Kullanım: borsa hisse al <FONADI> %? (örn %100 = kalan poolu al)'
      );
    const fund = await getFund(fundName);
    if (!fund) return message.reply(EMOJI_ERROR + ' | Böyle bir fon yok.');
    const pct = parsePercentToken(pctToken);
    if (pct === null)
      return message.reply(EMOJI_ERROR + ' | Yüzde bilgisi hatalı.');
    const shares = await getShares(fundName);
    const sold = Number(fund.soldPercentAbsolute) || 0;
    const poolMax = Number(fund.salePoolAbsoluteMax) || 49;
    const available = Math.max(0, poolMax - sold);
    if (available <= 0)
      return message.channel.send(
        EMOJI_ERROR + ' | Bu fonun satışa açık kısmı dolmuş.'
      );
    const wantedAbsolute = available * (pct / 100);
    const finalAbsolute = Math.min(available, wantedAbsolute);
    if (finalAbsolute <= 0)
      return message.channel.send(EMOJI_ERROR + ' | Alınacak hisse yok.');
    const cost = fund.value * (finalAbsolute / 100);
    const userMoney = await ensureUserMoney(message.author.id);
    if (userMoney < cost)
      return message.reply(
        EMOJI_ERROR +
          ' | Yetersiz bakiye. Gerekli: ' +
          formatShort(cost) +
          ' Senin: ' +
          formatShort(userMoney)
      );

    shares[message.author.id] =
      (Number(shares[message.author.id]) || 0) + finalAbsolute;
    fund.soldPercentAbsolute = +(
      Number(fund.soldPercentAbsolute) + finalAbsolute
    ).toFixed(8);

    await subMoney(message.author.id, cost);
    fund.value = Number(fund.value) + Number(cost);

    await saveShares(fundName, shares);
    await saveFund(fundName, fund);
    return message.channel.send(
      EMOJI_SUCCESS +
        ' | başarııı~ :3 ' +
        finalAbsolute.toFixed(6) +
        '% hisse alındı. Harcanan: ' +
        formatShort(cost) +
        '. Kalan pool: %' +
        Math.max(0, poolMax - fund.soldPercentAbsolute).toFixed(6)
    );
  }

  async function sharesSell() {
    const fundName = (args[2] || '').toUpperCase();
    const pctToken = args[3] || '';
    if (!fundName || !pctToken)
      return message.reply(
        EMOJI_ERROR + ' | Kullanım: borsa hisse sat <FONADI> %?'
      );
    const fund = await getFund(fundName);
    if (!fund) return message.reply(EMOJI_ERROR + ' | Böyle bir fon yok.');
    const pct = parsePercentToken(pctToken);
    if (pct === null)
      return message.reply(EMOJI_ERROR + ' | Yüzde bilgisi hatalı.');
    const shares = await getShares(fundName);
    const have = Number(shares[message.author.id] || 0);
    if (have <= 0)
      return message.channel.send(
        EMOJI_ERROR + ' | Bu fonda hisseye sahip değilsin.'
      );
    const sellAbsolute = Math.min(have, have * (pct / 100));
    if (sellAbsolute <= 0)
      return message.channel.send(EMOJI_ERROR + ' | Satılacak hisse yok.');

    const gross = fund.value * (sellAbsolute / 100);
    const fee = gross * 0.02;
    const net = gross - fee;

    shares[message.author.id] = +(have - sellAbsolute).toFixed(8);
    if (shares[message.author.id] <= 0) delete shares[message.author.id];
    fund.soldPercentAbsolute = +(
      Number(fund.soldPercentAbsolute) - sellAbsolute
    ).toFixed(8);

    fund.value = Math.max(0, Number(fund.value) - gross);

    await saveShares(fundName, shares);
    await saveFund(fundName, fund);

    const netRounded = Math.round(net);
    const feeRounded = Math.round(fee);

    await addMoney(message.author.id, netRounded);
    await addMoney(fund.manager, feeRounded);

    return message.channel.send(
      EMOJI_SUCCESS +
        ' | başarııı~ :3 ' +
        sellAbsolute.toFixed(6) +
        '% hisse satıldı. Elde edilen (kesin): ' +
        formatShort(netRounded) +
        ' (Kesinti ' +
        formatShort(feeRounded) +
        ' yöneticisine gitti.)'
    );
  }

  /* --------------------------
     Tick functions (immediate & scheduled)
     -------------------------- */

  async function handleTick() {
    const isBotOwner = (() => {
      const cfg = client.config || {};
      const ownerId = cfg.ownerId || cfg.owner || null;
      if (ownerId && String(ownerId) === String(message.author?.id))
        return true;
      if (
        Array.isArray(cfg.owners) &&
        cfg.owners.map(String).includes(String(message.author?.id))
      )
        return true;
      return false;
    })();
    const isManager = !!(
      message.member &&
      message.member.permissions &&
      message.member.permissions.has &&
      message.member.permissions.has('MANAGE_GUILD')
    );
    if (!isBotOwner && !isManager)
      return message.reply(`${EMOJI_ERROR} | Yetkin yok.`);
    if (marketTickerStarted)
      return message.channel.send(
        `${EMOJI_ERROR} | Zaten piyasa 5 dakikada bir güncelleniyor.`
      );
    await tickImmediate();
    startTicker(client, db);
    return message.channel.send(
      `${EMOJI_SUCCESS} | Piyasa zamanlayıcısı başlatıldı — her 5 dakikada bir güncellenecek.`
    );
  }

  async function applyTickToFundsObj(funds) {
    for (const k of Object.keys(funds)) {
      const f = funds[k];
      const noise =
        Math.random() * CONFIG.TICK_MAX_MOVE * 2 - CONFIG.TICK_MAX_MOVE;
      if (f.variable && f.variable.active) {
        const delta = f.variable.amount * noise * 0.01;
        f.variable.amount = Math.max(0, f.variable.amount + delta);
        f.value = Math.max(0, f.value + delta);
        const percDisplay = (noise * 100).toFixed(4);
        const signStr = delta >= 0 ? 'kazandı' : 'kaybetti';
        f.news = f.news || [];
        f.news.unshift({
          t: Date.now(),
          txt: `${f.symbol || k} değişkende %${percDisplay} ${signStr}`,
        });
        if (f.news.length > 20) f.news.pop();
        if (f.variable.amount <= 0.0001) f.variable.active = false;
      } else {
        const deltaValue = f.value * noise * 0.01;
        f.value = Math.max(0, f.value + deltaValue);
        const percDisplay = (noise * 100).toFixed(4);
        const signStr = deltaValue >= 0 ? 'kazandı' : 'kaybetti';
        f.news = f.news || [];
        f.news.unshift({
          t: Date.now(),
          txt: `${f.symbol || k} piyasa hareketi %${percDisplay} ${signStr}`,
        });
        if (f.news.length > 20) f.news.pop();
      }
      funds[k] = f;
    }
    return funds;
  }

  async function tickImmediate() {
    if (tickingLock)
      return message.channel.send(
        EMOJI_ERROR + ' | Piyasa zaten güncelleniyor, bekle lütfen.'
      );
    tickingLock = true;
    try {
      const funds = await getAllFunds();
      const updated = await applyTickToFundsObj(funds);
      await saveAllFunds(updated);
      return message.channel.send(
        EMOJI_SUCCESS + ' | Piyasa güncellendi, bi tık!'
      );
    } catch (e) {
      console.error('tickImmediate error', e);
      return message.channel.send(
        EMOJI_ERROR + ' | bi hhata oluşt~ :c Piyasa güncellenemedi.'
      );
    } finally {
      tickingLock = false;
    }
  }
};

/* --------------------------
   startTicker outside execute
   -------------------------- */

function startTicker(client, db) {
  if (marketTickerStarted) return;
  marketTickerStarted = true;
  tickerHandle = setInterval(async () => {
    if (tickingLock) return;
    tickingLock = true;
    try {
      const funds = (await db.get(CONFIG.FUNDS_KEY)) || {};
      const keys = Object.keys(funds);
      for (const k of keys) {
        const f = funds[k];
        const noise =
          Math.random() * CONFIG.TICK_MAX_MOVE * 2 - CONFIG.TICK_MAX_MOVE;
        if (f.variable && f.variable.active) {
          const delta = f.variable.amount * noise * 0.01;
          f.variable.amount = Math.max(0, f.variable.amount + delta);
          f.value = Math.max(0, f.value + delta);
          const percDisplay = (noise * 100).toFixed(4);
          const signStr = delta >= 0 ? 'kazandı' : 'kaybetti';
          f.news = f.news || [];
          f.news.unshift({
            t: Date.now(),
            txt: `${f.symbol || k} değişkende %${percDisplay} ${signStr}`,
          });
          if (f.news.length > 20) f.news.pop();
          if (f.variable.amount <= 0.0001) f.variable.active = false;
        } else {
          const deltaValue = f.value * noise * 0.01;
          f.value = Math.max(0, f.value + deltaValue);
          const percDisplay = (noise * 100).toFixed(4);
          const signStr = deltaValue >= 0 ? 'kazandı' : 'kaybetti';
          f.news = f.news || [];
          f.news.unshift({
            t: Date.now(),
            txt: `${f.symbol || k} piyasa hareketi %${percDisplay} ${signStr}`,
          });
          if (f.news.length > 20) f.news.pop();
        }
        funds[k] = f;
      }
      await db.set(CONFIG.FUNDS_KEY, funds);
    } catch (e) {
      console.error('scheduled tick error', e);
    } finally {
      tickingLock = false;
    }
  }, CONFIG.TICK_INTERVAL_MS);
}
