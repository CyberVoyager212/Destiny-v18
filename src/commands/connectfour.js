const { Client, Message, MessageEmbed } = require("discord.js");
const fs = require("fs");
const path = require("path");
const emojis = require('../emoji.json');const defaultP1Color = "🔴";
const defaultP2Color = "🟡";
const defaultBg = "⚪";
const defaultDecor = null;
const defaultNums = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const defaultMsg = "{winner} harika bir stratejiyle oyunu kazandı! 🏆";

const difficultyRewards = {
  "basit": { win: 40, lose: 10 },
  "kolay": { win: 80, lose: 15 },
  "normal": { win: 130, lose: 25 },
  "zor": { win: 220, lose: 40 },
  "imkansız": { win: 400, lose: 60 }
};
const pvpReward = { win: 180, lose: 30, tie: 50 };

const catalog = {
  colors: [
    { id: "r1", emoji: "🟠", price: 60, name: "Neon Turuncu" },
    { id: "r2", emoji: "🟢", price: 120, name: "Asit Yeşili" },
    { id: "r3", emoji: "🔵", price: 180, name: "Kutup Mavisi" },
    { id: "r4", emoji: "🟣", price: 240, name: "Plazma Moru" },
    { id: "r5", emoji: "⚫", price: 300, name: "Karanlık Madde" },
    { id: "r6", emoji: "🤎", price: 350, name: "Çikolata Küresi" },
    { id: "r7", emoji: "❤️", price: 400, name: "Kuşanmış Aşk (Kalp)" },
    { id: "r8", emoji: "🧡", price: 450, name: "Ateş Kalbi" },
    { id: "r9", emoji: "💛", price: 500, name: "Güneş Kalbi" },
    { id: "r10", emoji: "💚", price: 550, name: "Doğa Kalbi" },
    { id: "r11", emoji: "💙", price: 600, name: "Okyanus Kalbi" },
    { id: "r12", emoji: "💜", price: 700, name: "Galaksi Kalbi" },
    { id: "r13", emoji: "🖤", price: 850, name: "Asil Siyah Kalp" },
    { id: "r14", emoji: "💖", price: 1100, name: "Işıltılı Elmas Kalp" },
    { id: "r15", emoji: "💗", price: 1300, name: "Atan Hibrit Kalp" },
    { id: "r16", emoji: "💘", price: 1600, name: "Eros'un Oku" },
    { id: "r17", emoji: "🧿", price: 1800, name: "Nazar Boncuğu" },
    { id: "r18", emoji: "🪙", price: 2000, name: "Altın Sikke" },
    { id: "r19", emoji: "🍩", price: 2200, name: "Tatlı Donut" },
    { id: "r20", emoji: "🍪", price: 2400, name: "Çikolatalı Kurabiye" },
    { id: "r21", emoji: "🍔", price: 2600, name: "Tombul Burger" },
    { id: "r22", emoji: "🥎", price: 2800, name: "Tenis Topu" },
    { id: "r23", emoji: "🏀", price: 3000, name: "Basketbol Topu" },
    { id: "r24", emoji: "🎱", price: 3200, name: "Kara 8 Numara" },
    { id: "r25", emoji: "🧶", price: 3500, name: "Kedi Yumağı" },
    { id: "r26", emoji: "🔮", price: 4000, name: "Kahin Küresi" },
    { id: "r27", emoji: "🪐", price: 4500, name: "Satürn Gezegeni" },
    { id: "r28", emoji: "👑", price: 5000, name: "Kraliyet Tacı" },
    { id: "r29", emoji: "💀", price: 6000, name: "Korsan Kurukafa" },
    { id: "r30", emoji: "🐉", price: 7500, name: "Ejderha Yumurtası" }
  ],
  backgrounds: [
    { id: "a1", emoji: "🟦", price: 120, name: "Siber Mavi Hücre" },
    { id: "a2", emoji: "🟪", price: 180, name: "Neon Mor Matris" },
    { id: "a3", emoji: "🟩", price: 240, name: "Zümrüt Ağ" },
    { id: "a4", emoji: "⬛", price: 300, name: "Kozmik Boşluk" },
    { id: "a5", emoji: "🧱", price: 380, name: "Antik Tuğla Örgü" },
    { id: "a6", emoji: "🌲", price: 450, name: "Kayıp Orman Labirenti" },
    { id: "a7", emoji: "☁️", price: 550, name: "Mistik Bulut Katmanı" },
    { id: "a8", emoji: "🔥", price: 700, name: "Yeraltı Magma Odası" },
    { id: "a9", emoji: "❄️", price: 850, name: "Sibirya Permafrostu" },
    { id: "a10", emoji: "🌸", price: 1000, name: "Sakura Yaprakları" },
    { id: "a11", emoji: "✨", price: 1250, name: "Yıldız Tozu Parıltısı" },
    { id: "a12", emoji: "🌌", price: 1600, name: "Karanlık Nebula" },
    { id: "a13", emoji: "🌊", price: 1900, name: "Pasifik Dalgaları" },
    { id: "a14", emoji: "🕸️", price: 2200, name: "Zehirli Örümcek Ağı" },
    { id: "a15", emoji: "🩸", price: 2500, name: "Kanlı Arenanın Zihni" },
    { id: "a16", emoji: "🍯", price: 2800, name: "Sonsuz Bal Peteği" },
    { id: "a17", emoji: "🛸", price: 3200, name: "UFO İstilası" },
    { id: "a18", emoji: "⚡", price: 3600, name: "Fırtınalı Gökler" },
    { id: "a19", emoji: "🍀", price: 4000, name: "Şanslı Yonca Bahçesi" },
    { id: "a20", emoji: "🧿", price: 4500, name: "Kem Göz Koruyucu" },
    { id: "a21", emoji: "💎", price: 5500, name: "Saf Elmas Duvarı" },
    { id: "a22", emoji: "💠", price: 6500, name: "Kutsal Boyut Portalı" }
  ],
  decorations: [ 
    { id: "d1", emoji: "🟫", price: 200, name: "Tahta Çerçeve" },
    { id: "d2", emoji: "⬜", price: 300, name: "Saf Beyaz Çerçeve" },
    { id: "d3", emoji: "🪨", price: 450, name: "Taş Kale Surları" },
    { id: "d4", emoji: "🧊", price: 600, name: "Buzdan Duvarlar" },
    { id: "d5", emoji: "🌿", price: 800, name: "Orman Sarmaşığı" },
    { id: "d6", emoji: "⛓️", price: 1000, name: "Çelik Zincirler" },
    { id: "d7", emoji: "🚧", price: 1200, name: "İnşaat Şeridi" },
    { id: "d8", emoji: "🎀", price: 1500, name: "Pembe Kurdele" },
    { id: "d9", emoji: "🎁", price: 1800, name: "Hediye Paketi Kenarı" },
    { id: "d10", emoji: "🩸", price: 2200, name: "Kan İzli Duvar" },
    { id: "d11", emoji: "🔥", price: 2600, name: "Alevden Halka" },
    { id: "d12", emoji: "☠️", price: 3000, name: "Ölümcül Sınır" },
    { id: "d13", emoji: "🛡️", price: 3500, name: "Şövalye Kalkanları" },
    { id: "d14", emoji: "⚜️", price: 4200, name: "Kraliyet İşlemesi" },
    { id: "d15", emoji: "🌟", price: 5000, name: "Yıldızlı Gece Çerçevesi" },
    { id: "d16", emoji: "👑", price: 6500, name: "İmparator Tacı Şeridi" }
  ],
  numbers: [ 
    { id: "n1", array: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤"], price: 500, name: "Gökkuşağı Daireleri" },
    { id: "n2", array: ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫"], price: 700, name: "Kare Renk Paleti" },
    { id: "n3", array: ["🍎", "🍊", "🍋", "🍏", "🫐", "🍇", "🍉"], price: 1000, name: "Manav Reyonu" },
    { id: "n4", array: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻"], price: 1300, name: "Hayvanat Bahçesi" },
    { id: "n5", array: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓"], price: 1600, name: "Otopark" },
    { id: "n6", array: ["🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖"], price: 2000, name: "Zamanın Akışı" },
    { id: "n7", array: ["♈", "♉", "♊", "♋", "♌", "♍", "♎"], price: 2500, name: "Zodyak İşaretleri" },
    { id: "n8", array: ["🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓"], price: 3200, name: "Ay Fazları" },
    { id: "n9", array: ["🗡️", "🏹", "🛡️", "⚔️", "🔪", "🔫", "🧨"], price: 4000, name: "Savaş Cephaneliği" },
    { id: "n10", array: ["🌍", "🌎", "🌏", "🌕", "☀️", "🪐", "🌌"], price: 5000, name: "Evrenin Derinlikleri" }
  ],
  messages: [
    { id: "m1", text: "⚡ {winner} kusursuz bir zeka şovuyla masayı dağıttı!", price: 120 },
    { id: "m2", text: "👑 {winner} hamlesiyle oyunun tek hükümdarı olduğunu kanıtladı!", price: 180 },
    { id: "m3", text: "🏆 {winner} Connect4 tarihine adını altın harflerle yazdırdı!", price: 250 },
    { id: "m4", text: "🔥 {winner} taktiksel dehasıyla ortalığı küle çevirdi!", price: 320 },
    { id: "m5", text: "🎯 {winner} rakibinin tüm açıklarını yakalayıp tam on ikiden vurdu!", price: 400 },
    { id: "m6", text: "🧠 {winner} adeta bir satranç ustası gibi 4 adım sonrasını gördü!", price: 480 },
    { id: "m7", text: "☄️ {winner} masaya göktaşı gibi düşerek galibiyeti söktü aldı!", price: 550 },
    { id: "m8", text: "💎 {winner} kusursuz elmas değerinde bir performans sergiledi!", price: 620 },
    { id: "m9", text: "🌪️ {winner} fırtınası karşısında rakibi ayakta kalamadı!", price: 700 },
    { id: "m10", text: "🔮 {winner} adeta geleceği okuyarak tüm hamleleri kilitledi!", price: 800 },
    { id: "m11", text: "🚀 {winner} galibiyet roketini ateşleyerek zirveye tırmandı!", price: 900 },
    { id: "m12", text: "⚔️ {winner} kılıcını çekti ve rakiplerine diz çöktürdü!", price: 1000 },
    { id: "m13", text: "🌌 {winner} boyutlar arası bir oyun sergileyerek galip geldi!", price: 1100 },
    { id: "m14", text: "🎭 {winner} adeta izleyicilere unutulmaz bir tiyatro sundu!", price: 1200 },
    { id: "m15", text: "💯 {winner} hata payı olmadan %100 kusursuz bir galibiyet aldı!", price: 1350 },
    { id: "m16", text: "🐉 {winner} ejderha nefesiyle stratejileri eritti ve kazandı!", price: 1500 },
    { id: "m17", text: "🛡️ {winner} aşılmaz savunmasıyla rakibini çaresiz bıraktı!", price: 1650 },
    { id: "m18", text: "✨ 𝕲𝖆𝖑𝖆𝖝𝖞 𝕮𝖍𝖆𝖒𝖕𝖎𝖔𝖓! {winner} evrenin en güçlü taktiğini uyguladı! ✨", price: 1800 },
    { id: "m19", text: "💫 𝔐𝔶𝔰𝔱𝔦𝔠 𝔙𝔦𝔠𝔱𝔬𝔯𝔶! {winner} büyüleyici bir oyunla zaferi mühürledi! 💫", price: 2000 },
    { id: "m20", text: "🔱 𝕰𝖋𝖘𝖆𝖓𝖊𝖛𝖎 𝕴𝖒𝖕𝖆𝖗𝖆𝖙𝖔𝖗! {winner} adını tarihin en tepesine kazıdı! 🔱", price: 2500 },
    { id: "m21", text: "👹 {winner} içindeki canavarı serbest bıraktı ve tahtı ele geçirdi!", price: 2700 },
    { id: "m22", text: "🌌 𝕮𝖔𝖘𝖒𝖎𝖈 𝕲𝖔𝖉! {winner} Connect4 evreninin yeni tanrısı ilan edildi! 🌌", price: 3500 },
    { id: "m23", text: "🎭 Gölgelerin Efendisi {winner}, rakibini sessizce alt etti!", price: 4000 },
    { id: "m24", text: "💀 {winner} acımadı, rakibinin oyun sonu ekranını getirdi!", price: 4500 },
    { id: "m25", text: "👑 Connect4'ün Yüce Kralı {winner} tahtına tekrar oturdu!", price: 5500 }
  ]
};

async function getUser(db, id) {
  let data = await db.get(`c4_user_${id}`);
  if (!data) {
    data = {
      points: 0,
      inventory: { colors: [], backgrounds: [], messages: [], decorations: [], numbers: [] },
      equipped: { color: null, background: null, message: null, decoration: null, number: null },
      customName: null
    };
  } else {
    if (!data.inventory) data.inventory = { colors: [], backgrounds: [], messages: [], decorations: [], numbers: [] };
    if (!data.inventory.colors) data.inventory.colors = [];
    if (!data.inventory.backgrounds) data.inventory.backgrounds = [];
    if (!data.inventory.messages) data.inventory.messages = [];
    if (!data.inventory.decorations) data.inventory.decorations = [];
    if (!data.inventory.numbers) data.inventory.numbers = [];
    
    if (!data.equipped) data.equipped = { color: null, background: null, message: null, decoration: null, number: null };
    if (data.equipped.decoration === undefined) data.equipped.decoration = null;
    if (data.equipped.number === undefined) data.equipped.number = null;
  }
  return data;
}

async function updateUser(db, id, newData) {
  await db.set(`c4_user_${id}`, newData);
}


function findItemById(id) {
  let item = catalog.colors.find(i => i.id === id); if (item) return { ...item, type: 'color' };
  item = catalog.backgrounds.find(i => i.id === id); if (item) return { ...item, type: 'background' };
  item = catalog.messages.find(i => i.id === id); if (item) return { ...item, type: 'message' };
  item = catalog.decorations.find(i => i.id === id); if (item) return { ...item, type: 'decoration' };
  item = catalog.numbers.find(i => i.id === id); if (item) return { ...item, type: 'number' };
  return null;
}


function getPageEmbed(title, items, pageNum, type) {
  const itemsPerPage = 20;
  const totalPages = Math.ceil(items.length / itemsPerPage) || 1;
  let page = Math.max(1, Math.min(pageNum, totalPages));
  
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = items.slice(start, end);

  let desc = "";
  if (type === "message") {
    desc = pageItems.map(m => `\`${m.id}\` | ${m.text.replace("{winner}", "Kazanan")} - **${m.price}** 💰`).join("\n");
  } else if (type === "number") {
    desc = pageItems.map(i => `\`${i.id}\` | ${i.array.join("")} ${i.name} - **${i.price}** 💰`).join("\n");
  } else {
    desc = pageItems.map(i => `\`${i.id}\` | ${i.emoji} ${i.name} - **${i.price}** 💰`).join("\n");
  }

  return new MessageEmbed()
    .setTitle(title)
    .setColor("#7289DA")
    .setDescription(desc || "Bu sayfada eşya bulunmuyor.")
    .setFooter({ text: `Sayfa ${page}/${totalPages} | Satın almak için: c4 market al <id>` });
}


function getPlayerMention(user, dbInfo) {
  if (dbInfo && dbInfo.customName) {
    return `**${dbInfo.customName}**`; 
  }
  return user.toString(); 
}

function displayBoard(board, p1Color, p2Color, bg, decorEmoji, numArr) {
  let rows = board.map(row => row.map(piece => piece === "user" ? p1Color : piece === "oppo" ? p2Color : bg).join(""));
  let boardStr = "";
  let numsStr = numArr.join("");
  
  if (decorEmoji) {
    let topBottom = decorEmoji.repeat(9); 
    boardStr += topBottom + "\n";
    boardStr += rows.map(r => decorEmoji + r + decorEmoji).join("\n") + "\n";
    boardStr += decorEmoji + numsStr + decorEmoji + "\n";
    boardStr += topBottom;
  } else {
    boardStr += rows.join("\n") + "\n" + numsStr;
  }
  return boardStr;
}

function checkWin(board) {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (c + 3 < 7 && checkLine(board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3])) return true;
      if (r + 3 < 6 && checkLine(board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c])) return true;
      if (r + 3 < 6 && c + 3 < 7 && checkLine(board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3])) return true;
      if (r - 3 >= 0 && c + 3 < 7 && checkLine(board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3])) return true;
    }
  }
  return false;
}
function checkLine(a, b, c, d) { return a !== null && a === b && a === c && a === d; }


module.exports.help = {
  name: "connectfour",
  aliases: ["connect4", "c4"],
  description: "Connect Four (Dört Bağlantı) oyunu ve devasa kozmetik marketi.",
  usage: "c4 [@kullanıcı / market <kategori> <sayfa>]",
  category: "Eğlence",
  cooldown: 3,
};

module.exports.execute = async (bot, message, args) => {
  

  if (args[0] && args[0].toLowerCase() === "market") {
    let userDb = await getUser(bot.db, message.author.id);
    const subCommand = args[1] ? args[1].toLowerCase() : null;
    const pageArg = parseInt(args[2], 10) || 1;

    if (!subCommand) {
      const embed = new MessageEmbed()
        .setTitle("🛒 C4 Büyük Çarşı & Premium Market")
        .setColor("#FFD700")
        .setDescription(`Mevcut Bakiyen: **${userDb.points} 💰**\n\n**Market Kataloglarını Gez:**\n\`c4 market renk [sayfa]\` - Premium Toplar\n\`c4 market arkaplan [sayfa]\` - Tahta Arkaplanları\n\`c4 market mesaj [sayfa]\` - Özel Kazanma Yazıları\n\`c4 market dekor [sayfa]\` - Tahta Çerçeveleri (YENİ)\n\`c4 market sayi [sayfa]\` - Alt Yönlendiriciler (YENİ)\n\n**İşlemler:**\n🛒 Eşya Satın Al: \`c4 market al <id>\`\n✨ Eşya Kuşan: \`c4 market kusan <id>\`\n🏷️ Özel İsim Hakkı: \`c4 market isim <yeni_isim>\` *(Harf başı 50 💰)*\n🔄 Sıfırla: \`c4 market sifirla\``);
      return message.channel.send({ embeds: [embed] });
    }

    if (["renk", "renkler", "top"].includes(subCommand)) {
      return message.channel.send({ embeds: [getPageEmbed("🎨 Premium Top & Kalp Çeşitleri", catalog.colors, pageArg, "color")] });
    }
    if (["arkaplan", "bg", "arkaplanlar"].includes(subCommand)) {
      return message.channel.send({ embeds: [getPageEmbed("🖼️ Estetik Çerçeve & Arkaplanlar", catalog.backgrounds, pageArg, "background")] });
    }
    if (["mesaj", "mesajlar"].includes(subCommand)) {
      return message.channel.send({ embeds: [getPageEmbed("🎉 Görkemli Zafer Kutlama Mesajları", catalog.messages, pageArg, "message")] });
    }
    if (["dekor", "cerceve", "dekorasyon"].includes(subCommand)) {
      return message.channel.send({ embeds: [getPageEmbed("🚧 Özel Tahta Çerçeveleri", catalog.decorations, pageArg, "decoration")] });
    }
    if (["sayi", "sayilar", "yonlendirici"].includes(subCommand)) {
      return message.channel.send({ embeds: [getPageEmbed("🔢 Alt Sayı & Yönlendiriciler", catalog.numbers, pageArg, "number")] });
    }

    if (subCommand === "al") {
      const itemId = args[2];
      if (!itemId) return message.channel.send(`${emojis.bot.error} | Satın almak istediğin eşyanın ID'sini girmelisin. Örnek: \`c4 market al r14\``);
      const item = findItemById(itemId.toLowerCase());
      if (!item) return message.channel.send(`${emojis.bot.error} | Geçersiz ID. Böyle bir ürün bulunamadı.`);
      
      let typeMap = { color: 'colors', background: 'backgrounds', message: 'messages', decoration: 'decorations', number: 'numbers' };
      if (userDb.inventory[typeMap[item.type]].includes(item.id)) return message.channel.send(`${emojis.bot.error} | Bu eşyaya zaten sahipsin!`);
      if (userDb.points < item.price) return message.channel.send(`${emojis.bot.error} | Yetersiz bakiye! Gerekli: **${item.price} 💰**, Sende Olan: **${userDb.points} 💰**`);

      userDb.points -= item.price;
      userDb.inventory[typeMap[item.type]].push(item.id);
      await updateUser(bot.db, message.author.id, userDb);
      return message.channel.send(`${emojis.bot.succes} | **${item.name || "Kutlama Mesajı"}** başarıyla envanterine eklendi! Kuşanmak için: \`c4 market kusan ${item.id}\``);
    }

    if (subCommand === "kusan") {
      const itemId = args[2];
      if (!itemId) return message.channel.send(`${emojis.bot.error} | Kuşanmak istediğin eşyanın ID'sini belirtmelisin.`);
      const item = findItemById(itemId.toLowerCase());
      if (!item) return message.channel.send(`${emojis.bot.error} | Geçersiz ID. Böyle bir ürün bulunamadı.`);

      let typeMap = { color: 'colors', background: 'backgrounds', message: 'messages', decoration: 'decorations', number: 'numbers' };
      if (!userDb.inventory[typeMap[item.type]].includes(item.id)) return message.channel.send(`${emojis.bot.error} | Sahip olmadığın bir eşyayı kuşanamazsın!`);

      userDb.equipped[item.type] = item.id;
      await updateUser(bot.db, message.author.id, userDb);
      return message.channel.send(`${emojis.bot.succes} | **${item.name || "Kutlama Mesajı"}** başarıyla aktif edildi! Oyunlarında sergilenecek.`);
    }

    if (subCommand === "isim") {
      const newName = args.slice(2).join(" ");
      if (!newName) return message.channel.send(`${emojis.bot.error} | Bir isim girmelisin. Örnek: \`c4 market isim 𝕾𝖍𝖆𝖉𝖔𝖜\``);
      if (newName.length > 20) return message.channel.send(`${emojis.bot.error} | Özel isim en fazla 20 karakter olabilir.`);
      
      const cost = newName.length * 50;
      if (userDb.points < cost) return message.channel.send(`${emojis.bot.error} | Yetersiz bakiye! Bu isim karakter uzunluğundan dolayı **${cost} 💰** gerektiriyor. Sende: **${userDb.points} 💰** var.`);
      
      userDb.points -= cost;
      userDb.customName = newName;
      await updateUser(bot.db, message.author.id, userDb);
      return message.channel.send(`${emojis.bot.succes} | Oyun içi takma adın başarıyla **${newName}** olarak güncellendi! Hesabından **${cost} 💰** düşüldü. Artık oyunlarda etiketlenmeyeceksin.`);
    }

    if (subCommand === "sifirla") {
      userDb.equipped = { color: null, background: null, message: null, decoration: null, number: null };
      userDb.customName = null;
      await updateUser(bot.db, message.author.id, userDb);
      return message.channel.send(`${emojis.bot.succes} | Tüm özelleştirmelerin (Çerçeve, Numaralar, Toplar vb.) kaldırıldı, varsayılan ayarlara dönüldü ve ismin sıfırlandı.`);
    }

    return message.channel.send(`${emojis.bot.error} | Bilinmeyen market komutu. Yardım için: \`c4 market\` yazabilirsin.`);
  }


  let opponent = message.mentions.members.first();
  let againstBot = false;
  let difficulty = "normal";

  if (!opponent) {
    againstBot = true;
    if (!args[0] || !["basit", "kolay", "normal", "zor", "imkansız"].includes(args[0].toLowerCase())) {
      return message.channel.send(`${emojis.bot.error} | Hey, bot ile kapışmak istiyorsan zorluk seviyesi seçmelisin! Örnek: \`c4 imkansız\`\n*(Seçenekler: basit, kolay, normal, zor, imkansız)*`);
    }
    difficulty = args[0].toLowerCase();
    opponent = bot.user;
  }

  if (opponent.user && opponent.user.bot && !againstBot) return message.channel.send(`${emojis.bot.error} | Gerçek bir kullanıcı yerine bot etiketlediniz, botla oynamak için \`c4 zor\` gibi doğrudan zorluk belirtin.`);
  if (opponent.user && opponent.user.id === message.author.id) return message.channel.send(`${emojis.bot.error} | Kendine meydan okuyamazsın, yalnız mısın? Arkadaş etiketle!`);

  if (!bot.games) bot.games = new Map();  
  const currentGame = bot.games.get(message.channel.id);
  if (currentGame) return message.channel.send(`${emojis.bot.error} | Bu kanalda halihazırda oynanan bir oyun var. Lütfen onun bitmesini bekle!`);

  bot.games.set(message.channel.id, { name: "connectfour" });

  const p1Data = await getUser(bot.db, message.author.id);
  const p2Data = againstBot ? null : await getUser(bot.db, opponent.id || opponent.user.id);

  let p1ColorObj = p1Data.equipped.color ? catalog.colors.find(c => c.id === p1Data.equipped.color) : null;
  let p1BgObj = p1Data.equipped.background ? catalog.backgrounds.find(b => b.id === p1Data.equipped.background) : null;
  let p1DecorObj = p1Data.equipped.decoration ? catalog.decorations.find(d => d.id === p1Data.equipped.decoration) : null;
  let p1NumObj = p1Data.equipped.number ? catalog.numbers.find(n => n.id === p1Data.equipped.number) : null;

  let p1ColorEmoji = p1ColorObj ? p1ColorObj.emoji : defaultP1Color;
  let p2ColorEmoji = defaultP2Color;
  let activeBgEmoji = defaultBg;
  let activeDecorEmoji = defaultDecor;
  let activeNums = defaultNums;

  if (againstBot) {
    const availableColors = catalog.colors.filter(c => c.emoji !== p1ColorEmoji);
    p2ColorEmoji = availableColors[Math.floor(Math.random() * availableColors.length)].emoji;
    
    activeBgEmoji = p1BgObj ? p1BgObj.emoji : defaultBg;
    activeDecorEmoji = p1DecorObj ? p1DecorObj.emoji : defaultDecor;
    activeNums = p1NumObj ? p1NumObj.array : defaultNums;

  } else {
    let p2ColorObj = p2Data.equipped.color ? catalog.colors.find(c => c.id === p2Data.equipped.color) : null;
    let p2BgObj = p2Data.equipped.background ? catalog.backgrounds.find(b => b.id === p2Data.equipped.background) : null;
    let p2DecorObj = p2Data.equipped.decoration ? catalog.decorations.find(d => d.id === p2Data.equipped.decoration) : null;
    let p2NumObj = p2Data.equipped.number ? catalog.numbers.find(n => n.id === p2Data.equipped.number) : null;
    
    p2ColorEmoji = p2ColorObj ? p2ColorObj.emoji : defaultP2Color;
    
    if (p1ColorEmoji === p2ColorEmoji) {
      p1ColorEmoji = defaultP1Color;
      p2ColorEmoji = defaultP2Color;
    }
    
    if (p1BgObj && p2BgObj) activeBgEmoji = (p1BgObj.price >= p2BgObj.price) ? p1BgObj.emoji : p2BgObj.emoji;
    else if (p1BgObj) activeBgEmoji = p1BgObj.emoji;
    else if (p2BgObj) activeBgEmoji = p2BgObj.emoji;

    if (p1DecorObj && p2DecorObj) activeDecorEmoji = (p1DecorObj.price >= p2DecorObj.price) ? p1DecorObj.emoji : p2DecorObj.emoji;
    else if (p1DecorObj) activeDecorEmoji = p1DecorObj.emoji;
    else if (p2DecorObj) activeDecorEmoji = p2DecorObj.emoji;

    if (p1NumObj && p2NumObj) activeNums = (p1NumObj.price >= p2NumObj.price) ? p1NumObj.array : p2NumObj.array;
    else if (p1NumObj) activeNums = p1NumObj.array;
    else if (p2NumObj) activeNums = p2NumObj.array;
  }

  let board = Array(6).fill(null).map(() => Array(7).fill(null));
  let userTurn = true;
  let winner = null;
  const colLevels = [5, 5, 5, 5, 5, 5, 5];


  const renderBoardText = (currentUser) => {
    let p1Name = p1Data.customName ? `**${p1Data.customName}**` : message.author.username;
    let p2Name = againstBot ? `**Bot (${difficulty.toUpperCase()})**` : (p2Data.customName ? `**${p2Data.customName}**` : opponent.user.username);
    
    let turnMention = "";
    if (currentUser.id === message.author.id) {
        turnMention = getPlayerMention(message.author, p1Data);
    } else {
        turnMention = againstBot ? `**Bot (${difficulty.toUpperCase()})**` : getPlayerMention(opponent.user || opponent, p2Data); 
    }

    const boardVisual = displayBoard(board, p1ColorEmoji, p2ColorEmoji, activeBgEmoji, activeDecorEmoji, activeNums);

    return `🎮 **CONNECT FOUR TURNUVASI**\n🔴 **P1:** ${p1Name} | 🟡 **P2:** ${p2Name}\n\nSıra Sende: ${turnMention} ~ Sütun Seç (1-7):\n\n${boardVisual}`;
  };

  let gameMsg = await message.channel.send(renderBoardText(message.author));

  while (!winner && board.some((row) => row.includes(null))) {
    const user = userTurn ? message.author : opponent;
    const sign = userTurn ? "user" : "oppo";

    await gameMsg.edit(renderBoardText(user));

    let choice;

    if (againstBot && !userTurn) {
      if (difficulty === "basit") choice = getSimpleMove(colLevels);
      else if (difficulty === "kolay") choice = getRandomMove(colLevels);
      else if (difficulty === "normal") choice = getSmartMove(board, colLevels);
      else if (difficulty === "zor") choice = getBestMove(board, colLevels);
      else choice = getImpossibleMove(board, colLevels); 
      
      await new Promise(r => setTimeout(r, 1200));
    } else {
      const filter = (res) => res.author.id === user.id && /^[1-7]$/.test(res.content);
      const turn = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });

      if (!turn.size) {
        winner = userTurn ? opponent : message.author;
        let timeoutMention = getPlayerMention(user, userTurn ? p1Data : p2Data);
        await message.channel.send(`⏱️ Süre doldu! Hızlı karar veremeyen ${timeoutMention} hükmen kaybetti.`);
        break;
      }

      turn.first().delete().catch(() => {});
      choice = parseInt(turn.first().content, 10) - 1;

      if (colLevels[choice] < 0) {
        let warnMsg = await message.channel.send(`${emojis.bot.error} | O sütun tamamen dolu! Lütfen başka bir sütun seç.`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 2500);
        continue;
      }
    }

    board[colLevels[choice]][choice] = sign;
    colLevels[choice] -= 1;

    if (checkWin(board)) {
      winner = user;
      break;
    }
    userTurn = !userTurn;
  }

  bot.games.delete(message.channel.id);
  const finalBoardVisual = displayBoard(board, p1ColorEmoji, p2ColorEmoji, activeBgEmoji, activeDecorEmoji, activeNums);


  if (winner) {
    if (againstBot) {
      let playerDb = await getUser(bot.db, message.author.id);
      
      if (winner.id === message.author.id) {
        let reward = difficultyRewards[difficulty].win;
        playerDb.points += reward;
        await updateUser(bot.db, message.author.id, playerDb);

        let customMsgId = playerDb.equipped.message;
        let customMsgObj = customMsgId ? catalog.messages.find(m => m.id === customMsgId) : null;
        let templateText = customMsgObj ? customMsgObj.text : defaultMsg;
        let finalWinnerName = playerDb.customName ? `**${playerDb.customName}**` : message.author.toString();
        let renderedWinText = templateText.replace(/{winner}/g, finalWinnerName);

        await gameMsg.edit(`🎉 **ZAFER!**\n\n${renderedWinText}\n**${difficulty.toUpperCase()}** zorluğundaki botu devirdin ve **+${reward} 💰** kazandın!\n\n${finalBoardVisual}`);
      } else {
        let penalty = difficultyRewards[difficulty].lose;
        playerDb.points = Math.max(0, playerDb.points - penalty);
        await updateUser(bot.db, message.author.id, playerDb);
        let finalLoserName = playerDb.customName ? `**${playerDb.customName}**` : message.author.toString();

        await gameMsg.edit(`🤖 **SİSTEM KAZANDI!**\n\nAcımasız Bot, ${finalLoserName} kullanıcısını mağlup etti! **${difficulty.toUpperCase()}** zorluğuna yenildin ve **-${penalty} 💰** kaybettin.\n\n${finalBoardVisual}`);
      }
    } else {
      let winDb = await getUser(bot.db, winner.id);
      let loseId = (winner.id === message.author.id) ? opponent.id : message.author.id;
      let loseDb = await getUser(bot.db, loseId);

      let customMsgId = winDb.equipped.message;
      let customMsgObj = customMsgId ? catalog.messages.find(m => m.id === customMsgId) : null;
      let templateText = customMsgObj ? customMsgObj.text : defaultMsg;
      
      let finalWinnerName = winDb.customName ? `**${winDb.customName}**` : winner.toString();
      let renderedWinText = templateText.replace(/{winner}/g, finalWinnerName);

      winDb.points += pvpReward.win;
      loseDb.points += pvpReward.lose; 

      await updateUser(bot.db, winner.id, winDb);
      await updateUser(bot.db, loseId, loseDb);

      await gameMsg.edit(`👑 **MAÇ SONUCU**\n\n${renderedWinText}\n(+${pvpReward.win} 💰)\nKaybeden oyuncu teselli ödülü aldı (+${pvpReward.lose} 💰).\n\n${finalBoardVisual}`);
    }
  } else {
    if (againstBot) {
      let playerDb = await getUser(bot.db, message.author.id);
      playerDb.points += 20;
      await updateUser(bot.db, message.author.id, playerDb);
    } else {
      let p1 = await getUser(bot.db, message.author.id);
      let p2 = await getUser(bot.db, opponent.id || opponent.user.id);
      p1.points += pvpReward.tie;
      p2.points += pvpReward.tie;
      await updateUser(bot.db, message.author.id, p1);
      await updateUser(bot.db, opponent.id || opponent.user.id, p2);
    }
    await gameMsg.edit(`🤝 **BERABERLİK!**\n\nKimse üstünlük kuramadı. İki tarafa da beraberlik puanları dağıtıldı.\n\n${finalBoardVisual}`);
  }
};


function getSimpleMove(colLevels) { 
  return colLevels.findIndex((level) => level >= 0); 
}

function getRandomMove(colLevels) {
  let availableCols = colLevels.map((level, index) => (level >= 0 ? index : -1)).filter((index) => index !== -1);
  return availableCols[Math.floor(Math.random() * availableCols.length)];
}

function getSmartMove(board, colLevels) {
  for (let i = 0; i < 7; i++) {
    if (colLevels[i] >= 0) {
      let tempBoard = JSON.parse(JSON.stringify(board));
      tempBoard[colLevels[i]][i] = "oppo";
      if (checkWin(tempBoard)) return i;
    }
  }
  return getRandomMove(colLevels);
}

function getBestMove(board, colLevels) {
  for (let i = 0; i < 7; i++) {
    if (colLevels[i] >= 0) {
      let tempBoard = JSON.parse(JSON.stringify(board));
      tempBoard[colLevels[i]][i] = "oppo";
      if (checkWin(tempBoard)) return i;
    }
  }
  for (let i = 0; i < 7; i++) {
    if (colLevels[i] >= 0) {
      let tempBoard = JSON.parse(JSON.stringify(board));
      tempBoard[colLevels[i]][i] = "user";
      if (checkWin(tempBoard)) return i;
    }
  }
  return getRandomMove(colLevels);
}

function getImpossibleMove(board, colLevels) {
  for (let i = 0; i < 7; i++) {
    if (colLevels[i] >= 0) {
      let tempBoard = JSON.parse(JSON.stringify(board));
      tempBoard[colLevels[i]][i] = "oppo";
      if (checkWin(tempBoard)) return i;
    }
  }

  for (let i = 0; i < 7; i++) {
    if (colLevels[i] >= 0) {
      let tempBoard = JSON.parse(JSON.stringify(board));
      tempBoard[colLevels[i]][i] = "user";
      if (checkWin(tempBoard)) return i;
    }
  }

  const colWeights = [1, 3, 5, 7, 5, 3, 1];
  let bestScore = -999;
  let bestChoices = [];

  for (let i = 0; i < 7; i++) {
    if (colLevels[i] >= 0) {
      let currentScore = colWeights[i];

      if (colLevels[i] - 1 >= 0) {
        let tempBoard = JSON.parse(JSON.stringify(board));
        tempBoard[colLevels[i]][i] = "oppo"; 
        tempBoard[colLevels[i] - 1][i] = "user"; 
        if (checkWin(tempBoard)) {
          currentScore -= 15; 
        }
      }

      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestChoices = [i];
      } else if (currentScore === bestScore) {
        bestChoices.push(i);
      }
    }
  }

  if (bestChoices.length > 0) {
    return bestChoices[Math.floor(Math.random() * bestChoices.length)];
  }
  return getRandomMove(colLevels);
}