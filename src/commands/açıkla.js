const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { MessageEmbed } = require('discord.js');
const botConfig = require('../botConfig.js');
const emojis = require('../emoji.json');

exports.help = {
  name: 'acikla',
  aliases: ['açıkla'],
  usage: 'acikla ayarla #kanal | acikla <komutismi>',
  description:
    'Belirtilen komutun nasıl kullanılacağını kısa şekilde açıklar, sadece ayarlanmış kanalda çalışır.',
  category: 'Yapay Zeka',
  cooldown: 5,
};

exports.execute = async (client, message, args) => {
  try {
    if (!message.guild) {
      await message.reply(
        `${emojis.bot.error} | Üzgünüm~ bu komut sadece sunucularda kullanılır, ne yazık ki burada değil qwq〜`,
      );
      return;
    }

    const sub = args[0] ? args[0].toLowerCase() : null;

    if (sub === 'ayarla') {
      if (!message.member.permissions.has('ADMINISTRATOR')) {
        await message.reply(
          `${emojis.bot.error} | Yetkin yetmiyo senin, sadece sunucu yöneticisi ayarlayabilir desu〜`,
        );
        return;
      }
      const ch =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[1]);
      if (!ch) {
        await message.reply(
          `${emojis.bot.error} | Lütfen bir kanal etiketle veya kanal idsi ver watashi〜 örn: acikla ayarla #genel`,
        );
        return;
      }
      await client.db.set(`aciklaChannel_${message.guild.id}`, ch.id);
      await message.reply(
        `${emojis.bot.succes} | Tamamdır~ artık \`${exports.help.name}\` komutu sadece ${ch} kanalında kullanılabilir desu〜`,
      );
      return;
    }

    const allowedChannelId = await client.db.get(
      `aciklaChannel_${message.guild.id}`,
    );
    if (!allowedChannelId) {
      await message.reply(
        `${emojis.bot.error} | Açıklama kanalı henüz ayarlanmadı nyaa~ sunucu yöneticin \`acikla ayarla #kanal\` ile ayarlayabilir.`,
      );
      return;
    }
    if (message.channel.id !== allowedChannelId) {
      const ch = message.guild.channels.cache.get(allowedChannelId);
      await message.reply(
        `${emojis.bot.error} | Bu komut sadece ${
          ch ? `${ch}` : 'ayarlanmış kanalda'
        } kullanılabilir, burası değil desu〜`,
      );
      return;
    }

    const targetName = args[0];
    if (!targetName) {
      await message.reply(
        `${emojis.bot.error} | Hangi komutu açıklamamı istiyorsun? örn: \`${exports.help.name} ping\` lütfen komut adını yaz watashi〜`,
      );
      return;
    }

    const findCommand = (name) => {
      const c =
        client.commands.get(name) ||
        client.commands.find(
          (cmd) =>
            cmd.help &&
            Array.isArray(cmd.help.aliases) &&
            cmd.help.aliases.includes(name),
        );
      return c || null;
    };

    const targetCmd = findCommand(targetName);
    if (!targetCmd) {
      await message.reply(
        `${emojis.bot.error} | Böyle bir komut bulunamadı desu〜 komut adını kontrol et watashi〜`,
      );
      return;
    }

    const requiredPerms =
      targetCmd.help && Array.isArray(targetCmd.help.permissions)
        ? targetCmd.help.permissions
        : [];
    if (requiredPerms.length) {
      try {
        if (!message.member.permissions.has(requiredPerms)) {
          await message.reply(
            `${emojis.bot.error} | Bu komutu zaten kullanamazsınız, yetki eksik desu〜`,
          );
          return;
        }
      } catch (e) {
        await message.reply(
          `${emojis.bot.error} | Yetki kontrolü yapılamadı ama devam etmeyeceğim desu〜`,
        );
        return;
      }
    }

    let codeToSend = null;
    const tryReadFile = async (names) => {
      for (const n of names) {
        const filePath = path.join(__dirname, '..', 'commands', `${n}.js`);
        try {
          const stat = await fs.stat(filePath).catch(() => null);
          if (!stat) continue;
          const content = await fs.readFile(filePath, { encoding: 'utf8' });
          const m = content.match(
            /exports\.execute\s*=\s*async\s*\([\s\S]*?\)\s*=>\s*{([\s\S]*)}\s*;?/,
          );
          if (m) {
            return content.substring(content.indexOf('exports.execute'));
          } else {
            return content;
          }
        } catch (e) {
          continue;
        }
      }
      return null;
    };

    const candidateFiles = [];
    if (targetCmd.help && targetCmd.help.name)
      candidateFiles.push(targetCmd.help.name);
    if (targetCmd.help && Array.isArray(targetCmd.help.aliases))
      candidateFiles.push(...targetCmd.help.aliases);
    const fileContent = await tryReadFile(candidateFiles);
    if (fileContent) {
      codeToSend = fileContent;
    } else {
      try {
        if (typeof targetCmd.execute === 'function') {
          codeToSend = targetCmd.execute.toString();
        } else {
          codeToSend = '[kod bulunamıyor]';
        }
      } catch (e) {
        codeToSend = '[kod okunamadı]';
      }
    }

    const aiHelper = require('../utils/aiHelper');
    const userPrompt = `Aşağıdaki Discord komutunun "exports.execute" (ve varsa ilgili yardımcı kod parçacıklarını) içeriğini oku ve kullanıcının bu komutu nasıl kullanacağını sadece kısa ve net şekilde, anime tarzında Türkçe olarak yaz. Çok uzun yazma, yalnızca "nasıl kullanılır" kısmını açıkla. ekstra bilgi ekleme. Eğer gelen açıklama 2000 karakterden fazlaysa parçala. Komut kodu aşağıda:\n\n${codeToSend}`;

    const aiRes = await aiHelper.requestAI(client, message, {
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 800,
    });

    if (!aiRes.allowed) {
      const warnMsg = await message.reply(aiRes.reason);
      setTimeout(() => {
        message.delete().catch(() => {});
        if (warnMsg) warnMsg.delete().catch(() => {});
      }, 5000);
      return;
    }

    const replyText = aiRes.text;
    const chunks = [];
    const limit = 2000;
    for (let i = 0; i < replyText.length; i += limit) {
      chunks.push(replyText.slice(i, i + limit));
    }

    for (const c of chunks) {
      await message.channel.send(c);
    }
  } catch (err) {
    console.error('acikla hata:', err);
    try {
      await message.reply(
        `${emojis.bot.error} | Beklenmeyen bir hata oluştu desu〜 yöneticiye bakmasını söyle watashi〜`,
      );
    } catch {}
  }
};
