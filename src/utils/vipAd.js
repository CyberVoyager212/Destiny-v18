const { MessageEmbed } = require('discord.js');

const ads = [
  `👑 **• SEÇKİN KULÜBE KATILIN!**
  
  ✨ *En ayrıcalıklı üyelerinden biri olun ve sınırları tamamen aşın!*
  
  🌟 **Neler Kazanacaksınız?**
  ├─ 💰 **2 Kat** daha fazla Günlük/Haftalık ödül!
  ├─ 💼 **5 Kat** daha fazla \`work\` ve \`beg\` kazancı!
  └─ 💎 Özel altın temalı komut çerçeveleri!
  
  👉 Hemen sahip olmak için **\`vipal\`** komutunu kullanın!`,

  `🎰 **• KUMARHANENİN YENİ KRALI!**
  
  🔮 *Şansınızı şansa bırakmayın, ayrıcalıklarınızla kumar masasında fırtına estirin!*
  
  💎 **VIP Kumar Ayrıcalıkları:**
  ├─ 🎟️ Kumarhane giriş ücretlerinde **%50 Dev İndirim**!
  ├─ 📈 Tüm şans oyunlarında hissedilir derecede **yüksek kazanma şansı**!
  └─ 🤑 Kayıplarınızı minimumda tutan özel mekanikler!
  
  👉 Hemen sahip olmak için **\`vipal\`** komutunu kullanın!`,

  `📦 **• HAZİNE AVINI DESTEKLEYİN!**
  
  ✨ *Her aramada en nadir eşyaları ilk siz toplayın, envanterinizi efsanevi kılın!*
  
  🛡️ **VIP Toplayıcı Özellikleri:**
  ├─ 🐾 \`collect\` komutunda efsanevi evcil hayvan bulma şansı!
  ├─ 💎 Değerli taşları (Diamond, Emerald, vb.) bulma olasılığında muazzam artış!
  └─ 🎒 Tek seferde **kat kat daha fazla** eşya toplama gücü!
  
  👉 Hemen sahip olmak için **\`vipal\`** komutunu kullanın!`,

  `💳 **• KREDİ SKORUNUZU GÜVENCEYE ALIN!**
  
  📈 *Finansal özgürlüğün ve akıllı yatırımların tadını çıkarın!*
  
  🛡️ **VIP Finans Güvencesi:**
  ├─ ❌ Borç çekildiğinde kredi puanı cezası **neredeyse sıfır**!
  ├─ 📉 Geri ödemelerdeki faiz oranı %5 yerine **sadece %2**!
  └─ 💸 Sınırsız borç limiti ve esnek ödeme planları!
  
  👉 Hemen sahip olmak için **\`vipal\`** komutunu kullanın!`,

  `⚡ **• YAPAY ZEKAYI SINIRSIZ YAŞAYIN!**
  
  🤖 *Yapay zeka sınırlarına takılmadan kesintisiz sohbetin tadını çıkarın!*
  
  ⚡ **VIP AI Gücü:**
  ├─ 🪙 Normal kullanıcılardan **4 kat daha fazla** AI kullanım hakkı!
  ├─ 🔄 **4 kat daha hızlı** yenilenen yapay zeka token hakları!
  └─ 💬 AI'ın sizin VIP olduğunuzu bilip daha saygın ve özel yanıtlar vermesi!
  
  👉 Hemen sahip olmak için **\`vipal\`** komutunu kullanın!`,
];

module.exports = {
  sendAd(messageOrInteraction) {
    if (Math.random() < 0.4) return;
    const randomAd = ads[Math.floor(Math.random() * ads.length)];
    const embed = new MessageEmbed()
      .setColor('#FFD700')
      .setDescription(randomAd)
      .setFooter({ text: '✨ VIP Ayrıcalıklı Kulübü • vipal' })
      .setTimestamp();

    const channel = messageOrInteraction.channel;
    if (!channel) return;

    setTimeout(() => {
      channel.send({ embeds: [embed] }).catch(() => {});
    }, 1200);
  },
};
