const fs = require('fs');
const botConfig = require('../../../botConfig.js');
const detectIssueType = require('./detectIssueType');
const makeEmbed = require('./makeEmbed');

const SPAM_PROTECT_WINDOW_MS = 10_000;
const SPAM_PROTECT_MAX = 5;
const STACK_MAX_LENGTH = 1800;
const KEEP_LOGS_LOCAL = true;

if (KEEP_LOGS_LOCAL) {
  try { if (!fs.existsSync('./logs')) fs.mkdirSync('./logs'); } catch (e) { console.error('Log klasörü oluşturulamadı', e); }
}

const recentReports = [];
function canSendReport() {
  const now = Date.now();
  for (let i = recentReports.length - 1; i >= 0; i--) if (now - recentReports[i] > SPAM_PROTECT_WINDOW_MS) recentReports.splice(i, 1);
  if (recentReports.length >= SPAM_PROTECT_MAX) return false;
  recentReports.push(now);
  return true;
}

async function reportError(client, err, context = {}) {
  try {
    if (!canSendReport()) return console.warn('[debug.js] Rapor spam koruması devrede — atlandı');

    const issue = detectIssueType(err);

    if (issue === 'RateLimit' || context.skipChannel) {
      console.warn('[debug.js] RateLimit veya skipChannel tespit edildi — kanal gönderimi atlanıyor. Lokal log tutuluyor.');
      if (KEEP_LOGS_LOCAL) {
        try {
          const stackLocal = (err && (err.stack || String(err))) || 'Yok';
          fs.appendFileSync(`./logs/error_${new Date().toISOString().slice(0,10)}.log`, `\n--- ${new Date().toISOString()} ---\n[SKIP_CHANNEL] ${issue}\n${stackLocal}\nContext: ${JSON.stringify(context)}\n`);
        } catch (e) { console.error('[debug.js] Local log yazılamadı (skip channel)', e); }
      }
      return;
    }

    const title = `Hata: ${issue}`;
    const description = `${(err && err.message) || String(err) || 'Bilinmeyen hata'}\n\nContext: ${context.note || '—'}`;

    const stack = (err && (err.stack || String(err))) || 'Yok';
    const shortStack = stack.length > STACK_MAX_LENGTH ? stack.slice(0, STACK_MAX_LENGTH) + '\n... (truncated)' : stack;

    const fields = [
      { name: 'Tip', value: issue, inline: true },
      { name: 'Node Uptime', value: `${process.uptime().toFixed(2)}s`, inline: true },
      { name: 'Bellek', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true },
      { name: 'Stack (kısa)', value: '```\n' + shortStack.replace(/```/g, "` ` `") + '\n```' },
      { name: 'Context', value: JSON.stringify({ event: context.event || 'unknown', extra: context.extra || null }, null, 2).slice(0, 1024) },
    ];

    const embed = makeEmbed(title, description, fields);

    if (KEEP_LOGS_LOCAL) {
      try {
        fs.appendFileSync(`./logs/error_${new Date().toISOString().slice(0,10)}.log`, `\n--- ${new Date().toISOString()} ---\n${issue}\n${stack}\nContext: ${JSON.stringify(context)}\n`);
      } catch (e) { console.error('Local log hatası', e); }
    }

    let channelId = botConfig && botConfig.logChannelId;
    if (!channelId) {
      console.warn('[debug.js] botConfig.logChannelId tanımlı değil. Konsola yazılıyor.');
      return console.error(stack);
    }

    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      try { channel = await client.channels.fetch(channelId); } catch (e) { console.error('[debug.js] Kanal fetch hatası', e); }
    }

    if (!channel) {
      console.warn('[debug.js] Log kanalı bulunamadı, konsola yazılıyor.');
      return console.error(stack);
    }

    try {
      await channel.send({ embeds: [embed] });
    } catch (sendErr) {
      const s = String(sendErr).toLowerCase();
      if (s.includes('rate limit') || s.includes('429') || /too many requests/.test(s)) {
        console.warn('[debug.js] Kanal gönderimi sırasında rate limit (429) alındı. Local log yazıldı ve gönderim atlandı.');
        try {
          if (KEEP_LOGS_LOCAL) fs.appendFileSync(`./logs/error_${new Date().toISOString().slice(0,10)}.log`, `\n--- ${new Date().toISOString()} ---\n[SEND_FAILED_RATE_LIMIT]\n${String(sendErr)}\nContext: ${JSON.stringify(context)}\n`);
        } catch (e) { console.error('[debug.js] Local log yazılamadı (send failed rate limit)', e); }
        return;
      }

      try {
        const text = `**${title}**\n${description}\n\n\`\`\`\n${shortStack}\n\`\`\``.slice(0, 2000);
        await channel.send({ content: text });
      } catch (finalErr) {
        console.error('[debug.js] Kanal gönderme başarısız, konsola yazılıyor.', finalErr);
      }
    }
  } catch (fatal) {
    console.error('[debug.js] Raporlama sırasında hata oluştu', fatal);
  }
}

module.exports = { reportError, KEEP_LOGS_LOCAL };
