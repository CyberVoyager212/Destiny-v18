const emojis = require('../emoji.json');

function parseEscapes(text) {
  if (text === undefined || text === null) return text;
  return text
    .replace(/\\r\\n/g, '\r\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function removeCommentLines(text) {
  if (!text && text !== '') return text;
  const lines = text.split(/\r\n|\r|\n/);
  const filtered = lines.filter((ln) => !/^\s*\/\//.test(ln));
  return filtered.join('\n');
}


function rawAfterNthToken(messageContent, n) {
  if (!messageContent) return '';
  const re = /\S+/g;
  let m;
  const tokens = [];
  while ((m = re.exec(messageContent))) {
    tokens.push({ text: m[0], index: m.index });
    if (tokens.length === n) break;
  }
  if (tokens.length < n) return '';
  const start = tokens[n - 1].index + tokens[n - 1].text.length;
  let idx = start;
  while (idx < messageContent.length && /\s/.test(messageContent[idx])) idx++;
  return messageContent.slice(idx);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.execute = async (client, message, args) => {
  const subcommand = args[0];

  if (!subcommand) {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, bir alt komut seçmelisin~ (ekle, sil, düzenle, göster) :c`
    );
  }


  if (subcommand.toLowerCase() === 'ekle') {
 
    let newText = rawAfterNthToken(message.content, 2);
    newText = parseEscapes(newText).trim();
    newText = removeCommentLines(newText).trim();

    if (!newText) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, lütfen kaydetmek istediğin notu gir >///<`
      );
    }

    try {
      const existing = (await client.db.get(`note_${message.author.id}`)) || '';
      const combined = existing ? `${existing}\n${newText}` : newText;
      await client.db.set(`note_${message.author.id}`, combined);
      return message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, notun başarıyla kaydedildi! 🎉\nYeni Not:\n\`\`\`\n${combined}\n\`\`\``
      );
    } catch (error) {
      console.error('Not eklenirken hata:', error);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, uf! Not eklenirken bir sorun çıktı... tekrar dene~`
      );
    }
  }

  else if (subcommand.toLowerCase() === 'sil') {
    try {
      await client.db.delete(`note_${message.author.id}`);
      return message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, notun başarıyla silindi! ✨`
      );
    } catch (error) {
      console.error('Not silinirken hata:', error);
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, not silinirken bir hata oldu... biraz sabret >.<`
      );
    }
  }


  else if (subcommand.toLowerCase() === 'düzenle') {
    const editAction = args[1];
    if (!editAction) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, düzenleme için alt komut seç: ekle, sil, değiştir :c`
      );
    }

    let note = (await client.db.get(`note_${message.author.id}`)) || '';

    if (editAction.toLowerCase() === 'ekle') {
      let appendText = rawAfterNthToken(message.content, 3);
      appendText = parseEscapes(appendText).trim();
      appendText = removeCommentLines(appendText).trim();

      if (!appendText)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, eklemek için metin gir :c`
        );

      note = note ? `${note}\n${appendText}` : appendText;
      await client.db.set(`note_${message.author.id}`, note);
      return message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, notuna başarıyla eklendi! ✨\nYeni Not:\n\`\`\`\n${note}\n\`\`\``
      );
    }

    else if (editAction.toLowerCase() === 'sil') {
      const silTip = args[2];
      let targetRaw = rawAfterNthToken(message.content, 4);
      targetRaw = parseEscapes(targetRaw).trim();
      if (!silTip || !targetRaw)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, silmek için tür (kelime/harf) ve değer gir! >.<`
        );

      if (silTip.toLowerCase() === 'kelime') {
        const maybeIndex = parseInt(targetRaw, 10);
        if (!isNaN(maybeIndex)) {
          const idx = maybeIndex - 1;
          const words = note.split(/\s+/).filter(Boolean);
          if (idx < 0 || idx >= words.length) {
            return message.reply(
              `${emojis.bot.error} | **${message.member.displayName}**, geçersiz kelime index'i! :c`
            );
          }
          words.splice(idx, 1);
          note = words.join(' ');
        } else {
          const word = escapeRegExp(targetRaw);
          const regex = new RegExp(`\\b${word}\\b`, 'g');
          note = note
            .replace(regex, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n +/g, '\n')
            .trim();
        }
      }

      else if (silTip.toLowerCase() === 'harf') {
        const maybeIndex = parseInt(targetRaw, 10);
        if (!isNaN(maybeIndex)) {
          const idx = maybeIndex - 1;
          const chars = note.split('');
          if (idx < 0 || idx >= chars.length) {
            return message.reply(
              `${emojis.bot.error} | **${message.member.displayName}**, geçersiz harf index'i! :c`
            );
          }
          chars.splice(idx, 1);
          note = chars.join('');
        } else {
          const ch = escapeRegExp(targetRaw);
          const regex = new RegExp(ch, 'gi');
          note = note.replace(regex, '');
        }
      } else {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, geçerli tür gir: kelime veya harf :c`
        );
      }

      await client.db.set(`note_${message.author.id}`, note);
      return message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, notundan başarıyla silindi! ✨\nYeni Not:\n\`\`\`\n${note}\n\`\`\``
      );
    }

    else if (
      editAction.toLowerCase() === 'değiştir' ||
      editAction.toLowerCase() === 'degistir'
    ) {
      const degistirTip = args[2];
      const rawIndex = args[3];
      const parsedIndex = parseInt(rawIndex, 10);
      let newValueRaw = rawAfterNthToken(message.content, 5);
      newValueRaw = parseEscapes(newValueRaw).trim();
      newValueRaw = removeCommentLines(newValueRaw).trim();

      if (!degistirTip || isNaN(parsedIndex) || !newValueRaw)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, değiştir için tür, index ve yeni değer gir! >.<`
        );

      const index = parsedIndex - 1; 

      if (degistirTip.toLowerCase() === 'kelime') {
        const words = note.split(/\s+/).filter(Boolean);
        if (index < 0 || index >= words.length)
          return message.reply(
            `${emojis.bot.error} | **${message.member.displayName}**, geçersiz kelime index'i! :c`
          );
        words[index] = newValueRaw;
        note = words.join(' ');
      } else if (degistirTip.toLowerCase() === 'harf') {
        const chars = note.split('');
        if (index < 0 || index >= chars.length)
          return message.reply(
            `${emojis.bot.error} | **${message.member.displayName}**, geçersiz harf index'i! :c`
          );
        chars.splice(index, 1, ...newValueRaw.split(''));
        note = chars.join('');
      } else {
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, geçerli tür gir: kelime veya harf :c`
        );
      }

      await client.db.set(`note_${message.author.id}`, note);
      return message.reply(
        `${emojis.bot.succes} | **${message.member.displayName}**, notun başarıyla güncellendi! ✨\nYeni Not:\n\`\`\`\n${note}\n\`\`\``
      );
    } else {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, geçersiz düzenleme alt komutu! :c`
      );
    }
  }


  else if (subcommand.toLowerCase() === 'göster') {
    const note = await client.db.get(`note_${message.author.id}`);
    if (!note) {
      return message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, henüz kaydedilmiş notun yok~ >w<`
      );
    }
    return message.reply(
      `${emojis.bot.succes} | **${message.member.displayName}**, işte notun: ✨\n\`\`\`\n${note}\n\`\`\``
    );
  }

  else {
    return message.reply(
      `${emojis.bot.error} | **${message.member.displayName}**, geçersiz alt komut! (ekle, sil, düzenle, göster) :c`
    );
  }
};

exports.help = {
  name: 'not',
  aliases: ['notlar', 'kaydet'],
  usage: 'not <ekle | sil | düzenle | göster> [not]',
  description:
    "Kullanıcıların notlarını eklemelerine, silmelerine, düzenlemelerine ve görüntülemelerine olanak sağlar. Düzenle komutu 'ekle', 'sil' ve 'değiştir' alt komutlarına ayrılmıştır.",
  category: 'Araçlar',
  cooldown: 10,
};
