const emojis = require("../emoji.json");

const editState = new WeakMap();
async function safeEdit(message, payload, opts = {}) {
  const minInterval = opts.minInterval ?? 175;
  let st = editState.get(message);
  if (!st) {
    st = { lastEdit: 0, queued: null };
    editState.set(message, st);
  }

  const now = Date.now();
  const since = now - st.lastEdit;
  if (since < minInterval) {
    if (st.queued) clearTimeout(st.queued);
    st.queued = setTimeout(async () => {
      try {
        await message.edit(payload);
        st.lastEdit = Date.now();
      } catch {}
      st.queued = null;
    }, minInterval - since + 10);
    return;
  }

  try {
    await message.edit(payload);
    st.lastEdit = Date.now();
  } catch {}
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s) {
  return String(s || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

function normPlay(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function baseSequence() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}

const words = {
  tr: ["bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on"],
  en: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
  de: ["eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"],
  fr: ["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"],
};

function toRoman(n) {
  const map = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
  };
  return map[n] || String(n);
}

function toEmoji(n) {
  const map = {
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
    4: "4️⃣",
    5: "5️⃣",
    6: "6️⃣",
    7: "7️⃣",
    8: "8️⃣",
    9: "9️⃣",
    10: "🔟",
  };
  return map[n] || String(n);
}

function isNumericLike(v) {
  if (typeof v === "number" && Number.isFinite(v)) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  return /^\d+$/.test(t);
}

function toNumberLike(v, fallback) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

function upsertTransform(state, t) {
  const idx = state.transforms.findIndex((x) => x.category === t.category);
  if (idx >= 0) state.transforms.splice(idx, 1);
  state.transforms.push(t);
}

function computeSteps(state, pos) {
  const baseN = state.sequence[pos - 1] ?? pos;
  const ov = state.overrides.get(pos) || null;

  let n = baseN;
  let value = baseN;

  if (ov && ov.kind === "number") {
    n = ov.value;
    value = ov.value;
  } else if (ov && ov.kind === "text") {
    value = ov.value;
  }

  const steps = [{ label: "başlangıç", value }];

  for (const tr of state.transforms) {
    if (tr.kind === "numToWords") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        const arr = words[tr.lang] || null;
        if (arr && curNum >= 1 && curNum <= 10) value = arr[curNum - 1];
        else value = String(curNum);
        steps.push({ label: "kelime", value });
      }
      continue;
    }

    if (tr.kind === "roman") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        if (curNum >= 1 && curNum <= 10) value = toRoman(curNum);
        steps.push({ label: "romen", value });
      }
      continue;
    }

    if (tr.kind === "emoji") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        if (curNum >= 1 && curNum <= 10) value = toEmoji(curNum);
        steps.push({ label: "emoji", value });
      }
      continue;
    }

    if (tr.kind === "square") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        n = curNum * curNum;
        value = n;
        steps.push({ label: "kare", value });
      }
      continue;
    }

    if (tr.kind === "fizzbuzz") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        n = curNum;
        if (curNum % 15 === 0) value = "fizzbuzz";
        else if (curNum % 3 === 0) value = "fizz";
        else if (curNum % 5 === 0) value = "buzz";
        else value = String(curNum);
        steps.push({ label: "fizzbuzz", value });
      }
      continue;
    }

    if (tr.kind === "primeFlag") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        n = curNum;
        const primes = new Set([2, 3, 5, 7]);
        if (primes.has(curNum)) value = "asal";
        steps.push({ label: "asal", value });
      }
      continue;
    }

    if (tr.kind === "oddEvenEn") {
      if (isNumericLike(value)) {
        const curNum = toNumberLike(value, n);
        n = curNum;
        if (curNum % 2 === 1) {
          const arr = words.en;
          if (curNum >= 1 && curNum <= 10) value = arr[curNum - 1];
        }
        steps.push({ label: "tek-en", value });
      }
      continue;
    }

    if (tr.kind === "headLetter") {
      value = String(value ?? "").trim().slice(0, 1);
      steps.push({ label: "baş harf", value });
      continue;
    }

    if (tr.kind === "lastLetter") {
      const s = String(value ?? "").trim();
      value = s.slice(-1);
      steps.push({ label: "son harf", value });
      continue;
    }

    if (tr.kind === "upper") {
      value = String(value ?? "").toLocaleUpperCase("tr-TR");
      steps.push({ label: "büyük", value });
      continue;
    }

    if (tr.kind === "lower") {
      value = String(value ?? "").toLocaleLowerCase("tr-TR");
      steps.push({ label: "küçük", value });
      continue;
    }

    if (tr.kind === "reverseText") {
      value = String(value ?? "").split("").reverse().join("");
      steps.push({ label: "ters", value });
      continue;
    }
  }

  return { final: String(value), steps };
}

function expectedFor(state, pos) {
  return computeSteps(state, pos).final;
}

function explainLines(state) {
  const lines = [];
  for (let pos = 1; pos <= 10; pos++) {
    const { final, steps } = computeSteps(state, pos);
    let line = `${pos}. sırada "${final}" yazılacak`;
    if (steps.length >= 2) {
      const prev = steps[steps.length - 2]?.value;
      const prevStr = String(prev ?? "").trim();
      if (prevStr && norm(prevStr) !== norm(final)) {
        line += ` -> ${prevStr}`;
      }
    }
    lines.push(line);
  }
  return lines;
}

function prettyRuleList() {
  return [
    "1 artık 3",
    "1 artık merhaba",
    "1 ile 3 yer değiştir",
    "sayılar baştan sona",
    "sayıların ingilizcesi",
    "sayıların almancası",
    "sayıların fransızcası",
    "sayıların baş harfi",
    "son harf",
    "büyük harf",
    "küçük harf",
    "ters yaz",
    "tek sayıların ingilizcesi",
    "fizzbuzz",
    "sayıların romen rakamı",
    "sayıların emojisi",
    "sayıların karesi",
    "asal sayılar asal",
  ].join(" | ");
}

function parseRules(text) {
  const raw = String(text || "")
    .split(/[\n;]+/g)
    .flatMap((x) => x.split(/\s*,\s*/g))
    .map((x) => x.trim())
    .filter(Boolean);

  const out = [];
  for (const line of raw) {
    const t = norm(line);

    let m = t.match(/^(\d{1,2})\s+artık\s+(.+)$/i);
    if (m) {
      const pos = parseInt(m[1], 10);
      const rhs = m[2].trim();
      if (pos >= 1 && pos <= 10) {
        const rhsNum = parseInt(rhs, 10);
        if (!isNaN(rhsNum) && rhsNum >= 1 && rhsNum <= 10 && String(rhsNum) === rhs) {
          out.push({ type: "set-pos-number", pos, number: rhsNum, raw: line });
        } else {
          out.push({ type: "set-pos-literal", pos, value: rhs, raw: line });
        }
      }
      continue;
    }

    m = t.match(/^(\d{1,2})\s+ile\s+(\d{1,2})\s+yer\s+değiştir$/i);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (a >= 1 && a <= 10 && b >= 1 && b <= 10 && a !== b) {
        out.push({ type: "swap-pos", a, b, raw: line });
      }
      continue;
    }

    if (["sayılar baştan sona", "sayilar bastan sona", "ters", "tersten"].includes(t)) {
      out.push({ type: "reverse", raw: line });
      continue;
    }

    if (
      ["sayıların ingilizcesi", "sayilarin ingilizcesi", "ingilizce"].includes(t) ||
      ["sayıların english", "numbers english"].includes(t)
    ) {
      out.push({ type: "transform", kind: "numToWords", lang: "en", category: "numToWords", raw: line });
      continue;
    }
    if (["sayıların almancası", "sayilarin almancasi", "almanca"].includes(t)) {
      out.push({ type: "transform", kind: "numToWords", lang: "de", category: "numToWords", raw: line });
      continue;
    }
    if (["sayıların fransızcası", "sayilarin fransizcasi", "fransızca", "fransizca"].includes(t)) {
      out.push({ type: "transform", kind: "numToWords", lang: "fr", category: "numToWords", raw: line });
      continue;
    }
    if (["sayıların baş harfi", "sayilarin bas harfi", "baş harf", "bas harf"].includes(t)) {
      out.push({ type: "transform", kind: "headLetter", category: "headLetter", raw: line });
      continue;
    }
    if (["son harf", "sayıların son harfi", "sayilarin son harfi"].includes(t)) {
      out.push({ type: "transform", kind: "lastLetter", category: "lastLetter", raw: line });
      continue;
    }
    if (["büyük harf", "buyuk harf", "uppercase"].includes(t)) {
      out.push({ type: "transform", kind: "upper", category: "case", raw: line });
      continue;
    }
    if (["küçük harf", "kucuk harf", "lowercase"].includes(t)) {
      out.push({ type: "transform", kind: "lower", category: "case", raw: line });
      continue;
    }
    if (["ters yaz", "tersten yaz", "yazıyı ters", "yaziyi ters"].includes(t)) {
      out.push({ type: "transform", kind: "reverseText", category: "reverseText", raw: line });
      continue;
    }
    if (["tek sayıların ingilizcesi", "tek sayilarin ingilizcesi", "tek sayı ingilizce", "tek sayi ingilizce"].includes(t)) {
      out.push({ type: "transform", kind: "oddEvenEn", category: "oddEvenEn", raw: line });
      continue;
    }
    if (["fizzbuzz"].includes(t)) {
      out.push({ type: "transform", kind: "fizzbuzz", category: "fizzbuzz", raw: line });
      continue;
    }
    if (
      ["sayıların romen rakamı", "sayilarin romen rakami", "romen", "roman"].includes(t)
    ) {
      out.push({ type: "transform", kind: "roman", category: "numDisplay", raw: line });
      continue;
    }
    if (["sayıların emojisi", "sayilarin emojisi", "emoji"].includes(t)) {
      out.push({ type: "transform", kind: "emoji", category: "numDisplay", raw: line });
      continue;
    }
    if (["sayıların karesi", "sayilarin karesi", "kare"].includes(t)) {
      out.push({ type: "transform", kind: "square", category: "square", raw: line });
      continue;
    }
    if (["asal sayılar asal", "asal sayilar asal", "asal", "prime"].includes(t)) {
      out.push({ type: "transform", kind: "primeFlag", category: "primeFlag", raw: line });
      continue;
    }
  }
  return out;
}

function applyRules(state, rules) {
  const applied = [];
  const ignored = [];

  function swapOverrides(a, b) {
    const av = state.overrides.get(a);
    const bv = state.overrides.get(b);
    if (av) state.overrides.set(b, av);
    else state.overrides.delete(b);
    if (bv) state.overrides.set(a, bv);
    else state.overrides.delete(a);
  }

  for (const r of rules) {
    if (r.type === "reverse") {
      state.sequence.reverse();
      applied.push(`Sayılar tersten: 1. sırada ${state.sequence[0]}`);
      continue;
    }

    if (r.type === "swap-pos") {
      const i = r.a - 1;
      const j = r.b - 1;
      const tmp = state.sequence[i];
      state.sequence[i] = state.sequence[j];
      state.sequence[j] = tmp;
      swapOverrides(r.a, r.b);
      applied.push(`${r.a}. sıra ↔ ${r.b}. sıra değişti`);
      continue;
    }

    if (r.type === "set-pos-number") {
      state.sequence[r.pos - 1] = r.number;
      state.overrides.set(r.pos, { kind: "number", value: r.number });
      applied.push(`${r.pos}. sırada ${r.number} söylenecek`);
      continue;
    }

    if (r.type === "set-pos-literal") {
      state.overrides.set(r.pos, { kind: "text", value: r.value });
      applied.push(`${r.pos}. sırada "${r.value}" söylenecek`);
      continue;
    }

    if (r.type === "transform") {
      upsertTransform(state, r);
      const trName =
        r.kind === "numToWords"
          ? `Sayılar ${r.lang === "en" ? "ingilizce" : r.lang === "de" ? "almanca" : r.lang === "fr" ? "fransızca" : r.lang}`
          : r.kind === "headLetter"
          ? "Baş harf"
          : r.kind === "lastLetter"
          ? "Son harf"
          : r.kind === "upper"
          ? "Büyük harf"
          : r.kind === "lower"
          ? "Küçük harf"
          : r.kind === "reverseText"
          ? "Yazıyı ters çevir"
          : r.kind === "roman"
          ? "Romen rakamı"
          : r.kind === "emoji"
          ? "Emoji"
          : r.kind === "square"
          ? "Kare"
          : r.kind === "fizzbuzz"
          ? "FizzBuzz"
          : r.kind === "primeFlag"
          ? "Asal sayılar 'asal'"
          : r.kind === "oddEvenEn"
          ? "Tek sayılar ingilizce"
          : r.kind;
      applied.push(`Kural: ${trName}`);
      continue;
    }

    ignored.push(r.raw || "");
  }

  return { applied, ignored };
}

async function awaitOne(channel, filter, time) {
  const collected = await channel.awaitMessages({ filter, max: 1, time });
  if (!collected.size) return null;
  return collected.first();
}

async function endGame(bot, channelId) {
  try {
    bot.games && bot.games.delete(channelId);
  } catch {}
}

module.exports.help = {
  name: "resfebe",
  aliases: ["resf", "rf"],
  description: "Bir kullanıcıyla Resfebe (kural koymalı sayma) oyunu oynayın.",
  usage: "rf @kullanıcı",
  category: "Eğlence",
  cooldown: 5,
};

module.exports.execute = async (bot, message, args) => {
  if (!args[0]) {
    return message.channel.send(
      `${emojis.bot.error} | **${message.member.displayName}**, bir kullanıcı etiketlemelisin. Örnek: \`rf @kullanıcı\``
    );
  }

  const opponent =
    message.mentions.members.first() ||
    message.guild?.members?.cache?.get(args[0]) ||
    message.guild?.members?.cache?.find(
      (r) => r.user.username.toLowerCase() === args.join(" ").toLowerCase()
    ) ||
    message.guild?.members?.cache?.find(
      (r) => r.displayName.toLowerCase() === args.join(" ").toLowerCase()
    );

  if (!opponent) {
    return message.channel.send(`${emojis.bot.error} | Geçerli bir kullanıcı bulunamadı.`);
  }
  if (opponent.user.bot) {
    return message.channel.send(`${emojis.bot.error} | Botlarla resfebe oynayamazsınız.`);
  }
  if (opponent.id === message.author.id) {
    return message.channel.send(`${emojis.bot.error} | Kendi kendine oynayamazsın.`);
  }

  if (!bot.games) bot.games = new Map();
  const current = bot.games.get(message.channel.id);
  if (current) {
    return message.channel.send(
      `${emojis.bot.error} | Bu kanalda zaten \`${current.name}\` oyunu oynanıyor, bitmesini bekleyin.`
    );
  }

  bot.games.set(message.channel.id, { name: "resfebe", author: message.author.id, opponent: opponent.id });

  let inviteMsg = null;
  try {
    inviteMsg = await message.channel.send(
      `${opponent} **${message.member.displayName}** sana resfebe daveti gönderiyor, kabul ediyor musun? (evet/hayır)`
    );

    const acceptFilter = (res) =>
      res.author.id === opponent.id && ["evet", "hayır", "hayir"].includes(norm(res.content));
    const acceptMsg = await awaitOne(message.channel, acceptFilter, 30000);

    if (!acceptMsg) {
      await endGame(bot, message.channel.id);
      inviteMsg && inviteMsg.deletable && (await inviteMsg.delete().catch(() => {}));
      const timeoutMsg = await message.channel
        .send(`${emojis.bot.error} | Davet zaman aşımına uğradı.`)
        .catch(() => null);
      setTimeout(() => timeoutMsg && timeoutMsg.delete && timeoutMsg.delete().catch(() => {}), 6000);
      return;
    }

    const accepted = norm(acceptMsg.content) === "evet";
    acceptMsg.deletable && (await acceptMsg.delete().catch(() => {}));
    inviteMsg && inviteMsg.deletable && (await inviteMsg.delete().catch(() => {}));
    message.deletable && (await message.delete().catch(() => {}));

    if (!accepted) {
      await endGame(bot, message.channel.id);
      const rejMsg = await message.channel
        .send(`${emojis.bot.error} | Davet reddedildi.`)
        .catch(() => null);
      setTimeout(() => rejMsg && rejMsg.delete && rejMsg.delete().catch(() => {}), 6000);
      return;
    }

    const state = {
      channelId: message.channel.id,
      players: [message.member, opponent],
      sequence: baseSequence(),
      overrides: new Map(),
      transforms: [],
      round: 1,
      ruleSetterIndex: 0,
      startIndex: 0,
    };

    const statusMsg = await message.channel.send(`${emojis.bot.succes} | Oyun başladı.`);

    while (true) {
      const loser = await runCountPhase(message.channel, statusMsg, state);
      if (loser) {
        const winner = state.players.find((p) => p.id !== loser.id);
        await safeEdit(statusMsg, {
          content: `${emojis.bot.error} | ${loser} yanlış yaptı. Kazanan: ${winner}`,
        });
        await endGame(bot, message.channel.id);
        return;
      }

      const ruleSetter = state.players[state.ruleSetterIndex];
      await safeEdit(statusMsg, {
        content:
          `${ruleSetter} kural koy.\n` +
          `Birden fazla kural yazacaksan virgül, noktalı virgül veya alt satır ile ayır.\n` +
          `Örnek: \`1 artık merhaba, sayıların ingilizcesi, sayıların baş harfi\`\n` +
          `Kural örnekleri: ${prettyRuleList()}`,
      });

      const ruleMsg = await awaitOne(
        message.channel,
        (res) => res.author.id === ruleSetter.id,
        45000
      );

      if (!ruleMsg) {
        const other = state.players.find((p) => p.id !== ruleSetter.id);
        await safeEdit(statusMsg, {
          content: `${emojis.bot.error} | ${ruleSetter} kural koymadı (zaman aşımı). Kazanan: ${other}`,
        });
        await endGame(bot, message.channel.id);
        return;
      }

      ruleMsg.deletable && (await ruleMsg.delete().catch(() => {}));
      const rules = parseRules(ruleMsg.content);
      if (!rules.length) {
        await safeEdit(statusMsg, {
          content: `${emojis.bot.error} | Kural anlaşılamadı. Örnek yazımlar: ${prettyRuleList()}`,
        });
        continue;
      }

      const { applied, ignored } = applyRules(state, rules);
      const parts = [];
      if (applied.length) parts.push(applied.map((x) => `- ${x}`).join("\n"));
      if (ignored.length) parts.push(`- Anlaşılamayan: ${ignored.filter(Boolean).slice(0, 5).join(" | ")}`);
      const preview = explainLines(state).join("\n");

      await safeEdit(statusMsg, {
        content:
          `${emojis.bot.succes} | Kurallar güncellendi:\n${parts.join("\n")}\n\n` +
          `Bu turda söylenecekler:\n\`\`\`\n${preview}\n\`\`\`\n` +
          `Başlayın denilene kadar durun.`,
      });

      await delay(6000);
      await safeEdit(statusMsg, { content: `${emojis.bot.succes} | Başlayın.` });

      state.round += 1;
      state.ruleSetterIndex = state.ruleSetterIndex === 0 ? 1 : 0;
    }
  } catch (err) {
    await endGame(bot, message.channel.id);
    try {
      inviteMsg && inviteMsg.deletable && (await inviteMsg.delete().catch(() => {}));
    } catch {}
    console.error(err);
    return message.channel.send(`${emojis.bot.error} | Bir hata oluştu, lütfen tekrar dene.`);
  }
};

async function runCountPhase(channel, statusMsg, state) {
  let turnIndex = state.startIndex;

  for (let pos = 1; pos <= 10; pos++) {
    const player = state.players[turnIndex];
    const expected = expectedFor(state, pos);

    await safeEdit(statusMsg, {
      content: `Tur ${state.round} — ${pos}/10\nSıra: ${player}\nPes etmek için: \`bırak\``,
    });

    const msg = await awaitOne(
      channel,
      (res) => res.author.id === player.id,
      30000
    );

    if (!msg) return player;

    const content = normPlay(msg.content);
    msg.deletable && (await msg.delete().catch(() => {}));

    if (["bırak", "birak", "iptal", "pes"].includes(content)) {
      return player;
    }

    if (normPlay(expected) !== content) {
      return player;
    }

    await safeEdit(statusMsg, {
      content: `${emojis.bot.succes} | ${player} doğru söyledi.`,
    });

    turnIndex = turnIndex === 0 ? 1 : 0;
    await delay(350);
  }

  await safeEdit(statusMsg, { content: `${emojis.bot.succes} | 10'a kadar tamamlandı. 🎉` });
  await delay(800);
  return null;
}

