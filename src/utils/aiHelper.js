const { QuickDB } = require('quick.db');
const axios = require('axios');
const botConfig = require('../botConfig.js');
const emojis = require('../emoji.json');

const db = new QuickDB();
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const groqLastCall = { time: 0 };
const GROQ_MIN_INTERVAL_MS = 900;

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Checks if a user is VIP.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function getVipStatus(userId) {
  const vips = (await db.get('vips')) || {};
  const vipData = vips[userId];
  const isVip = vipData && vipData.expiresAt > Date.now();
  return !!isVip;
}

const LIMITS = {
  normal: {
    maxTokens: 5,
    refreshIntervalMs: 3 * 60 * 1000,
    minuteLimit: 3,
    dailyLimit: 20,
  },
  vip: {
    maxTokens: 20,
    refreshIntervalMs: 60 * 1000,
    minuteLimit: 10,
    dailyLimit: 100,
  },
};

/**
 * Checks daily, minute and token limits and consumes 1 token if allowed.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function checkAndConsumeToken(userId, username = 'Kullanıcı') {
  const isVip = await getVipStatus(userId);
  const config = isVip ? LIMITS.vip : LIMITS.normal;
  const now = Date.now();
  const aiEmoji = emojis.money?.AI || '🪙';

  let requests = (await db.get(`ai_requests.${userId}`)) || [];
  if (!Array.isArray(requests)) requests = [];

  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  requests = requests.filter((t) => t > oneDayAgo);

  if (requests.length >= config.dailyLimit) {
    const oldestRequest = Math.min(...requests);
    const targetEpoch = Math.floor(
      (oldestRequest + 24 * 60 * 60 * 1000) / 1000,
    );
    return {
      allowed: false,
      reason: `${emojis.bot.error} | **${username}**, yapay zeka günlük kullanım limitine ulaştın! Kalan: 0 ${aiEmoji}. Yeni kullanım hakkı kazanmak için <t:${targetEpoch}:R> beklemelisin.`,
      tokens: 0,
      maxTokens: config.maxTokens,
      isVip,
    };
  }

  const oneMinuteAgo = now - 60 * 1000;
  const requestsLastMinute = requests.filter((t) => t > oneMinuteAgo);
  if (requestsLastMinute.length >= config.minuteLimit) {
    const oldestInMin = Math.min(...requestsLastMinute);
    const targetEpoch = Math.floor((oldestInMin + 60 * 1000) / 1000);
    return {
      allowed: false,
      reason: `${emojis.bot.error} | **${username}**, yapay zeka dakikalık kullanım limitine ulaştın! Kalan: 0 ${aiEmoji}. Yeni kullanım hakkı kazanmak için <t:${targetEpoch}:R> beklemelisin.`,
      tokens: 0,
      maxTokens: config.maxTokens,
      isVip,
    };
  }

  let tokenData = await db.get(`ai_tokens.${userId}`);
  if (!tokenData) {
    tokenData = {
      tokens: config.maxTokens,
      lastRefreshed: now,
    };
  } else {
    const timePassed = now - tokenData.lastRefreshed;
    if (timePassed > 0) {
      const tokensToAdd = Math.floor(timePassed / config.refreshIntervalMs);
      if (tokensToAdd > 0) {
        tokenData.tokens = Math.min(
          config.maxTokens,
          tokenData.tokens + tokensToAdd,
        );
        tokenData.lastRefreshed =
          tokenData.lastRefreshed + tokensToAdd * config.refreshIntervalMs;
      }
    }
  }

  if (tokenData.tokens <= 0) {
    const nextTokenMs =
      config.refreshIntervalMs - (now - tokenData.lastRefreshed);
    const targetEpoch = Math.floor((now + nextTokenMs) / 1000);
    return {
      allowed: false,
      reason: `${emojis.bot.error} | **${username}**, yapay zeka kullanım limitine ulaştın! Kalan: 0 ${aiEmoji}. Yeni kullanım hakkı kazanmak için <t:${targetEpoch}:R> beklemelisin.`,
      tokens: 0,
      maxTokens: config.maxTokens,
      nextTokenSec: Math.ceil(nextTokenMs / 1000),
      isVip,
    };
  }

  tokenData.tokens -= 1;
  if (tokenData.tokens === config.maxTokens - 1) {
    tokenData.lastRefreshed = now;
  }

  requests.push(now);

  await db.set(`ai_tokens.${userId}`, tokenData);
  await db.set(`ai_requests.${userId}`, requests);

  return {
    allowed: true,
    tokens: tokenData.tokens,
    maxTokens: config.maxTokens,
    isVip,
  };
}

/**
 * Refunds a token and removes the last request timestamp.
 * @param {string} userId
 */
async function refundToken(userId) {
  const isVip = await getVipStatus(userId);
  const config = isVip ? LIMITS.vip : LIMITS.normal;

  let tokenData = await db.get(`ai_tokens.${userId}`);
  if (tokenData) {
    tokenData.tokens = Math.min(config.maxTokens, tokenData.tokens + 1);
    await db.set(`ai_tokens.${userId}`, tokenData);
  }

  let requests = (await db.get(`ai_requests.${userId}`)) || [];
  if (Array.isArray(requests) && requests.length > 0) {
    requests.pop();
    await db.set(`ai_requests.${userId}`, requests);
  }
}

/**
 * Returns the current token and rate limit status without consuming.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getTokenStatus(userId) {
  const isVip = await getVipStatus(userId);
  const config = isVip ? LIMITS.vip : LIMITS.normal;
  const now = Date.now();

  let tokenData = await db.get(`ai_tokens.${userId}`);
  if (!tokenData) {
    tokenData = { tokens: config.maxTokens, lastRefreshed: now };
  } else {
    const timePassed = now - tokenData.lastRefreshed;
    if (timePassed > 0) {
      const tokensToAdd = Math.floor(timePassed / config.refreshIntervalMs);
      if (tokensToAdd > 0) {
        tokenData.tokens = Math.min(
          config.maxTokens,
          tokenData.tokens + tokensToAdd,
        );
        tokenData.lastRefreshed =
          tokenData.lastRefreshed + tokensToAdd * config.refreshIntervalMs;
      }
    }
  }

  const nextTokenSec =
    tokenData.tokens >= config.maxTokens
      ? 0
      : Math.ceil(
          (config.refreshIntervalMs - (now - tokenData.lastRefreshed)) / 1000,
        );

  let requests = (await db.get(`ai_requests.${userId}`)) || [];
  if (!Array.isArray(requests)) requests = [];

  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const dailyRequests = requests.filter((t) => t > oneDayAgo);

  const oneMinuteAgo = now - 60 * 1000;
  const minuteRequests = requests.filter((t) => t > oneMinuteAgo);

  return {
    tokens: tokenData.tokens,
    maxTokens: config.maxTokens,
    nextTokenSec,
    dailyUsage: dailyRequests.length,
    dailyLimit: config.dailyLimit,
    minuteUsage: minuteRequests.length,
    minuteLimit: config.minuteLimit,
    isVip,
  };
}

/**
 * Centrally performs HTTP request to OpenRouter API (acting as the consolidated "curl").
 * @param {string} apiKey
 * @param {Array} messages
 * @param {string} model
 * @param {object} customOptions
 * @returns {Promise<object>}
 */
async function fetchChatFromGroq(
  apiKey,
  messages,
  model = botConfig.model,
  customOptions = {},
) {
  if (!apiKey) throw new Error('Groq API anahtarı yok.');

  const now = Date.now();
  const elapsed = now - (groqLastCall.time || 0);
  if (elapsed < GROQ_MIN_INTERVAL_MS) {
    await sleep(GROQ_MIN_INTERVAL_MS - elapsed);
  }
  groqLastCall.time = Date.now();

  const payload = {
    model,
    messages,
    max_tokens: customOptions.max_tokens || 1200,
    temperature: customOptions.temperature ?? 0.7,
  };

  const res = await axios.post(GROQ_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: customOptions.timeout || 40000,
  });

  const data = res.data;
  const choice = data?.choices && data.choices[0] ? data.choices[0] : null;
  const candidateMsg = choice?.message ?? choice;

  const extractFrom = (obj) => {
    if (!obj && obj !== '') return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
      return obj
        .map((c) => {
          if (typeof c === 'string') return c;
          if (typeof c === 'object' && c !== null) {
            return (
              c.text ??
              c.content ??
              (Array.isArray(c.parts) ? c.parts.join('') : null) ??
              JSON.stringify(c)
            );
          }
          return String(c);
        })
        .join('\n')
        .trim();
    }
    if (typeof obj === 'object') {
      if (typeof obj.content === 'string') return obj.content;
      if (Array.isArray(obj.content)) return extractFrom(obj.content);
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.output_text === 'string') return obj.output_text;
      if (typeof obj.payload === 'string') return obj.payload;
      if (Array.isArray(obj.parts)) return obj.parts.join('');
      if (obj[0]) return extractFrom(obj[0]);
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'string' && obj[k].length > 0) return obj[k];
        if (Array.isArray(obj[k]) && obj[k].every((x) => typeof x === 'string'))
          return obj[k].join('');
      }
      return JSON.stringify(obj);
    }
    return null;
  };

  let content =
    extractFrom(candidateMsg) ||
    extractFrom(choice?.text) ||
    extractFrom(data?.output) ||
    extractFrom(data?.response) ||
    extractFrom(data);

  if (content && typeof content === 'string') {
    content = content.trim();
  } else {
    content = 'AI yanıtı alınamadı.';
  }

  let suggestions = [];
  try {
    let match = content.match(/```json\s*([\s\S]*?)```/i);
    let parsed = null;
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch (e) {
        const cleaned = match[1].replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
        parsed = JSON.parse(cleaned);
      }
    } else {
      const jsonMatch = content.match(/(\{[\s\S]*"suggestions"[\s\S]*?\})/i);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      }
    }
    if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions;
      content = content.replace(/```json[\s\S]*?```/i, '').trim();
      content = content
        .replace(/(\{[\s\S]*"suggestions"[\s\S]*?\})/i, '')
        .trim();
    }
  } catch (e) {}

  return { text: String(content).trim(), suggestions };
}

/**
 * Handles full AI request cycle: Token limits, VIP adjustments, centralized API request, ads and response signatures.
 * @param {object} client
 * @param {object} messageOrInteraction
 * @param {object} options
 * @returns {Promise<object>}
 */
async function requestAI(client, messageOrInteraction, options = {}) {
  const isInteraction = !messageOrInteraction.author;
  const user = isInteraction
    ? messageOrInteraction.user
    : messageOrInteraction.author;
  const userId = user.id;

  const tokenCheck = await checkAndConsumeToken(userId, user.username);
  if (!tokenCheck.allowed) {
    return { allowed: false, reason: tokenCheck.reason };
  }

  let messages = [...(options.messages || [])];
  const isVip = tokenCheck.isVip;

  if (isVip && !options.skipVipNotice) {
    const systemIndex = messages.findIndex((m) => m.role === 'system');
    const vipNotice = `\n[SİSTEM NOTU: Karşındaki kullanıcı bir VIP üyedir. Ona son derece seçkin davran, arada ismiyle hitap et ve VIP statüsüne uygun özel/saygılı cümleler kur.]`;
    if (systemIndex !== -1) {
      messages[systemIndex].content += vipNotice;
    } else {
      messages.unshift({ role: 'system', content: vipNotice });
    }
  }

  const apiKey =
    client.config?.GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    botConfig.GROQ_API_KEY;
  const model = options.model || botConfig.model;

  let result;
  try {
    result = await fetchChatFromGroq(apiKey, messages, model, options);
  } catch (err) {
    await refundToken(userId);
    throw err;
  }

  if (isVip) {
  } else {
    const vipAd = require('./vipAd');
    if (messageOrInteraction.channel) {
      vipAd.sendAd(messageOrInteraction);
    }
  }

  return {
    allowed: true,
    text: result.text,
    suggestions: result.suggestions,
    tokensLeft: tokenCheck.tokens,
    maxTokens: tokenCheck.maxTokens,
    isVip,
  };
}

module.exports = {
  getVipStatus,
  checkAndConsumeToken,
  refundToken,
  getTokenStatus,
  fetchChatFromGroq,
  requestAI,
};
