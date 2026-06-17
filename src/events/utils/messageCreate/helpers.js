const emojis = require('../../../emoji.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function levenshtein(a, b) {
  const dp = Array(b.length + 1)
    .fill(null)
    .map((_, i) => [i]);
  dp[0] = Array(a.length + 1)
    .fill(0)
    .map((_, j) => j);
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] =
        b[i - 1] === a[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
    }
  }
  return dp[b.length][a.length];
}

function splitDiscordMessage(text, maxLen = 1900) {
  const parts = [];
  let buffer = '';
  let inCode = false;
  const lines = String(text ?? '').split('\n');
  for (const line of lines) {
    const toggles = (line.match(/```/g) || []).length;
    const next = buffer.length ? buffer + '\n' + line : line;
    if (next.length > maxLen) {
      if (buffer) {
        if (inCode) buffer += '\n```';
        parts.push(buffer);
        buffer = inCode ? '```' + line : line;
      } else {
        parts.push(next.slice(0, maxLen));
        buffer = next.slice(maxLen);
      }
    } else {
      buffer = next;
    }
    if (toggles % 2 === 1) inCode = !inCode;
  }
  if (buffer) {
    if (inCode) buffer += '\n```';
    parts.push(buffer);
  }
  return parts;
}

async function sendTemporaryNotice(
  channel,
  content,
  { lockKey = null, deleteAfterMs = 5000 } = {},
) {
  if (lockKey) {
    if (!global.autoModNoticeLocks) global.autoModNoticeLocks = new Map();
    if (global.autoModNoticeLocks.has(lockKey)) return null;
    global.autoModNoticeLocks.set(lockKey, true);
  }

  const sent = await channel.send(content).catch(() => null);

  setTimeout(() => {
    if (sent) sent.delete().catch(() => {});
    if (lockKey && global.autoModNoticeLocks) {
      global.autoModNoticeLocks.delete(lockKey);
    }
  }, deleteAfterMs);

  return sent;
}

async function sendWithTyping(channel, content, { replyTo } = {}) {
  await channel.sendTyping().catch(() => {});
  const typingTimer = setInterval(
    () => channel.sendTyping().catch(() => {}),
    8000,
  );
  try {
    const chunks = splitDiscordMessage(content);
    if (replyTo) {
      await replyTo.reply(chunks[0]);
    } else {
      await channel.send(chunks[0]);
    }
    for (let i = 1; i < chunks.length; i++) {
      await delay(400);
      await channel.send(chunks[i]);
    }
  } finally {
    clearInterval(typingTimer);
  }
}

function isUrl(text) {
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/i;
  return urlRegex.test(text);
}

function isInvite(text) {
  const inviteRegex =
    /(discord\.gg|discordapp\.com\/invite|discord.com\/invite)\/[A-Za-z0-9]+/i;
  return inviteRegex.test(text);
}

function countEmojis(text) {
  const custom = (text.match(/<a?:\w+:\d+>/g) || []).length;
  const unicode = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
  return custom + unicode;
}

function capsPercent(text) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (!letters.length) return 0;
  const uppers = letters.replace(/[^A-Z]/g, '').length;
  return Math.round((uppers / letters.length) * 100);
}

function chooseEmoji(amount) {
  if (amount > 100000) return emojis.money.high;
  if (amount > 10000) return emojis.money.medium;
  return emojis.money.low;
}

module.exports = {
  delay,
  levenshtein,
  splitDiscordMessage,
  sendTemporaryNotice,
  sendWithTyping,
  isUrl,
  isInvite,
  countEmojis,
  capsPercent,
  chooseEmoji,
};
