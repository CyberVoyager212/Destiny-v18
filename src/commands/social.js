const {
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
  MessageAttachment,
} = require('discord.js');
const fs = require('fs');
const https = require('https');
const path = require('path');
const translate = require('translate-google');

const DATA_DIR = './data';
const MEDYA_DIR = path.join(DATA_DIR, 'sosyal');
const DB_FILE = path.join(DATA_DIR, 'sosyal.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(MEDYA_DIR)) fs.mkdirSync(MEDYA_DIR);

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
const sGet = (key) => {
  const db = loadDB();
  return db[key] !== undefined ? db[key] : null;
};
const sSet = (key, value) => {
  const db = loadDB();
  db[key] = value;
  saveDB(db);
};
const sDel = (key) => {
  const db = loadDB();
  delete db[key];
  saveDB(db);
};
const sAll = () => {
  const db = loadDB();
  return Object.entries(db).map(([id, value]) => ({ id, value }));
};
const sDelDesen = (desen) => {
  const db = loadDB();
  const silinen = [];
  for (const key of Object.keys(db)) {
    if (desen(key)) {
      delete db[key];
      silinen.push(key);
    }
  }
  saveDB(db);
  return silinen;
};

const DILLER = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  ru: 'Rusça',
  ja: 'Japonca',
  zh: 'Çince',
  ar: 'Arapça',
  pt: 'Portekizce',
  nl: 'Felemenkçe',
  pl: 'Lehçe',
  ko: 'Korece',
  hi: 'Hintçe',
};

async function ceviriYap(metin, kaynakDil, hedefDil) {
  if (!kaynakDil || !hedefDil || kaynakDil === hedefDil)
    return { metin, cevrildi: false };
  try {
    const cevrilen = await translate(metin, { from: kaynakDil, to: hedefDil });
    return {
      metin: `[${DILLER[kaynakDil] || kaynakDil} → ${DILLER[hedefDil] || hedefDil}]: ${cevrilen}`,
      cevrildi: true,
      kaynakDil,
      hedefDil,
    };
  } catch (hata) {
    console.error('Çeviri hatası:', hata);
    return {
      metin: `[${DILLER[kaynakDil] || kaynakDil} → ${DILLER[hedefDil] || hedefDil}]: ${metin}`,
      cevrildi: true,
      kaynakDil,
      hedefDil,
    };
  }
}

async function ceviriSimule(metin, kaynakDil, hedefDil) {
  const sonuc = await ceviriYap(metin, kaynakDil, hedefDil);
  return sonuc.metin;
}

const SERI_ASAMALAR = [
  { min: 0, baslik: 'Yeni Başlangıç', emoji: '🌱', renk: '#A0A0A0', seviye: 0 },
  { min: 3, baslik: 'Büyüyen Bağ', emoji: '🌿', renk: '#57F287', seviye: 1 },
  { min: 7, baslik: 'Güçlü İletişim', emoji: '🔥', renk: '#FEE75C', seviye: 2 },
  {
    min: 14,
    baslik: 'Ayrılmaz İkili',
    emoji: '⚡',
    renk: '#EB459E',
    seviye: 3,
  },
  { min: 30, baslik: 'Efsanevi Seri', emoji: '💎', renk: '#5865F2', seviye: 4 },
  { min: 60, baslik: 'Platin Bağ', emoji: '👑', renk: '#E91E63', seviye: 5 },
];

function seriAsamaBul(sayi) {
  let asama = SERI_ASAMALAR[0];
  for (const a of SERI_ASAMALAR) {
    if (sayi >= a.min) asama = a;
  }
  return asama;
}

function seriGoster(sayi) {
  const asama = seriAsamaBul(sayi);
  const maxBar = 15;
  const ilerleme = Math.min(sayi, maxBar);
  let bar = '';
  for (let i = 0; i < maxBar; i++) bar += i < ilerleme ? asama.emoji : '⬜';
  const sonrakiAsama = SERI_ASAMALAR.find((a) => a.min > sayi);
  const sonrakiBilgi = sonrakiAsama
    ? `\n> Sonraki: **${sonrakiAsama.baslik}** (${sonrakiAsama.min} gün)`
    : '\n> **En üst seviyeye ulaştın!**';
  return {
    baslik: asama.baslik,
    renk: asama.renk,
    emoji: asama.emoji,
    seviye: asama.seviye,
    metin: `${asama.emoji} **${asama.baslik}** [Seviye ${asama.seviye}]\n${bar} \`${sayi}\` Gün${sonrakiBilgi}`,
  };
}

const dosyaIndir = (url, hedef) =>
  new Promise((resolve, reject) => {
    const dosya = fs.createWriteStream(hedef);
    https
      .get(url, (yanit) => {
        yanit.pipe(dosya);
        dosya.on('finish', () => dosya.close(resolve));
      })
      .on('error', (hata) => {
        fs.unlink(hedef, () => {});
        reject(hata);
      });
  });

const bildirimGonder = (hedefId, metin, tur = 'genel') => {
  let bildirimler = sGet(`bildirimler_${hedefId}`) || [];
  bildirimler.push({ metin, tur, zaman: Date.now() });
  if (bildirimler.length > 50) bildirimler.shift();
  sSet(`bildirimler_${hedefId}`, bildirimler);
};

function hesapTemizle(kullaniciId, db) {
  db.delete(`profile_${kullaniciId}`);
  sDel(`ayarlar_${kullaniciId}`);
  sDel(`profil_snap_${kullaniciId}`);
  sDel(`bildirimler_${kullaniciId}`);
  sDel(`yerimleri_${kullaniciId}`);

  const benimTakip = sGet(`takip_${kullaniciId}`) || [];
  sDel(`takip_${kullaniciId}`);
  sDel(`takipciler_${kullaniciId}`);
  for (const takipId of benimTakip) {
    let onunTakipcileri = sGet(`takipciler_${takipId}`) || [];
    onunTakipcileri = onunTakipcileri.filter((id) => id !== kullaniciId);
    sSet(`takipciler_${takipId}`, onunTakipcileri);
    let onunTakip = sGet(`takip_${takipId}`) || [];
    onunTakip = onunTakip.filter((id) => id !== kullaniciId);
    sSet(`takip_${takipId}`, onunTakip);
  }

  let gonderiler = sGet('gonderiler') || [];
  const kalanGonderiler = [];
  for (const g of gonderiler) {
    if (g.yazarId === kullaniciId) {
      if (g.medya && g.medya.length > 0) {
        for (const medyaYolu of g.medya) {
          if (fs.existsSync(medyaYolu)) fs.unlinkSync(medyaYolu);
        }
      }
    } else {
      if (g.yorumlar)
        g.yorumlar = g.yorumlar.filter((y) => y.yazarId !== kullaniciId);
      if (g.begeniler)
        g.begeniler = g.begeniler.filter((id) => id !== kullaniciId);
      kalanGonderiler.push(g);
    }
  }
  sSet('gonderiler', kalanGonderiler);

  const tumVeriler = sAll();
  for (const veri of tumVeriler) {
    if (veri.id.startsWith('dm_')) {
      const parcalar = veri.id.split('_');
      if (parcalar.length >= 3) {
        const gonderen = parcalar[1];
        const hedef = parcalar.slice(2).join('_');
        if (hedef === kullaniciId || gonderen === kullaniciId) {
          let mesajlar = sGet(veri.id) || [];
          mesajlar = mesajlar.filter((m) => m.gonderen !== kullaniciId);
          if (mesajlar.length === 0) sDel(veri.id);
          else sSet(veri.id, mesajlar);
        }
      }
    }
  }

  sDelDesen((key) => {
    if (!key.startsWith('seri_')) return false;
    const parcalar = key.replace('seri_', '').split('_');
    return parcalar.includes(kullaniciId);
  });

  let gruplar = sGet('gruplar') || [];
  const yeniGruplar = [];
  for (const g of gruplar) {
    g.uyeler = g.uyeler.filter((u) => u !== kullaniciId);
    g.adminler = (g.adminler || []).filter((a) => a !== kullaniciId);
    g.banlilar = (g.banlilar || []).filter((b) => b !== kullaniciId);
    g.mesajlar = g.mesajlar.filter((m) => m.gonderen !== kullaniciId);
    if (g.sahip !== kullaniciId && g.uyeler.length > 0) yeniGruplar.push(g);
  }
  sSet('gruplar', yeniGruplar);
}

const alanDogrulama = (alan, deger) => {
  if (!deger || deger.trim().length === 0)
    return { gecerli: false, hata: 'Bu alan boş olamaz.' };
  const v = deger.trim();
  switch (alan) {
    case 'isim':
      if (v.length > 30)
        return { gecerli: false, hata: 'İsim en fazla 30 karakter olabilir.' };
      return { gecerli: true };
    case 'soyisim':
      if (v.length > 30)
        return {
          gecerli: false,
          hata: 'Soyisim en fazla 30 karakter olabilir.',
        };
      return { gecerli: true };
    case 'yas':
      const yas = parseInt(v);
      if (isNaN(yas) || yas < 13 || yas > 99)
        return { gecerli: false, hata: 'Yaş 13-99 arasında olmalıdır.' };
      return { gecerli: true, deger: yas };
    case 'hakkimda':
      if (v.length > 200)
        return {
          gecerli: false,
          hata: 'Hakkımda en fazla 200 karakter olabilir.',
        };
      return { gecerli: true };
    case 'avatar':
      if (!v.startsWith('http'))
        return {
          gecerli: false,
          hata: 'Geçerli bir URL girin veya fotoğraf ekleyin.',
        };
      return { gecerli: true };
    default:
      if (v.length > 50)
        return { gecerli: false, hata: 'En fazla 50 karakter olabilir.' };
      return { gecerli: true };
  }
};

const RENKLER = {
  birincil: '#5865F2',
  ikincil: '#2F3136',
  basari: '#57F287',
  uyari: '#FEE75C',
  hata: '#E74C3C',
  bilgi: '#3498DB',
  yesil: '#57F287',
  kirmizi: '#E74C3C',
  gri: '#99AAB5',
  turuncu: '#F39C12',
};

exports.execute = async (client, message, args) => {
  const db = client.db;
  const kullaniciId = message.author.id;

  let profil = await db.get(`profile_${kullaniciId}`);
  if (!profil) {
    return message.reply(
      `**${message.member.displayName}**, henüz bir profil oluşturmamışsın!\n` +
        `Sisteme giriş yapabilmek için lütfen şu formatta profilini doldur:\n` +
        `\`!hakkımda işleme <yaş>; <isim>; <soyisim>; <hakkımda>; <favori oyuncu>; <favori yemek>; <favori renk>; <favori hobi>; <favori hayvan>; <favori film>; <favori şarkı>; <doğum günü>; <aktiflik>\``,
    );
  }

  let ayarlar = sGet(`ayarlar_${kullaniciId}`) || {
    dil: null,
    donduruldu: false,
    gizli: false,
  };

  if (!ayarlar.dil) {
    const dilSecenekleri = Object.keys(DILLER).map((kod) => ({
      label: DILLER[kod],
      value: kod,
      description: `${DILLER[kod]} dilini seçmek için tıklayın.`,
    }));
    const satir = new MessageActionRow().addComponents(
      new MessageSelectMenu()
        .setCustomId(`dil_sec_${kullaniciId}`)
        .setPlaceholder('🌍 Dil Seçin')
        .addOptions(dilSecenekleri.slice(0, 25)),
    );
    const dilMesaji = await message.reply({
      content: `🌍 Lütfen dilinizi seçin:`,
      components: [satir],
    });
    const toplayici = dilMesaji.createMessageComponentCollector({
      filter: (i) =>
        i.customId === `dil_sec_${kullaniciId}` && i.user.id === kullaniciId,
      time: 30000,
    });
    toplayici.on('collect', async (i) => {
      ayarlar.dil = i.values[0];
      sSet(`ayarlar_${kullaniciId}`, ayarlar);
      await i.update({
        content: `✅ Dil **${DILLER[ayarlar.dil]}** olarak ayarlandı. Komutu tekrar kullanın.`,
        components: [],
      });
      toplayici.stop();
    });
    return;
  }

  if (ayarlar.donduruldu) {
    ayarlar.donduruldu = false;
    sSet(`ayarlar_${kullaniciId}`, ayarlar);
    message.channel.send('🔓 Hesabın tekrar aktifleştirildi!');
  }

  let akisSayfasi = 0,
    akisYukariSayaci = 0,
    sohbetSayfasi = 0;
  let aktifSohbetHedef = null,
    aktifSohbetTur = null,
    listeSayfasi = 0;
  let mevcutMenu = 'akis',
    hedefProfilId = null,
    oneriSayfasi = 0;
  let grupOneriSayfasi = 0,
    mevcutGrupId = null,
    yerImiSayfasi = 0;
  let cevrilmisGonderi = false,
    cevrilmisSohbet = false;
  let yorumSayfasi = 0,
    yorumGosterilenGonderiId = null;
  let dmMesajSilMenuAcik = false;

  const navMenu = () =>
    new MessageActionRow().addComponents(
      new MessageSelectMenu()
        .setCustomId(`nav_${kullaniciId}`)
        .setPlaceholder('🌐 DesNet')
        .addOptions([
          {
            label: '🏠 Keşfet',
            value: 'akis',
            description: 'Gönderileri keşfet',
          },
          {
            label: '👤 Profilim',
            value: 'profil',
            description: 'Profilini görüntüle',
          },
          {
            label: '✏️ Profil Düzenle',
            value: 'profil_duzenle',
            description: 'Profil bilgilerini düzenle',
          },
          {
            label: '💬 Mesajlar & Gruplar',
            value: 'sohbetler',
            description: 'DM ve grup sohbetleri',
          },
          {
            label: '🔔 Bildirimler',
            value: 'bildirimler',
            description: 'Bildirimlerini kontrol et',
          },
          {
            label: '📌 Yer İmleri',
            value: 'yer_imleri',
            description: 'Kaydedilen gönderiler',
          },
          {
            label: '👥 Takip Önerileri',
            value: 'oneriler',
            description: 'Yeni kişiler keşfet',
          },
          {
            label: '🏛️ Grup Önerileri',
            value: 'grup_oneriler',
            description: 'Gruplara katıl',
          },
          {
            label: '⚙️ Ayarlar',
            value: 'ayarlar',
            description: 'Hesap ayarları',
          },
        ]),
    );

  const profilEmbed = async (hedefId) => {
    const hP = await db.get(`profile_${hedefId}`);
    const hAyarlar = sGet(`ayarlar_${hedefId}`) || {};
    const hTakipciler = sGet(`takipciler_${hedefId}`) || [];
    const hTakip = sGet(`takip_${hedefId}`) || [];
    const hKullanici = await client.users.fetch(hedefId).catch(() => null);
    if (!hP)
      return new MessageEmbed()
        .setTitle('Profil Bulunamadı')
        .setDescription('Bu kullanıcıya ait profil verisi yok.')
        .setColor(RENKLER.hata);
    const embed = new MessageEmbed()
      .setColor(RENKLER.birincil)
      .setAuthor({
        name: `${hP.isim} ${hP.soyisim}`,
        iconURL: hKullanici
          ? hKullanici.displayAvatarURL({ dynamic: true })
          : null,
      })
      .setThumbnail(
        hP.avatar ||
          (hKullanici ? hKullanici.displayAvatarURL({ dynamic: true }) : null),
      );
    if (hAyarlar.donduruldu) {
      embed
        .setDescription('❄️ **Bu hesap dondurulmuş.**')
        .setColor(RENKLER.gri);
      return embed;
    }
    const benimTakip = sGet(`takip_${kullaniciId}`) || [];
    if (
      hAyarlar.gizli &&
      hedefId !== kullaniciId &&
      !benimTakip.includes(hedefId)
    ) {
      embed
        .setDescription(
          '🔒 **Bu hesap gizli.** Takip ederek içeriğini görebilirsiniz.',
        )
        .setColor(RENKLER.gri);
      return embed;
    }
    let tumGonderiler = sGet('gonderiler') || [];
    let kullaniciGonderileri = tumGonderiler.filter(
      (g) => g.yazarId === hedefId,
    );
    const durumEmoji = hAyarlar.gizli ? '🔒' : '🌐';
    const oyuncu = hP.sevdigimOyuncu || hP.oyuncu || '—';
    const yemek = hP.sevdigimYemek || hP.yemek || '—';
    const renk = hP.sevdigimRenk || hP.renk || '—';
    const hobi = hP.sevdigimHobi || hP.hobi || '—';
    const hayvan = hP.sevdigimHayvan || hP.hayvan || '—';
    const film = hP.sevdigimFilm || hP.film || '—';
    const sarki = hP.sevdigimSarki || hP.sarki || '—';
    const dogumGunu = hP.dogumGunum || hP.dogumgunu || '—';
    const hakkimda = hP.hakkimda || '—';
    const yas = hP.yas || '—';
    const aktiflik = hP.aktiflik || '—';
    embed
      .setDescription(`${durumEmoji} ${hakkimda}`)
      .addField(
        '📋 Kişisel Bilgiler',
        `**Yaş:** ${yas} | **Doğum Günü:** ${dogumGunu} | **Aktiflik:** ${aktiflik}`,
        false,
      )
      .addField(
        '📊 Sosyal İstatistik',
        `**Takipçi:** ${hTakipciler.length} | **Takip:** ${hTakip.length} | **Gönderi:** ${kullaniciGonderileri.length}`,
        false,
      )
      .addField(
        '🎯 Favoriler',
        `**Oyuncu:** ${oyuncu} | **Yemek:** ${yemek} | **Renk:** ${renk}`,
        false,
      )
      .addField(
        '🎨 İlgi Alanları',
        `**Hobi:** ${hobi} | **Hayvan:** ${hayvan} | **Film:** ${film} | **Şarkı:** ${sarki}`,
        false,
      );
    if (kullaniciGonderileri.length > 0) {
      const sonGonderiler = kullaniciGonderileri.sort((a, b) => b.zaman - a.zaman).slice(0, 5);
      const gonderiMetin = sonGonderiler.map((g, i) => {
        const medyaIcon = g.medya && g.medya.length > 0 ? ' 🖼️' : '';
        const icerik = g.icerik.length > 60 ? g.icerik.slice(0, 60) + '...' : g.icerik;
        return `\`${i + 1}.\` ${icerik}${medyaIcon} — <t:${Math.floor(g.zaman / 1000)}:R>`;
      }).join('\n');
      embed.addField(
        `📝 Gönderileri (${kullaniciGonderileri.length})`,
        gonderiMetin,
        false,
      );
    }
    embed.setFooter({
      text: `DesNet Profil • ID: ${hedefId}`,
      iconURL: hKullanici?.displayAvatarURL({ dynamic: true }),
    });
    return embed;
  };

  const render = async (interaction) => {
    try {
      if (mevcutMenu === 'akis') {
        let gonderiler = sGet('gonderiler') || [];
        const benimTakip = sGet(`takip_${kullaniciId}`) || [];
        gonderiler = gonderiler
          .filter((g) => {
            const s = sGet(`ayarlar_${g.yazarId}`) || {};
            if (s.donduruldu) return false;
            if (
              s.gizli &&
              !benimTakip.includes(g.yazarId) &&
              g.yazarId !== kullaniciId
            )
              return false;
            return true;
          })
          .sort((a, b) => b.zaman - a.zaman);

        if (gonderiler.length === 0) {
          const e = new MessageEmbed()
            .setTitle('🌐 DesNet | Keşfet')
            .setDescription(
              'Henüz kimse bir şey paylaşmamış.\nİlk gönderiyi sen paylaş!',
            )
            .setColor(RENKLER.ikincil);
          const navBtns = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`gonderi_paylas_${kullaniciId}`)
              .setLabel('✨ Paylaş')
              .setStyle('SUCCESS'),
          );
          await interaction.update({
            embeds: [e],
            components: [navMenu(), navBtns],
            files: [],
          });
          return;
        }
        if (akisSayfasi >= gonderiler.length)
          akisSayfasi = gonderiler.length - 1;
        const gonderi = gonderiler[akisSayfasi];
        const yazarKullanici = await client.users
          .fetch(gonderi.yazarId)
          .catch(() => null);
        const yazarProfil = await db.get(`profile_${gonderi.yazarId}`);
        const yazarAd = yazarProfil
          ? `${yazarProfil.isim} ${yazarProfil.soyisim}`
          : yazarKullanici
            ? yazarKullanici.username
            : 'Bilinmeyen';
        const begeniler = gonderi.begeniler || [];
        const yorumlar = gonderi.yorumlar || [];
        const begenildi = begeniler.includes(kullaniciId);
        const yerImlerinde = (sGet(`yerimleri_${kullaniciId}`) || []).includes(
          gonderi.id,
        );
        const yazarAyarlar = sGet(`ayarlar_${gonderi.yazarId}`) || {};
        const yazarDil = yazarAyarlar.dil || gonderi.dil || 'tr';
        const dilFarkli = yazarDil !== ayarlar.dil;
        let gosterilenIcerik = gonderi.icerik;
        if (cevrilmisGonderi && dilFarkli) {
          try {
            const ceviriSonuc = await ceviriYap(gonderi.icerik, yazarDil, ayarlar.dil);
            gosterilenIcerik = ceviriSonuc.metin;
          } catch (ceviriHata) {
            gosterilenIcerik = gonderi.icerik;
          }
        }

        const e = new MessageEmbed()
          .setAuthor({
            name: yazarAd,
            iconURL:
              yazarProfil?.avatar ||
              (yazarKullanici
                ? yazarKullanici.displayAvatarURL({ dynamic: true })
                : null),
          })
          .setDescription(gosterilenIcerik || '\u200b')
          .addField('👍 Beğeni', `${begeniler.length}`, true)
          .addField('💬 Yorum', `${yorumlar.length}`, true)
          .addField(
            '🕐 Tarih',
            `<t:${Math.floor(gonderi.zaman / 1000)}:R>`,
            true,
          )
          .setColor(RENKLER.ikincil)
          .setFooter({
            text: `DesNet${cevrilmisGonderi && dilFarkli ? ' • 🌐 Çevrildi' : ''}`,
          });

        if (yorumlar.length > 0) {
          const sonYorumlar = yorumlar.slice(-3);
          const yorumMetinleri = await Promise.all(
            sonYorumlar.map(async (y) => {
              const yP = await db.get(`profile_${y.yazarId}`);
              const yAd = yP ? yP.isim : 'Bilinmeyen';
              const yMedyaIcon = y.medya ? ' 🖼️' : '';
              const yDil =
                y.dil || (sGet(`ayarlar_${y.yazarId}`) || {}).dil || 'tr';
              const yCevrildi = cevrilmisGonderi && yDil !== ayarlar.dil;
              let yMetin = y.metin;
              if (yCevrildi) {
                try {
                  const yCeviriSonuc = await ceviriYap(y.metin, yDil, ayarlar.dil);
                  yMetin = yCeviriSonuc.metin;
                } catch (yCeviriHata) {
                  yMetin = y.metin;
                }
              }
              const yCeviriIcon = yDil !== ayarlar.dil ? ' 🌐' : '';
              return `**${yAd}:** ${yMetin}${yMedyaIcon}${yCeviriIcon}`;
            }),
          );
          e.addField('💬 Son Yorumlar', yorumMetinleri.join('\n'));
        }

        const satir1 = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`akis_yukari_${kullaniciId}`)
            .setLabel('⬆️ Yukarı')
            .setStyle('PRIMARY')
            .setDisabled(akisSayfasi === 0 || akisYukariSayaci >= 5),
          new MessageButton()
            .setCustomId(`akis_asagi_${kullaniciId}`)
            .setLabel('⬇️ Aşağı')
            .setStyle('PRIMARY')
            .setDisabled(akisSayfasi >= gonderiler.length - 1),
          new MessageButton()
            .setCustomId(`begen_${gonderi.id}`)
            .setLabel(begenildi ? '👍 Beğeniyi Kaldır' : '👍 Beğen')
            .setStyle(begenildi ? 'DANGER' : 'PRIMARY'),
          new MessageButton()
            .setCustomId(`yorum_yap_${gonderi.id}`)
            .setLabel('💬 Yorum')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`profil_gor_${gonderi.yazarId}`)
            .setLabel('👤 Profil')
            .setStyle('SECONDARY'),
        );
        const satir2Btns = [
          new MessageButton()
            .setCustomId(`gonderi_paylas_${kullaniciId}`)
            .setLabel('✨ Paylaş')
            .setStyle('SUCCESS'),
          new MessageButton()
            .setCustomId(`yerimi_${gonderi.id}`)
            .setLabel(yerImlerinde ? '📌 Kaydedildi' : '📌 Kaydet')
            .setStyle(yerImlerinde ? 'SECONDARY' : 'PRIMARY'),
        ];
        if (dilFarkli)
          satir2Btns.push(
            new MessageButton()
              .setCustomId(`gonderi_cevir_${gonderi.id}`)
              .setLabel(cevrilmisGonderi ? '🌐 Orijinal' : '🌐 Çevir')
              .setStyle('SECONDARY'),
          );
        if (gonderi.yazarId === kullaniciId)
          satir2Btns.push(
            new MessageButton()
              .setCustomId(`gonderi_sil_${gonderi.id}`)
              .setLabel('🗑️ Sil')
              .setStyle('DANGER'),
          );
        const satir2 = new MessageActionRow().addComponents(...satir2Btns);

        let dosyalar = [];
        if (
          gonderi.medya &&
          gonderi.medya.length > 0 &&
          fs.existsSync(gonderi.medya[0])
        ) {
          const ek = new MessageAttachment(
            gonderi.medya[0],
            path.basename(gonderi.medya[0]),
          );
          dosyalar.push(ek);
          e.setImage(`attachment://${path.basename(gonderi.medya[0])}`);
        }
        await interaction.update({
          embeds: [e],
          components: [navMenu(), satir1, satir2],
          files: dosyalar,
        });
      } else if (mevcutMenu === 'profil') {
        const e = await profilEmbed(kullaniciId);
        const satir = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`gonderi_paylas_${kullaniciId}`)
            .setLabel('✨ Gönderi Paylaş')
            .setStyle('SUCCESS'),
        );
        await interaction.update({
          embeds: [e],
          components: [navMenu(), satir],
          files: [],
        });
      } else if (mevcutMenu === 'profil_goruntule') {
        const e = await profilEmbed(hedefProfilId);
        const benimTakip = sGet(`takip_${kullaniciId}`) || [];
        const hAyarlar = sGet(`ayarlar_${hedefProfilId}`) || {};
        const takipEtiketi = benimTakip.includes(hedefProfilId)
          ? '👥 Takipten Çık'
          : '👥 Takip Et';
        const butonlar = [
          new MessageButton()
            .setCustomId(`takip_degistir_${hedefProfilId}`)
            .setLabel(takipEtiketi)
            .setStyle('PRIMARY'),
        ];
        if (
          hedefProfilId !== kullaniciId &&
          (!hAyarlar.gizli || benimTakip.includes(hedefProfilId))
        ) {
          butonlar.push(
            new MessageButton()
              .setCustomId(`dm_gonder_${hedefProfilId}`)
              .setLabel('💬 Mesaj Gönder')
              .setStyle('SECONDARY'),
          );
        }
        await interaction.update({
          embeds: [e],
          components: [
            navMenu(),
            new MessageActionRow().addComponents(...butonlar),
          ],
          files: [],
        });
      } else if (mevcutMenu === 'profil_duzenle') {
        const e = new MessageEmbed()
          .setTitle('✏️ Profil Düzenle')
          .setDescription(
            'Değiştirmek istediğiniz bilgiyi seçin.\nHer alan için yeni değer yazmanız veya fotoğraf eklemeniz istenecektir.',
          )
          .setColor(RENKLER.birincil)
          .setFooter({ text: 'Değişiklikler anında kaydedilir • DesNet' });
        const s1 = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`duzenle_isim_${kullaniciId}`)
            .setLabel('👤 İsim')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId(`duzenle_soyisim_${kullaniciId}`)
            .setLabel('👤 Soyisim')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId(`duzenle_yas_${kullaniciId}`)
            .setLabel('🎂 Yaş')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId(`duzenle_hakkimda_${kullaniciId}`)
            .setLabel('📝 Hakkımda')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId(`duzenle_avatar_${kullaniciId}`)
            .setLabel('🖼️ Profil Fotoğrafı')
            .setStyle('PRIMARY'),
        );
        const s2 = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`duzenle_oyuncu_${kullaniciId}`)
            .setLabel('🎭 Oyuncu')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_yemek_${kullaniciId}`)
            .setLabel('🍽️ Yemek')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_renk_${kullaniciId}`)
            .setLabel('🎨 Renk')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_hobi_${kullaniciId}`)
            .setLabel('🎯 Hobi')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_hayvan_${kullaniciId}`)
            .setLabel('🐾 Hayvan')
            .setStyle('SECONDARY'),
        );
        const s3 = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`duzenle_film_${kullaniciId}`)
            .setLabel('🎬 Film')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_sarki_${kullaniciId}`)
            .setLabel('🎵 Şarkı')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_dogumgunu_${kullaniciId}`)
            .setLabel('🎂 Doğum Günü')
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`duzenle_aktiflik_${kullaniciId}`)
            .setLabel('⚡ Aktiflik')
            .setStyle('SECONDARY'),
        );
        await interaction.update({
          embeds: [e],
          components: [navMenu(), s1, s2, s3],
          files: [],
        });
      } else if (mevcutMenu === 'ayarlar') {
        const e = new MessageEmbed()
          .setTitle('⚙️ Ayarlar')
          .setColor(RENKLER.birincil)
          .addField(
            '🔒 Gizlilik',
            ayarlar.gizli
              ? '**Gizli Hesap** — Sadece takipçiler içeriği görebilir'
              : '**Açık Hesap** — Herkes içeriği görebilir',
            false,
          )
          .addField(
            '❄️ Durum',
            ayarlar.donduruldu ? '**Dondurulmuş**' : '**Aktif**',
            false,
          )
          .addField(
            '🌍 Dil',
            `**${DILLER[ayarlar.dil] || ayarlar.dil}**`,
            false,
          )
          .setFooter({ text: '⚠️ Hesap silme işlemi geri alınamaz!' });
        const gizliEtiket = ayarlar.gizli
          ? '🔓 Gizliliği Kapat'
          : '🔒 Hesabı Gizle';
        const satir = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`gizlilik_degistir_${kullaniciId}`)
            .setLabel(gizliEtiket)
            .setStyle('SECONDARY'),
          new MessageButton()
            .setCustomId(`hesap_dondur_${kullaniciId}`)
            .setLabel('❄️ Dondur')
            .setStyle('DANGER'),
          new MessageButton()
            .setCustomId(`hesap_sil_${kullaniciId}`)
            .setLabel('🗑️ Hesabı Sil')
            .setStyle('DANGER'),
          new MessageButton()
            .setCustomId(`dil_degistir_${kullaniciId}`)
            .setLabel('🌍 Dil Değiştir')
            .setStyle('PRIMARY'),
        );
        await interaction.update({
          embeds: [e],
          components: [navMenu(), satir],
          files: [],
        });
      } else if (mevcutMenu === 'bildirimler') {
        let bildirimler = sGet(`bildirimler_${kullaniciId}`) || [];
        const e = new MessageEmbed()
          .setTitle('🔔 Bildirimler')
          .setColor(RENKLER.uyari);
        if (bildirimler.length === 0) {
          e.setDescription('Yeni bildirim yok. 🎉');
        } else {
          const turEmoji = {
            takip: '👥',
            begeni: '👍',
            yorum: '💬',
            mesaj: '💌',
            grup: '🏛️',
            genel: '🔔',
          };
          e.setDescription(
            bildirimler
              .slice(-15)
              .reverse()
              .map((b) => {
                const emoji = turEmoji[b.tur] || '🔔';
                return `${emoji} ${b.metin} — <t:${Math.floor(b.zaman / 1000)}:R>`;
              })
              .join('\n\n'),
          );
          e.setFooter({ text: `${bildirimler.length} bildirim` });
        }
        await interaction.update({
          embeds: [e],
          components: [navMenu()],
          files: [],
        });
      } else if (mevcutMenu === 'yer_imleri') {
        let yerimleri = sGet(`yerimleri_${kullaniciId}`) || [];
        let gonderiler = sGet('gonderiler') || [];
        const kaydedilenGonderiler = gonderiler.filter((g) =>
          yerimleri.includes(g.id),
        );
        const e = new MessageEmbed()
          .setTitle('📌 Yer İmleri')
          .setColor('#EB459E');
        if (kaydedilenGonderiler.length === 0) {
          e.setDescription(
            'Henüz kaydedilen gönderi yok.\nKeşfet bölümünde 📌 butonuna tıklayarak gönderi kaydedebilirsiniz.',
          );
          await interaction.update({
            embeds: [e],
            components: [navMenu()],
            files: [],
          });
          return;
        }
        const toplamSayfa = kaydedilenGonderiler.length;
        if (yerImiSayfasi >= toplamSayfa) yerImiSayfasi = toplamSayfa - 1;
        if (yerImiSayfasi < 0) yerImiSayfasi = 0;
        const gonderi = kaydedilenGonderiler[yerImiSayfasi];
        const yazarKullanici = await client.users.fetch(gonderi.yazarId).catch(() => null);
        const yazarProfil = await db.get(`profile_${gonderi.yazarId}`);
        const yazarAd = yazarProfil ? `${yazarProfil.isim} ${yazarProfil.soyisim}` : yazarKullanici ? yazarKullanici.username : 'Bilinmeyen';
        const begeniler = gonderi.begeniler || [];
        const yorumlar = gonderi.yorumlar || [];
        const yerImlerinde = true;
        const bookmarkE = new MessageEmbed()
          .setAuthor({
            name: yazarAd,
            iconURL: yazarProfil?.avatar || (yazarKullanici ? yazarKullanici.displayAvatarURL({ dynamic: true }) : null),
          })
          .setDescription(gonderi.icerik || '\u200b')
          .addField('👍 Beğeni', `${begeniler.length}`, true)
          .addField('💬 Yorum', `${yorumlar.length}`, true)
          .addField('🕐 Tarih', `<t:${Math.floor(gonderi.zaman / 1000)}:R>`, true)
          .setColor('#EB459E')
          .setFooter({ text: `Sayfa ${yerImiSayfasi + 1} / ${toplamSayfa} • DesNet` });
        let dosyalar = [];
        if (gonderi.medya && gonderi.medya.length > 0 && fs.existsSync(gonderi.medya[0])) {
          const ek = new MessageAttachment(gonderi.medya[0], path.basename(gonderi.medya[0]));
          dosyalar.push(ek);
          bookmarkE.setImage(`attachment://${path.basename(gonderi.medya[0])}`);
        }
        const bilesenler = [navMenu()];
        bilesenler.push(
          new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`yerimi_onceki_${kullaniciId}`)
              .setLabel('⬅️ Önceki')
              .setStyle('SECONDARY')
              .setDisabled(yerImiSayfasi === 0),
            new MessageButton()
              .setCustomId(`yerimi_sonraki_${kullaniciId}`)
              .setLabel('➡️ Sonraki')
              .setStyle('SECONDARY')
              .setDisabled(yerImiSayfasi >= toplamSayfa - 1),
            new MessageButton()
              .setCustomId(`yerimi_kaldir_${gonderi.id}`)
              .setLabel('📌 Kayıttan Kaldır')
              .setStyle('DANGER'),
            new MessageButton()
              .setCustomId(`yorum_yap_${gonderi.id}`)
              .setLabel('💬 Yorumlar')
              .setStyle('SECONDARY'),
            new MessageButton()
              .setCustomId(`begen_${gonderi.id}`)
              .setLabel(begeniler.includes(kullaniciId) ? '👍 Beğeniyi Kaldır' : '👍 Beğen')
              .setStyle(begeniler.includes(kullaniciId) ? 'DANGER' : 'PRIMARY'),
          ),
        );
        await interaction.update({
          embeds: [bookmarkE],
          components: bilesenler,
          files: dosyalar,
        });
      }

      else if (mevcutMenu === 'yorumlar') {
        let gonderiler = sGet('gonderiler') || [];
        const gonderi = gonderiler.find((g) => g.id === yorumGosterilenGonderiId);
        if (!gonderi) {
          mevcutMenu = 'akis';
          await render(interaction);
          return;
        }
        const yorumlar = gonderi.yorumlar || [];
        if (yorumlar.length === 0) {
          const e = new MessageEmbed()
            .setTitle('💬 Yorumlar')
            .setDescription('Henüz yorum yok. İlk yorumu sen yaz!')
            .setColor(RENKLER.ikincil);
          const satir = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`yorum_yaz_${yorumGosterilenGonderiId}`)
              .setLabel('✏️ Yorum Yaz')
              .setStyle('SUCCESS'),
            new MessageButton()
              .setCustomId(`yorum_foto_${yorumGosterilenGonderiId}`)
              .setLabel('🖼️ Fotoğraflı Yorum')
              .setStyle('PRIMARY'),
            new MessageButton()
              .setCustomId(`yorum_geri_${kullaniciId}`)
              .setLabel('⬅️ Geri')
              .setStyle('SECONDARY'),
          );
          await interaction.update({
            embeds: [e],
            components: [navMenu(), satir],
            files: [],
          });
          return;
        }
        let sayfaOgeleri = [];
        let mevcutSayfaKapasite = 0;
        let sayfaBaslangiclari = [0];
        let yorumIdx = 0;
        while (yorumIdx < yorumlar.length) {
          const y = yorumlar[yorumIdx];
          const fotoMi = y.medya && y.medya.length > 0;
          if (fotoMi) {
            if (mevcutSayfaKapasite > 0) {
              sayfaBaslangiclari.push(yorumIdx);
            }
            mevcutSayfaKapasite = 1;
            sayfaBaslangiclari.push(yorumIdx + 1);
            mevcutSayfaKapasite = 0;
          } else {
            mevcutSayfaKapasite += 1;
            if (mevcutSayfaKapasite >= 10) {
              mevcutSayfaKapasite = 0;
              if (yorumIdx + 1 < yorumlar.length) {
                sayfaBaslangiclari.push(yorumIdx + 1);
              }
            }
          }
          yorumIdx++;
        }
        let sayfalar = [];
        let tempBaslangic = 0;
        for (yorumIdx = 0; yorumIdx < yorumlar.length; ) {
          const y = yorumlar[yorumIdx];
          const fotoMi = y.medya && y.medya.length > 0;
          if (fotoMi) {
            if (yorumIdx > tempBaslangic) {
              sayfalar.push({ baslangic: tempBaslangic, bitis: yorumIdx, tip: 'metin' });
            }
            sayfalar.push({ baslangic: yorumIdx, bitis: yorumIdx + 1, tip: 'foto' });
            tempBaslangic = yorumIdx + 1;
          }
          yorumIdx++;
        }
        if (tempBaslangic < yorumlar.length) {
          const kalanMetinler = yorumlar.slice(tempBaslangic);
          for (let i = 0; i < kalanMetinler.length; i += 10) {
            sayfalar.push({
              baslangic: tempBaslangic + i,
              bitis: Math.min(tempBaslangic + i + 10, yorumlar.length),
              tip: 'metin',
            });
          }
        }
        if (sayfalar.length === 0) sayfalar.push({ baslangic: 0, bitis: 0, tip: 'bos' });
        if (yorumSayfasi >= sayfalar.length) yorumSayfasi = sayfalar.length - 1;
        if (yorumSayfasi < 0) yorumSayfasi = 0;
        const mevcutSayfa = sayfalar[yorumSayfasi];
        const sayfaYorumlar = yorumlar.slice(mevcutSayfa.baslangic, mevcutSayfa.bitis);
        const yazarKullanici = await client.users.fetch(gonderi.yazarId).catch(() => null);
        const yazarProfil = await db.get(`profile_${gonderi.yazarId}`);
        const yazarAd = yazarProfil ? `${yazarProfil.isim} ${yazarProfil.soyisim}` : yazarKullanici ? yazarKullanici.username : 'Bilinmeyen';
        const e = new MessageEmbed()
          .setTitle('💬 Yorumlar')
          .setColor(RENKLER.ikincil);
        e.setAuthor({
          name: `${yazarAd} gönderisi`,
          iconURL: yazarProfil?.avatar || (yazarKullanici ? yazarKullanici.displayAvatarURL({ dynamic: true }) : null),
        });
        if (mevcutSayfa.tip === 'foto' && sayfaYorumlar.length > 0) {
          const y = sayfaYorumlar[0];
          const yP = await db.get(`profile_${y.yazarId}`);
          const yAd = yP ? `${yP.isim} ${yP.soyisim}` : 'Bilinmeyen';
          const yDil = y.dil || (sGet(`ayarlar_${y.yazarId}`) || {}).dil || 'tr';
          const yCevrildi = cevrilmisGonderi && yDil !== ayarlar.dil;
          let gosterilenMetin = y.metin || '';
          if (yCevrildi) {
            try { gosterilenMetin = await ceviriYap(y.metin, yDil, ayarlar.dil); gosterilenMetin = gosterilenMetin.metin; } catch (e2) { gosterilenMetin = y.metin; }
          }
          e.setDescription(`**${yAd}:** ${gosterilenMetin}\n<t:${Math.floor(y.zaman / 1000)}:R>`);
          if (y.medya && y.medya.length > 0 && fs.existsSync(y.medya[0])) {
            const ek = new MessageAttachment(y.medya[0], path.basename(y.medya[0]));
            e.setImage(`attachment://${path.basename(y.medya[0])}`);
            var yorumDosyalar = [ek];
          } else {
            var yorumDosyalar = [];
          }
        } else {
          const aciklama = await Promise.all(sayfaYorumlar.map(async (y) => {
            const yP = await db.get(`profile_${y.yazarId}`);
            const yAd = yP ? `${yP.isim} ${yP.soyisim}` : 'Bilinmeyen';
            const yDil = y.dil || (sGet(`ayarlar_${y.yazarId}`) || {}).dil || 'tr';
            const yCevrildi = cevrilmisGonderi && yDil !== ayarlar.dil;
            let gosterilenMetin = y.metin || '';
            if (yCevrildi) {
              try { gosterilenMetin = await ceviriYap(y.metin, yDil, ayarlar.dil); gosterilenMetin = gosterilenMetin.metin; } catch (e2) { gosterilenMetin = y.metin; }
            }
            const ceviriIcon = yDil !== ayarlar.dil ? ' 🌐' : '';
            return `**${yAd}:** ${gosterilenMetin}${ceviriIcon} — <t:${Math.floor(y.zaman / 1000)}:R>`;
          }));
          e.setDescription(aciklama.join('\n\n') || 'Henüz yorum yok.');
          var yorumDosyalar = [];
        }
        e.setFooter({ text: `Sayfa ${yorumSayfasi + 1} / ${sayfalar.length} • 💬 ${yorumlar.length} yorum` });
        const satirlar = [navMenu()];
        satirlar.push(new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`yorum_onceki_${kullaniciId}`)
            .setLabel('⬅️ Önceki')
            .setStyle('SECONDARY')
            .setDisabled(yorumSayfasi === 0),
          new MessageButton()
            .setCustomId(`yorum_sonraki_${kullaniciId}`)
            .setLabel('➡️ Sonraki')
            .setStyle('SECONDARY')
            .setDisabled(yorumSayfasi >= sayfalar.length - 1),
          new MessageButton()
            .setCustomId(`yorum_yaz_${yorumGosterilenGonderiId}`)
            .setLabel('✏️ Yorum Yaz')
            .setStyle('SUCCESS'),
          new MessageButton()
            .setCustomId(`yorum_foto_${yorumGosterilenGonderiId}`)
            .setLabel('🖼️ Fotoğraflı Yorum')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId(`yorum_geri_${kullaniciId}`)
            .setLabel('⬅️ Geri')
            .setStyle('SECONDARY'),
        ));
        await interaction.update({
          embeds: [e],
          components: satirlar,
          files: yorumDosyalar || [],
        });
      }

      else if (mevcutMenu === 'oneriler') {
        const benimTakip = sGet(`takip_${kullaniciId}`) || [];
        const tumVeriler = sAll();
        let adaylar = [];
        for (const veri of tumVeriler) {
          if (veri.id.startsWith('profil_snap_')) {
            const id = veri.id.replace('profil_snap_', '');
            if (id !== kullaniciId && !benimTakip.includes(id)) {
              const s = sGet(`ayarlar_${id}`) || {};
              if (!s.donduruldu) {
                const takipciler = sGet(`takipciler_${id}`) || [];
                adaylar.push({
                  id,
                  isim: veri.value.isim,
                  soyisim: veri.value.soyisim,
                  takipciler: takipciler.length,
                  gizli: s.gizli,
                });
              }
            }
          }
        }
        const SAYFA_BOYUT = 5;
        const toplamSayfa = Math.max(
          1,
          Math.ceil(adaylar.length / SAYFA_BOYUT),
        );
        if (oneriSayfasi >= toplamSayfa) oneriSayfasi = toplamSayfa - 1;
        const sayfaOgeler = adaylar.slice(
          oneriSayfasi * SAYFA_BOYUT,
          (oneriSayfasi + 1) * SAYFA_BOYUT,
        );
        const e = new MessageEmbed()
          .setTitle('👥 Takip Önerileri')
          .setColor(RENKLER.birincil);
        if (adaylar.length === 0) e.setDescription('Öneri bulunamadı.');
        else {
          e.setDescription(
            sayfaOgeler
              .map((a, i) => {
                const sira = oneriSayfasi * SAYFA_BOYUT + i + 1;
                return `**${sira}. ${a.isim} ${a.soyisim}**${a.gizli ? ' *(🔒 Gizli)*' : ''}\n👥 Takipçi: ${a.takipciler}`;
              })
              .join('\n\n'),
          );
          e.setFooter({
            text: `Sayfa ${oneriSayfasi + 1} / ${toplamSayfa} • DesNet`,
          });
        }
        const bilesenleri = [navMenu()];
        if (sayfaOgeler.length > 0) {
          bilesenleri.push(
            new MessageActionRow().addComponents(
              new MessageSelectMenu()
                .setCustomId(`oneri_profil_sec_${kullaniciId}`)
                .setPlaceholder('👤 Profili Seç')
                .addOptions(
                  sayfaOgeler.map((a) => ({
                    label: `${a.isim} ${a.soyisim}`,
                    value: a.id,
                    description: `${a.takipciler} takipçi`,
                  })),
                ),
            ),
          );
        }
        bilesenleri.push(
          new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`oneri_onceki_${kullaniciId}`)
              .setLabel('⬅️ Önceki')
              .setStyle('SECONDARY')
              .setDisabled(oneriSayfasi === 0),
            new MessageButton()
              .setCustomId(`oneri_sonraki_${kullaniciId}`)
              .setLabel('➡️ Sonraki')
              .setStyle('SECONDARY')
              .setDisabled(oneriSayfasi >= toplamSayfa - 1),
          ),
        );
        await interaction.update({
          embeds: [e],
          components: bilesenleri,
          files: [],
        });
      }

      else if (mevcutMenu === 'grup_oneriler') {
        let gruplar = sGet('gruplar') || [];
        const acikGruplar = gruplar.filter(
          (g) =>
            !g.uyeler.includes(kullaniciId) &&
            !(g.banlilar || []).includes(kullaniciId),
        );
        const SAYFA_BOYUT = 5;
        const toplamSayfa = Math.max(
          1,
          Math.ceil(acikGruplar.length / SAYFA_BOYUT),
        );
        if (grupOneriSayfasi >= toplamSayfa) grupOneriSayfasi = toplamSayfa - 1;
        const sayfaOgeler = acikGruplar.slice(
          grupOneriSayfasi * SAYFA_BOYUT,
          (grupOneriSayfasi + 1) * SAYFA_BOYUT,
        );
        const e = new MessageEmbed()
          .setTitle('🏛️ Grup Önerileri')
          .setColor(RENKLER.yesil);
        if (acikGruplar.length === 0)
          e.setDescription('Katılabileceğin grup yok. Kendi grubunu kur!');
        else {
          e.setDescription(
            sayfaOgeler
              .map((g, i) => {
                const sira = grupOneriSayfasi * SAYFA_BOYUT + i + 1;
                return `**${sira}. ${g.ad}**\n👥 Üye: ${g.uyeler.length} | 💬 Mesaj: ${g.mesajlar.length}`;
              })
              .join('\n\n'),
          );
          e.setFooter({
            text: `Sayfa ${grupOneriSayfasi + 1} / ${toplamSayfa} • DesNet`,
          });
        }
        const bilesenleri = [navMenu()];
        if (sayfaOgeler.length > 0) {
          bilesenleri.push(
            new MessageActionRow().addComponents(
              new MessageSelectMenu()
                .setCustomId(`gruba_katil_sec_${kullaniciId}`)
                .setPlaceholder('🏛️ Gruba Katıl')
                .addOptions(
                  sayfaOgeler.map((g) => ({
                    label: g.ad,
                    value: g.id,
                    description: `${g.uyeler.length} üye`,
                  })),
                ),
            ),
          );
        }
        bilesenleri.push(
          new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`grup_oneri_onceki_${kullaniciId}`)
              .setLabel('⬅️ Önceki')
              .setStyle('SECONDARY')
              .setDisabled(grupOneriSayfasi === 0),
            new MessageButton()
              .setCustomId(`grup_oneri_sonraki_${kullaniciId}`)
              .setLabel('➡️ Sonraki')
              .setStyle('SECONDARY')
              .setDisabled(grupOneriSayfasi >= toplamSayfa - 1),
          ),
        );
        await interaction.update({
          embeds: [e],
          components: bilesenleri,
          files: [],
        });
      }

      else if (mevcutMenu === 'sohbetler') {
        let tumVeriler = sAll();
        let sohbetlerim = [];
        for (let v of tumVeriler) {
          if (v.id.startsWith(`dm_${kullaniciId}_`)) {
            const hId = v.id.replace(`dm_${kullaniciId}_`, '');
            const mesajlar = v.value;
            const sonZaman =
              mesajlar.length > 0 ? mesajlar[mesajlar.length - 1].zaman : 0;
            sohbetlerim.push({ id: hId, tur: 'dm', zaman: sonZaman });
          }
        }
        let gruplar = sGet('gruplar') || [];
        for (let g of gruplar) {
          if (g.uyeler.includes(kullaniciId)) {
            const sonZaman =
              g.mesajlar.length > 0
                ? g.mesajlar[g.mesajlar.length - 1].zaman
                : 0;
            sohbetlerim.push({
              id: g.id,
              ad: g.ad,
              tur: 'grup',
              zaman: sonZaman,
            });
          }
        }
        sohbetlerim.sort((a, b) => b.zaman - a.zaman);
        const baslangic = listeSayfasi * 10;
        const sayfaSohbetler = sohbetlerim.slice(baslangic, baslangic + 10);
        if (sayfaSohbetler.length === 0 && listeSayfasi === 0) {
          const e = new MessageEmbed()
            .setTitle('💬 Mesajlar & Gruplar')
            .setDescription(
              'Henüz sohbet yok. Bir gruba katıl veya yeni grup kur!',
            )
            .setColor(RENKLER.ikincil);
          const grupBtn = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`grup_kur_${kullaniciId}`)
              .setLabel('🏛️ Grup Kur')
              .setStyle('SUCCESS'),
          );
          await interaction.update({
            embeds: [e],
            components: [navMenu(), grupBtn],
            files: [],
          });
          return;
        }
        const secenekler = await Promise.all(
          sayfaSohbetler.map(async (s) => {
            let etiket = '';
            if (s.tur === 'dm') {
              const p = await db.get(`profile_${s.id}`);
              etiket = p ? `${p.isim} ${p.soyisim}` : 'Bilinmeyen';
            } else {
              etiket = `[Grup] ${s.ad}`;
            }
            return { label: etiket.slice(0, 100), value: `${s.tur}_${s.id}` };
          }),
        );
        const secimSatiri = new MessageActionRow().addComponents(
          new MessageSelectMenu()
            .setCustomId(`sohbet_ac_${kullaniciId}`)
            .setPlaceholder(`💬 Sohbet Seç (Sayfa ${listeSayfasi + 1})`)
            .addOptions(secenekler),
        );
        const navSatir = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`sohbet_liste_onceki_${kullaniciId}`)
            .setLabel('⬅️ Önceki')
            .setStyle('SECONDARY')
            .setDisabled(listeSayfasi === 0),
          new MessageButton()
            .setCustomId(`sohbet_liste_sonraki_${kullaniciId}`)
            .setLabel('➡️ Sonraki')
            .setStyle('SECONDARY')
            .setDisabled(baslangic + 10 >= sohbetlerim.length),
          new MessageButton()
            .setCustomId(`grup_kur_${kullaniciId}`)
            .setLabel('🏛️ Grup Kur')
            .setStyle('SUCCESS'),
        );
        await interaction.update({
          embeds: [
            new MessageEmbed()
              .setTitle('💬 Mesajlar & Gruplar')
              .setDescription(
                `${sohbetlerim.length} sohbet • Sayfa ${listeSayfasi + 1}`,
              )
              .setColor(RENKLER.ikincil),
          ],
          components: [navMenu(), secimSatiri, navSatir],
          files: [],
        });
      }

      else if (mevcutMenu === 'sohbet_goruntule') {
        let mesajlar = [],
          baslik = '',
          seriGosterim = null,
          grupSahibi = false,
          grupAdmin = false;
        if (aktifSohbetTur === 'dm') {
          const hAyarlar = sGet(`ayarlar_${aktifSohbetHedef}`) || {};
          const benimTakip = sGet(`takip_${kullaniciId}`) || [];
          if (
            hAyarlar.gizli &&
            !benimTakip.includes(aktifSohbetHedef) &&
            aktifSohbetHedef !== kullaniciId
          ) {
            const e = new MessageEmbed()
              .setTitle('🔒 Gizli Hesap')
              .setDescription('Bu kullanıcıya mesaj gönderemezsiniz.')
              .setColor(RENKLER.hata);
            await interaction.update({
              embeds: [e],
              components: [navMenu()],
              files: [],
            });
            return;
          }
          mesajlar = sGet(`dm_${kullaniciId}_${aktifSohbetHedef}`) || [];
          const p = await db.get(`profile_${aktifSohbetHedef}`);
          baslik = p ? `${p.isim} ${p.soyisim}` : 'Bilinmeyen';
          const seriVeri = sGet(`seri_${kullaniciId}_${aktifSohbetHedef}`) || {
            sayi: 0,
          };
          seriGosterim = seriGoster(seriVeri.sayi);
        } else {
          let gruplar = sGet('gruplar') || [];
          let grp = gruplar.find((g) => g.id === aktifSohbetHedef);
          if (grp) {
            mesajlar = grp.mesajlar;
            baslik = grp.ad;
            grupSahibi = grp.sahip === kullaniciId;
            grupAdmin =
              grupSahibi || (grp.adminler || []).includes(kullaniciId);
            mevcutGrupId = grp.id;
          }
        }
        let sohbetSayfalar = [];
        let tempBaslangic = 0;
        let tempKapasite = 0;
        for (let mIdx = 0; mIdx < mesajlar.length; mIdx++) {
          const m = mesajlar[mIdx];
          const fotoMi = m.medya && m.medya.length > 0;
          if (fotoMi) {
            if (tempKapasite > 0) {
              sohbetSayfalar.push({ baslangic: tempBaslangic, bitis: mIdx, tip: 'metin' });
              tempKapasite = 0;
            } else if (mIdx > tempBaslangic) {
              sohbetSayfalar.push({ baslangic: tempBaslangic, bitis: mIdx, tip: 'metin' });
            }
            sohbetSayfalar.push({ baslangic: mIdx, bitis: mIdx + 1, tip: 'foto' });
            tempBaslangic = mIdx + 1;
            tempKapasite = 0;
          } else {
            tempKapasite++;
            if (tempKapasite >= 10) {
              sohbetSayfalar.push({ baslangic: tempBaslangic, bitis: mIdx + 1, tip: 'metin' });
              tempBaslangic = mIdx + 1;
              tempKapasite = 0;
            }
          }
        }
        if (tempBaslangic < mesajlar.length) {
          sohbetSayfalar.push({ baslangic: tempBaslangic, bitis: mesajlar.length, tip: 'metin' });
        }
        if (sohbetSayfalar.length === 0) {
          sohbetSayfalar.push({ baslangic: 0, bitis: 0, tip: 'bos' });
        }
        if (sohbetSayfasi >= sohbetSayfalar.length) sohbetSayfasi = sohbetSayfalar.length - 1;
        if (sohbetSayfasi < 0) sohbetSayfasi = 0;
        const mevcutSayfa = sohbetSayfalar[sohbetSayfasi];
        const gorinenMesajlar = mesajlar.slice(mevcutSayfa.baslangic, mevcutSayfa.bitis);
        const e = new MessageEmbed()
          .setTitle(`💬 ${baslik}`)
          .setColor(seriGosterim ? seriGosterim.renk : RENKLER.ikincil);
        if (seriGosterim)
          e.addField(`${seriGosterim.emoji} Seri`, seriGosterim.metin);
        let aciklama = '';
        let sohbetDilFarkli = false;
        for (const m of gorinenMesajlar) {
          if (m.gonderen === 'sistem') {
            aciklama += `━━━━━━━━━━━━━━━\n🔔 *${m.metin}* — <t:${Math.floor(m.zaman / 1000)}:R>\n`;
            continue;
          }
          const benim = m.gonderen === kullaniciId;
          const gP = benim ? profil : await db.get(`profile_${m.gonderen}`);
          const gAd = gP ? `${gP.isim} ${gP.soyisim}` : '?';
          const medyaIcon = m.medya ? ' 🖼️' : '';
          const zamanStr = `<t:${Math.floor(m.zaman / 1000)}:t>`;
          const gonderenDil =
            m.dil || (sGet(`ayarlar_${m.gonderen}`) || {}).dil || 'tr';
          const mesajDilFarkli = gonderenDil !== ayarlar.dil;
          if (mesajDilFarkli) sohbetDilFarkli = true;
          let gosterilenMetin = m.metin;
          if (cevrilmisSohbet && mesajDilFarkli) {
            try {
              const ceviriSonuc = await ceviriYap(m.metin, gonderenDil, ayarlar.dil);
              gosterilenMetin = ceviriSonuc.metin;
            } catch (ceviriHata) {
              gosterilenMetin = m.metin;
            }
          }
          const ceviriIcon = mesajDilFarkli ? ' 🌐' : '';
          if (benim)
            aciklama += `━━━━━━━━━━━━━━━\n📤 **Sen** ${zamanStr}\n> ${gosterilenMetin}${medyaIcon}${ceviriIcon}\n`;
          else
            aciklama += `━━━━━━━━━━━━━━━\n📥 **${gAd}** ${zamanStr}\n> ${gosterilenMetin}${medyaIcon}${ceviriIcon}\n`;
        }
        if (!aciklama)
          aciklama = 'Henüz mesaj yok. 💬 Yaz butonuna tıklayarak mesaj gönder!';
        e.setDescription(aciklama);
        e.setFooter({
          text: `Sayfa ${sohbetSayfasi + 1} / ${sohbetSayfalar.length} • DesNet${cevrilmisSohbet && sohbetDilFarkli ? ' • 🌐 Çevrildi' : ''}`,
        });
        let dosyalar = [];
        if (mevcutSayfa.tip === 'foto' && gorinenMesajlar.length > 0) {
          const fotoMesaj = gorinenMesajlar[0];
          if (fotoMesaj.medya && fotoMesaj.medya.length > 0 && fs.existsSync(fotoMesaj.medya[0])) {
            const ek = new MessageAttachment(
              fotoMesaj.medya[0],
              path.basename(fotoMesaj.medya[0]),
            );
            dosyalar.push(ek);
            e.setImage(`attachment://${path.basename(fotoMesaj.medya[0])}`);
          }
        } else if (mevcutSayfa.tip === 'metin') {
          const sonMedyaMesaj = gorinenMesajlar.find(
            (m) => m.medya && m.medya.length > 0 && fs.existsSync(m.medya[0]),
          );
          if (sonMedyaMesaj) {
            const ek = new MessageAttachment(
              sonMedyaMesaj.medya[0],
              path.basename(sonMedyaMesaj.medya[0]),
            );
            dosyalar.push(ek);
            e.setImage(`attachment://${path.basename(sonMedyaMesaj.medya[0])}`);
          }
        }
        const butonlar = [
          new MessageButton()
            .setCustomId(`sohbet_yukari_${kullaniciId}`)
            .setLabel('⬆️ Yukarı')
            .setStyle('PRIMARY')
            .setDisabled(sohbetSayfasi >= sohbetSayfalar.length - 1),
          new MessageButton()
            .setCustomId(`sohbet_asagi_${kullaniciId}`)
            .setLabel('⬇️ Aşağı')
            .setStyle('SECONDARY')
            .setDisabled(sohbetSayfasi === 0),
          new MessageButton()
            .setCustomId(`sohbet_yaz_${kullaniciId}`)
            .setLabel('✉️ Yaz')
            .setStyle('SUCCESS'),
          new MessageButton()
            .setCustomId(`sohbet_foto_${kullaniciId}`)
            .setLabel('🖼️ Fotoğraf')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId(`mesaj_sil_menu_${kullaniciId}`)
            .setLabel('🗑️ Mesaj Sil')
            .setStyle('DANGER'),
        ];
        if (sohbetDilFarkli)
          butonlar.push(
            new MessageButton()
              .setCustomId(`sohbet_cevir_${kullaniciId}`)
              .setLabel(cevrilmisSohbet ? '🌐 Orijinal' : '🌐 Çevir')
              .setStyle('SECONDARY'),
          );
        if (aktifSohbetTur === 'grup' && grupAdmin)
          butonlar.push(
            new MessageButton()
              .setCustomId(`grubu_yonet_${kullaniciId}`)
              .setLabel('⚙️ Yönet')
              .setStyle('SECONDARY'),
          );
        if (aktifSohbetTur === 'grup' && !grupSahibi)
          butonlar.push(
            new MessageButton()
              .setCustomId(`gruptan_cik_${kullaniciId}`)
              .setLabel('🚪 Gruptan Çık')
              .setStyle('DANGER'),
          );
        if (aktifSohbetTur === 'grup' && grupSahibi)
          butonlar.push(
            new MessageButton()
              .setCustomId(`grubu_sil_${kullaniciId}`)
              .setLabel('🗑️ Grubu Sil')
              .setStyle('DANGER'),
          );
        const satirlar = [navMenu()];
        for (let i = 0; i < butonlar.length; i += 5)
          satirlar.push(
            new MessageActionRow().addComponents(...butonlar.slice(i, i + 5)),
          );
        if (dmMesajSilMenuAcik && gorinenMesajlar.length > 0) {
          const silmeSecenekleri = gorinenMesajlar
            .filter((m) => m.gonderen === kullaniciId && m.gonderen !== 'sistem')
            .slice(0, 25)
            .map((m, i) => {
              const onEk = m.medya && m.medya.length > 0 ? '🖼️ ' : '';
              const icerik = m.metin ? m.metin.slice(0, 50) : 'Medya';
              return {
                label: `${onEk}${icerik}`,
                value: String(mevcutSayfa.baslangic + i),
                description: `<t:${Math.floor(m.zaman / 1000)}:R>`,
              };
            });
          if (silmeSecenekleri.length > 0) {
            satirlar.push(
              new MessageActionRow().addComponents(
                new MessageSelectMenu()
                  .setCustomId(`mesaj_sil_sec_${kullaniciId}`)
                  .setPlaceholder('🗑️ Silinecek mesajı seç')
                  .addOptions(silmeSecenekleri),
              ),
            );
          }
        }
        await interaction.update({
          embeds: [e],
          components: satirlar,
          files: dosyalar,
        });
      }

      else if (mevcutMenu === 'grup_yonet') {
        let gruplar = sGet('gruplar') || [];
        let grp = gruplar.find((g) => g.id === mevcutGrupId);
        if (!grp) {
          mevcutMenu = 'sohbetler';
          await render(interaction);
          return;
        }
        const sahipMi = grp.sahip === kullaniciId;
        const adminMi = sahipMi || (grp.adminler || []).includes(kullaniciId);
        const e = new MessageEmbed()
          .setTitle(`⚙️ Grup Yönetimi: ${grp.ad}`)
          .setColor(RENKLER.uyari)
          .addField('👑 Sahip', `<@${grp.sahip}>`, true)
          .addField('👥 Üye Sayısı', String(grp.uyeler.length), true)
          .addField(
            '🛡️ Adminler',
            (grp.adminler || []).length > 0
              ? grp.adminler.map((a) => `<@${a}>`).join(', ')
              : 'Yok',
            false,
          );
        const uyeSecenekleri = await Promise.all(
          grp.uyeler
            .filter((u) => u !== kullaniciId)
            .slice(0, 20)
            .map(async (u) => {
              const p = await db.get(`profile_${u}`);
              return {
                label: (p ? `${p.isim} ${p.soyisim}` : u).slice(0, 100),
                value: u,
              };
            }),
        );
        const bilesenleri = [navMenu()];
        if (uyeSecenekleri.length > 0) {
          bilesenleri.push(
            new MessageActionRow().addComponents(
              new MessageSelectMenu()
                .setCustomId(`grup_at_sec_${kullaniciId}`)
                .setPlaceholder('👢 Üye At')
                .addOptions(uyeSecenekleri),
            ),
            new MessageActionRow().addComponents(
              new MessageSelectMenu()
                .setCustomId(`grup_banla_sec_${kullaniciId}`)
                .setPlaceholder('🛡️ Üye Banla')
                .addOptions(uyeSecenekleri),
            ),
          );
          if (sahipMi)
            bilesenleri.push(
              new MessageActionRow().addComponents(
                new MessageSelectMenu()
                  .setCustomId(`grup_admin_sec_${kullaniciId}`)
                  .setPlaceholder('⭐ Admin Ver / Al')
                  .addOptions(uyeSecenekleri),
              ),
            );
          bilesenleri.push(
            new MessageActionRow().addComponents(
              new MessageSelectMenu()
                .setCustomId(`grup_mesaj_sil_sec_${kullaniciId}`)
                .setPlaceholder('🗑️ Tüm Mesajlarını Sil')
                .addOptions(uyeSecenekleri),
            ),
          );
        }
        await interaction.update({
          embeds: [e],
          components: bilesenleri,
          files: [],
        });
      }
    } catch (hata) {
      console.error('render hatası:', hata);
    }
  };

  sSet(`profil_snap_${kullaniciId}`, {
    isim: profil.isim,
    soyisim: profil.soyisim,
  });

  const guildId = message.guild.id;
  const sosyalKanalKey = `sosyal_kanal_${guildId}_${kullaniciId}`;
  let sosyalKanal;

  if (message._sosyalKanalMode) {
    sosyalKanal = message.channel;
  } else {
    const mevcutKanal = sGet(sosyalKanalKey);

    if (mevcutKanal) {
      const kanal = message.guild.channels.cache.get(mevcutKanal.channelId);
      if (kanal) {
        const uyariMesaji = await message.reply(
          `❗ Zaten bir DesNet kanalın var: ${kanal}\nKullanmak için kanaldaki butona tıkla veya kanalı sil butonuyla kaldır.`
        );
        setTimeout(() => {
          uyariMesaji.delete().catch(() => {});
          message.delete().catch(() => {});
        }, 5000);
        return;
      } else {
        sDel(sosyalKanalKey);
      }
    }

    const channelBase = `desnet-${message.author.username.toLowerCase()}`.replace(
      /[^a-z0-9\-]/g,
      ''
    );
    let channelName = channelBase;
    let chIdx = 1;
    while (message.guild.channels.cache.some((ch) => ch.name === channelName)) {
      channelName = `${channelBase}-${chIdx}`;
      chIdx++;
    }

    sosyalKanal = await message.guild.channels.create(channelName, {
      type: 'GUILD_TEXT',
      topic: `🌐 DesNet - ${message.member.displayName} kişisel sosyal medya kanalı`,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          deny: ['VIEW_CHANNEL'],
        },
        {
          id: kullaniciId,
          allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
        },
      ],
    });

    const silBtnRow = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(`social_ac_${kullaniciId}`)
        .setLabel('🌐 DesNet\'i Aç')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId(`social_sil_${kullaniciId}`)
        .setLabel('🗑️ Kanalı Sil')
        .setStyle('DANGER'),
    );
    const silEmbed = new MessageEmbed()
      .setTitle('🌐 DesNet Sosyal Medya')
      .setDescription(
        `Hoş geldin **${message.member.displayName}**!\nAşağıdaki butonlarla DesNet\'i kullanabilir veya bu kanalı silebilirsin.`
      )
      .setColor(RENKLER.birincil)
      .setFooter({ text: 'Bot yeniden başlasa bile bu kanal kalır.' })
      .setTimestamp();
    const kontrolMesaji = await sosyalKanal.send({
      embeds: [silEmbed],
      components: [silBtnRow],
    });

    sSet(sosyalKanalKey, {
      channelId: sosyalKanal.id,
      kontrolMesajId: kontrolMesaji.id,
      guildId: guildId,
      kullaniciId: kullaniciId,
    });

    const onayMesaji = await message.reply(`✅ DesNet kanalın oluşturuldu: ${sosyalKanal}`);
    setTimeout(() => {
      onayMesaji.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 3000);
  }

  const ilkEmbed = new MessageEmbed()
    .setTitle('🌐 DesNet Yükleniyor...')
    .setColor(RENKLER.birincil);
  const anaMesaj = await sosyalKanal.send({ embeds: [ilkEmbed] });
  await render({ update: async (data) => anaMesaj.edit(data) });

  const toplayici = anaMesaj.createMessageComponentCollector({
    filter: (i) => i.user.id === kullaniciId,
    time: 600000,
  });

  toplayici.on('collect', async (i) => {
    try {
      const cId = i.customId;
      const degerler = i.isSelectMenu() ? i.values : [];

      if (cId === `nav_${kullaniciId}`) {
        mevcutMenu = degerler[0];
        cevrilmisGonderi = false;
        cevrilmisSohbet = false;
        dmMesajSilMenuAcik = false;
        if (mevcutMenu === 'akis') {
          akisSayfasi = 0;
          akisYukariSayaci = 0;
        }
        if (mevcutMenu === 'sohbetler' || mevcutMenu === 'sohbet_goruntule')
          sohbetSayfasi = 0;
        await render(i);
        return;
      }

      if (cId === `akis_asagi_${kullaniciId}`) {
        akisSayfasi++;
        cevrilmisGonderi = false;
        await render(i);
        return;
      }
      if (cId === `akis_yukari_${kullaniciId}`) {
        if (akisYukariSayaci < 5 && akisSayfasi > 0) {
          akisSayfasi--;
          akisYukariSayaci++;
        }
        cevrilmisGonderi = false;
        await render(i);
        return;
      }

      if (cId.startsWith('begen_')) {
        const gonderiId = cId.replace('begen_', '');
        let gonderiler = sGet('gonderiler') || [];
        const idx = gonderiler.findIndex((g) => g.id === gonderiId);
        if (idx !== -1) {
          if (!gonderiler[idx].begeniler) gonderiler[idx].begeniler = [];
          const bIdx = gonderiler[idx].begeniler.indexOf(kullaniciId);
          if (bIdx === -1) {
            gonderiler[idx].begeniler.push(kullaniciId);
            bildirimGonder(
              gonderiler[idx].yazarId,
              `<@${kullaniciId}> gönderini beğendi!`,
              'begeni',
            );
          } else gonderiler[idx].begeniler.splice(bIdx, 1);
          sSet('gonderiler', gonderiler);
        }
        await render(i);
        return;
      }

      if (cId.startsWith('gonderi_cevir_')) {
        cevrilmisGonderi = !cevrilmisGonderi;
        await render(i);
        return;
      }

      if (cId.startsWith('yorum_yap_')) {
        const gonderiId = cId.replace('yorum_yap_', '');
        yorumGosterilenGonderiId = gonderiId;
        yorumSayfasi = 0;
        mevcutMenu = 'yorumlar';
        await render(i);
        return;
      }

      if (cId === `yorum_onceki_${kullaniciId}`) {
        if (yorumSayfasi > 0) yorumSayfasi--;
        await render(i);
        return;
      }
      if (cId === `yorum_sonraki_${kullaniciId}`) {
        yorumSayfasi++;
        await render(i);
        return;
      }
      if (cId === `yorum_geri_${kullaniciId}`) {
        mevcutMenu = 'akis';
        await render(i);
        return;
      }

      if (cId.startsWith('yorum_yaz_')) {
        const gonderiId = cId.replace('yorum_yaz_', '');
        await i.reply({
          content: '💬 Yorumunu yazın:',
          ephemeral: true,
        });
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 60000,
        });
        msgCol.on('collect', async (m) => {
          let gonderiler = sGet('gonderiler') || [];
          const idx = gonderiler.findIndex((g) => g.id === gonderiId);
          if (idx !== -1) {
            if (!gonderiler[idx].yorumlar) gonderiler[idx].yorumlar = [];
            gonderiler[idx].yorumlar.push({
              yazarId: kullaniciId,
              metin: m.content,
              medya: [],
              dil: ayarlar.dil,
              zaman: Date.now(),
            });
            sSet('gonderiler', gonderiler);
            bildirimGonder(
              gonderiler[idx].yazarId,
              `<@${kullaniciId}> gönderine yorum yaptı!`,
              'yorum',
            );
          }
          m.delete().catch(() => {});
          yorumGosterilenGonderiId = gonderiId;
          mevcutMenu = 'yorumlar';
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId.startsWith('yorum_foto_')) {
        const gonderiId = cId.replace('yorum_foto_', '');
        await i.reply({
          content: '🖼️ Fotoğrafınızı ekleyin (yorum da yazabilirsiniz):',
          ephemeral: true,
        });
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 60000,
        });
        msgCol.on('collect', async (m) => {
          let medyaYollar = [];
          if (m.attachments.size > 0) {
            for (const [aid, ek] of m.attachments) {
              const uzanti = path.extname(ek.name) || '.png';
              const hedef = path.join(
                MEDYA_DIR,
                `yorum_${Date.now()}_${aid}${uzanti}`,
              );
              await dosyaIndir(ek.url, hedef);
              medyaYollar.push(hedef);
            }
          }
          if (medyaYollar.length === 0) {
            m.delete().catch(() => {});
            const uyariMesaji = await sosyalKanal.send(
              '⚠️ Fotoğraf bulunamadı. Lütfen bir dosya ekleyin.',
            );
            setTimeout(() => uyariMesaji.delete().catch(() => {}), 3000);
            return;
          }
          let gonderiler = sGet('gonderiler') || [];
          const idx = gonderiler.findIndex((g) => g.id === gonderiId);
          if (idx !== -1) {
            if (!gonderiler[idx].yorumlar) gonderiler[idx].yorumlar = [];
            gonderiler[idx].yorumlar.push({
              yazarId: kullaniciId,
              metin: m.content || '',
              medya: medyaYollar,
              dil: ayarlar.dil,
              zaman: Date.now(),
            });
            sSet('gonderiler', gonderiler);
            bildirimGonder(
              gonderiler[idx].yazarId,
              `<@${kullaniciId}> gönderine fotoğraflı yorum yaptı!`,
              'yorum',
            );
          }
          m.delete().catch(() => {});
          yorumGosterilenGonderiId = gonderiId;
          mevcutMenu = 'yorumlar';
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId.startsWith('gonderi_sil_')) {
        const gonderiId = cId.replace('gonderi_sil_', '');
        let gonderiler = sGet('gonderiler') || [];
        const silinecekGonderi = gonderiler.find(
          (g) => g.id === gonderiId && g.yazarId === kullaniciId,
        );
        if (silinecekGonderi && silinecekGonderi.medya) {
          for (const medyaYolu of silinecekGonderi.medya) {
            if (fs.existsSync(medyaYolu)) fs.unlinkSync(medyaYolu);
          }
        }
        gonderiler = gonderiler.filter(
          (g) => !(g.id === gonderiId && g.yazarId === kullaniciId),
        );
        sSet('gonderiler', gonderiler);
        let yerimleri = sGet(`yerimleri_${kullaniciId}`) || [];
        yerimleri = yerimleri.filter((id) => id !== gonderiId);
        sSet(`yerimleri_${kullaniciId}`, yerimleri);
        const bilgiMesaji = await sosyalKanal.send('🗑️ Gönderi silindi.');
        setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
        await render(i);
        return;
      }

      if (cId === `gonderi_paylas_${kullaniciId}`) {
        await i.reply({
          content:
            '✨ Ne paylaşmak istersin? Metin yazabilir veya fotoğraf/video ekleyebilirsin:',
          ephemeral: true,
        });
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 60000,
        });
        msgCol.on('collect', async (m) => {
          let medyaYollar = [];
          if (m.attachments.size > 0) {
            for (const [aid, ek] of m.attachments) {
              const uzanti = path.extname(ek.name) || '.png';
              const hedef = path.join(
                MEDYA_DIR,
                `medya_${Date.now()}_${aid}${uzanti}`,
              );
              await dosyaIndir(ek.url, hedef);
              medyaYollar.push(hedef);
            }
          }
          if (!m.content && medyaYollar.length === 0)
            return m.delete().catch(() => {});
          let gonderiler = sGet('gonderiler') || [];
          gonderiler.push({
            id: `gonderi_${Date.now()}_${kullaniciId}`,
            yazarId: kullaniciId,
            icerik: m.content || '',
            medya: medyaYollar,
            dil: ayarlar.dil,
            zaman: Date.now(),
            begeniler: [],
            yorumlar: [],
          });
          sSet('gonderiler', gonderiler);
          m.delete().catch(() => {});
          const bilgiMesaji = await sosyalKanal.send(
            '✨ Gönderi paylaşıldı!',
          );
          setTimeout(() => bilgiMesaji.delete().catch(() => {}), 3000);
          mevcutMenu = 'akis';
          akisSayfasi = 0;
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId.startsWith('yerimi_')) {
        const gonderiId = cId.replace('yerimi_', '');
        if (cId === `yerimi_onceki_${kullaniciId}`) {
          if (yerImiSayfasi > 0) yerImiSayfasi--;
          await render(i);
          return;
        }
        if (cId === `yerimi_sonraki_${kullaniciId}`) {
          yerImiSayfasi++;
          await render(i);
          return;
        }
        if (cId.startsWith('yerimi_gonderi_') || !cId.startsWith('yerimi_kaldir_')) {
          let yerimleri = sGet(`yerimleri_${kullaniciId}`) || [];
          const idx = yerimleri.indexOf(gonderiId);
          if (idx === -1) {
            yerimleri.push(gonderiId);
            await i.reply({ content: '📌 Gönderi kaydedildi!', ephemeral: true });
          } else {
            yerimleri.splice(idx, 1);
            await i.reply({
              content: '📌 Gönderi kaydedenlerden çıkarıldı.',
              ephemeral: true,
            });
          }
          sSet(`yerimleri_${kullaniciId}`, yerimleri);
          await render({ update: async (data) => anaMesaj.edit(data) });
          return;
        }
      }
      if (cId.startsWith('yerimi_kaldir_')) {
        const gonderiId = cId.replace('yerimi_kaldir_', '');
        let yerimleri = sGet(`yerimleri_${kullaniciId}`) || [];
        yerimleri = yerimleri.filter((id) => id !== gonderiId);
        sSet(`yerimleri_${kullaniciId}`, yerimleri);
        await i.reply({ content: '📌 Gönderi kayıtlardan kaldırıldı.', ephemeral: true });
        await render({ update: async (data) => anaMesaj.edit(data) });
        return;
      }

      if (cId.startsWith('profil_gor_')) {
        hedefProfilId = cId.replace('profil_gor_', '');
        mevcutMenu = 'profil_goruntule';
        await render(i);
        return;
      }
      if (cId === `oneri_profil_sec_${kullaniciId}`) {
        hedefProfilId = degerler[0];
        mevcutMenu = 'profil_goruntule';
        await render(i);
        return;
      }

      if (cId.startsWith('takip_degistir_')) {
        const hId = cId.replace('takip_degistir_', '');
        let benimTakip = sGet(`takip_${kullaniciId}`) || [];
        let onunTakipcileri = sGet(`takipciler_${hId}`) || [];
        if (benimTakip.includes(hId)) {
          benimTakip = benimTakip.filter((id) => id !== hId);
          onunTakipcileri = onunTakipcileri.filter((id) => id !== kullaniciId);
          await i.reply({ content: '👥 Takipten çıkıldı.', ephemeral: true });
        } else {
          benimTakip.push(hId);
          onunTakipcileri.push(kullaniciId);
          bildirimGonder(hId, `<@${kullaniciId}> seni takip etti!`, 'takip');
          await i.reply({ content: '👥 Takip edildi!', ephemeral: true });
        }
        sSet(`takip_${kullaniciId}`, benimTakip);
        sSet(`takipciler_${hId}`, onunTakipcileri);
        await render({ update: async (data) => anaMesaj.edit(data) });
        return;
      }

      if (cId.startsWith('dm_gonder_')) {
        aktifSohbetTur = 'dm';
        aktifSohbetHedef = cId.replace('dm_gonder_', '');
        sohbetSayfasi = 0;
        mevcutMenu = 'sohbet_goruntule';
        await render(i);
        return;
      }

      if (cId.startsWith('duzenle_') && cId.endsWith(`_${kullaniciId}`)) {
        const alan = cId.replace('duzenle_', '').replace(`_${kullaniciId}`, '');
        const alanAdlari = {
          isim: 'İsim',
          soyisim: 'Soyisim',
          yas: 'Yaş',
          hakkimda: 'Hakkımda',
          avatar: 'Profil Fotoğrafı',
          oyuncu: 'Favori Oyuncu',
          yemek: 'Favori Yemek',
          renk: 'Favori Renk',
          hobi: 'Favori Hobi',
          hayvan: 'Favori Hayvan',
          film: 'Favori Film',
          sarki: 'Favori Şarkı',
          dogumgunu: 'Doğum Günü',
          aktiflik: 'Aktiflik',
        };
        const gosterimAd = alanAdlari[alan] || alan;
        if (alan === 'avatar') {
          await i.reply({
            content:
              '🖼️ Profil fotoğrafını değiştirmek için bir fotoğraf ekleyin veya URL yazın:',
            ephemeral: true,
          });
        } else {
          await i.reply({
            content: `Lütfen yeni **${gosterimAd}** bilginizi yazın:`,
            ephemeral: true,
          });
        }
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 60000,
        });
        msgCol.on('collect', async (m) => {
          let yeniDeger = m.content;
          if (alan === 'avatar' && m.attachments.size > 0) {
            const ek = m.attachments.first();
            const uzanti = path.extname(ek.name) || '.png';
            const hedef = path.join(
              MEDYA_DIR,
              `avatar_${Date.now()}_${kullaniciId}${uzanti}`,
            );
            await dosyaIndir(ek.url, hedef);
            yeniDeger = hedef;
          }
          const dogrulama = alanDogrulama(alan, yeniDeger);
          if (!dogrulama.gecerli) {
            m.delete().catch(() => {});
            const hataMesaji = await sosyalKanal.send(
              `⚠️ ${dogrulama.hata}`,
            );
            setTimeout(() => hataMesaji.delete().catch(() => {}), 3000);
            return;
          }
          const profilAlanEslemesi = {
            oyuncu: 'sevdigimOyuncu',
            yemek: 'sevdigimYemek',
            renk: 'sevdigimRenk',
            hobi: 'sevdigimHobi',
            hayvan: 'sevdigimHayvan',
            film: 'sevdigimFilm',
            sarki: 'sevdigimSarki',
            dogumgunu: 'dogumGunum',
          };
          const hedefAlan = profilAlanEslemesi[alan] || alan;
          profil[hedefAlan] = dogrulama.deger || yeniDeger;
          if (profilAlanEslemesi[alan] && profil[alan] !== undefined) {
            profil[alan] = dogrulama.deger || yeniDeger;
          }
          await db.set(`profile_${kullaniciId}`, profil);
          sSet(`profil_snap_${kullaniciId}`, {
            isim: profil.isim,
            soyisim: profil.soyisim,
          });
          m.delete().catch(() => {});
          const bilgiMesaji = await sosyalKanal.send(
            `✅ ${gosterimAd} güncellendi!`,
          );
          setTimeout(() => bilgiMesaji.delete().catch(() => {}), 3000);
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId === `gizlilik_degistir_${kullaniciId}`) {
        ayarlar.gizli = !ayarlar.gizli;
        sSet(`ayarlar_${kullaniciId}`, ayarlar);
        await render(i);
        return;
      }
      if (cId === `hesap_dondur_${kullaniciId}`) {
        ayarlar.donduruldu = true;
        sSet(`ayarlar_${kullaniciId}`, ayarlar);
        await i.update({ components: [] });
        sosyalKanal.send('❄️ Hesabın donduruldu.');
        return;
      }
      if (cId === `hesap_sil_${kullaniciId}`) {
        hesapTemizle(kullaniciId, db);
        await i.update({ components: [] });
        sosyalKanal.send('🗑️ Hesabın ve tüm verilerin silindi.');
        toplayici.stop();
        return;
      }
      if (cId === `dil_degistir_${kullaniciId}`) {
        const dilSecenekleri = Object.keys(DILLER).map((kod) => ({
          label: DILLER[kod],
          value: kod,
          description: `${DILLER[kod]} dilini seçmek için tıklayın.`,
        }));
        const satir = new MessageActionRow().addComponents(
          new MessageSelectMenu()
            .setCustomId(`dil_sec_${kullaniciId}`)
            .setPlaceholder('🌍 Dil Seçin')
            .addOptions(dilSecenekleri.slice(0, 25)),
        );
        await i.update({
          content: '🌍 Dil değiştirme:',
          components: [satir],
          embeds: [],
          files: [],
        });
        const dilFiltre = (di) =>
          di.customId === `dil_sec_${kullaniciId}` &&
          di.user.id === kullaniciId;
        const dilCol = anaMesaj.createMessageComponentCollector({
          filter: dilFiltre,
          max: 1,
          time: 30000,
        });
        dilCol.on('collect', async (di) => {
          ayarlar.dil = di.values[0];
          sSet(`ayarlar_${kullaniciId}`, ayarlar);
          mevcutMenu = 'ayarlar';
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId === `oneri_onceki_${kullaniciId}`) {
        if (oneriSayfasi > 0) oneriSayfasi--;
        await render(i);
        return;
      }
      if (cId === `oneri_sonraki_${kullaniciId}`) {
        oneriSayfasi++;
        await render(i);
        return;
      }
      if (cId === `grup_oneri_onceki_${kullaniciId}`) {
        if (grupOneriSayfasi > 0) grupOneriSayfasi--;
        await render(i);
        return;
      }
      if (cId === `grup_oneri_sonraki_${kullaniciId}`) {
        grupOneriSayfasi++;
        await render(i);
        return;
      }

      if (cId === `gruba_katil_sec_${kullaniciId}`) {
        const gId = degerler[0];
        let gruplar = sGet('gruplar') || [];
        const gIdx = gruplar.findIndex((g) => g.id === gId);
        if (gIdx !== -1 && !gruplar[gIdx].uyeler.includes(kullaniciId)) {
          gruplar[gIdx].uyeler.push(kullaniciId);
          gruplar[gIdx].mesajlar.push({
            gonderen: 'sistem',
            metin: `<@${kullaniciId}> gruba katıldı.`,
            zaman: Date.now(),
          });
          sSet('gruplar', gruplar);
          bildirimGonder(
            gruplar[gIdx].sahip,
            `<@${kullaniciId}> grubuna katıldı.`,
            'grup',
          );
          const bilgiMesaji = await sosyalKanal.send('🏛️ Gruba katıldın!');
          setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
        }
        mevcutMenu = 'sohbetler';
        await render(i);
        return;
      }

      if (cId === `sohbet_liste_sonraki_${kullaniciId}`) {
        listeSayfasi++;
        await render(i);
        return;
      }
      if (cId === `sohbet_liste_onceki_${kullaniciId}`) {
        if (listeSayfasi > 0) listeSayfasi--;
        await render(i);
        return;
      }
      if (cId === `sohbet_ac_${kullaniciId}`) {
        const secilen = degerler[0].split('_');
        aktifSohbetTur = secilen[0];
        aktifSohbetHedef = secilen.slice(1).join('_');
        sohbetSayfasi = 0;
        cevrilmisSohbet = false;
        mevcutMenu = 'sohbet_goruntule';
        await render(i);
        return;
      }

      if (cId === `sohbet_cevir_${kullaniciId}`) {
        cevrilmisSohbet = !cevrilmisSohbet;
        await render(i);
        return;
      }

      if (cId === `sohbet_yukari_${kullaniciId}`) {
        sohbetSayfasi++;
        await render(i);
        return;
      }
      if (cId === `sohbet_asagi_${kullaniciId}`) {
        if (sohbetSayfasi > 0) sohbetSayfasi--;
        await render(i);
        return;
      }

      if (cId === `sohbet_yaz_${kullaniciId}`) {
        await i.reply({ content: '✉️ Mesajınızı yazın:', ephemeral: true });
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 60000,
        });
        msgCol.on('collect', async (m) => {
          const hamMetin = m.content;
          m.delete().catch(() => {});
          if (aktifSohbetTur === 'dm') {
            const hAyarlar = sGet(`ayarlar_${aktifSohbetHedef}`) || {
              dil: 'en',
            };
            const benimTakip = sGet(`takip_${kullaniciId}`) || [];
            if (hAyarlar.gizli && !benimTakip.includes(aktifSohbetHedef)) {
              const uyariMesaji = await sosyalKanal.send(
                '🔒 Bu kullanıcı mesaj almayı kapatmış.',
              );
              setTimeout(() => uyariMesaji.delete().catch(() => {}), 3000);
              return;
            }
            const mesajObjesi = {
              gonderen: kullaniciId,
              metin: hamMetin,
              dil: ayarlar.dil,
              zaman: Date.now(),
            };
            let benimKutu = sGet(`dm_${kullaniciId}_${aktifSohbetHedef}`) || [];
            let onlarinKutu =
              sGet(`dm_${aktifSohbetHedef}_${kullaniciId}`) || [];
            benimKutu.push(mesajObjesi);
            onlarinKutu.push(mesajObjesi);
            sSet(`dm_${kullaniciId}_${aktifSohbetHedef}`, benimKutu);
            sSet(`dm_${aktifSohbetHedef}_${kullaniciId}`, onlarinKutu);
            let seriVeri = sGet(`seri_${kullaniciId}_${aktifSohbetHedef}`) || {
              sayi: 0,
              sonMesaj: 0,
            };
            const simdi = Date.now();
            const birGun = 86400000;
            if (
              simdi - seriVeri.sonMesaj >= birGun &&
              simdi - seriVeri.sonMesaj < birGun * 2
            )
              seriVeri.sayi++;
            else if (simdi - seriVeri.sonMesaj >= birGun * 2) seriVeri.sayi = 1;
            else if (seriVeri.sayi === 0) seriVeri.sayi = 1;
            seriVeri.sonMesaj = simdi;
            sSet(`seri_${kullaniciId}_${aktifSohbetHedef}`, seriVeri);
            sSet(`seri_${aktifSohbetHedef}_${kullaniciId}`, seriVeri);
            bildirimGonder(
              aktifSohbetHedef,
              `<@${kullaniciId}> sana mesaj gönderdi.`,
              'mesaj',
            );
          } else {
            let gruplar = sGet('gruplar') || [];
            const gIdx = gruplar.findIndex((g) => g.id === aktifSohbetHedef);
            if (gIdx !== -1) {
              gruplar[gIdx].mesajlar.push({
                gonderen: kullaniciId,
                metin: hamMetin,
                dil: ayarlar.dil,
                zaman: Date.now(),
              });
              sSet('gruplar', gruplar);
            }
          }
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId === `sohbet_foto_${kullaniciId}`) {
        await i.reply({
          content: '🖼️ Fotoğrafınızı ekleyin (yorum da yazabilirsiniz):',
          ephemeral: true,
        });
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 60000,
        });
        msgCol.on('collect', async (m) => {
          let medyaYollar = [];
          if (m.attachments.size > 0) {
            for (const [aid, ek] of m.attachments) {
              const uzanti = path.extname(ek.name) || '.png';
              const hedef = path.join(
                MEDYA_DIR,
                `sohbet_${Date.now()}_${aid}${uzanti}`,
              );
              await dosyaIndir(ek.url, hedef);
              medyaYollar.push(hedef);
            }
          }
          if (medyaYollar.length === 0) {
            m.delete().catch(() => {});
            const uyariMesaji = await sosyalKanal.send(
              '⚠️ Fotoğraf bulunamadı. Lütfen bir dosya ekleyin.',
            );
            setTimeout(() => uyariMesaji.delete().catch(() => {}), 3000);
            return;
          }
          const metin = m.content || '📷';
          m.delete().catch(() => {});
          if (aktifSohbetTur === 'dm') {
            const mesajObjesi = {
              gonderen: kullaniciId,
              metin: metin,
              medya: medyaYollar,
              dil: ayarlar.dil,
              zaman: Date.now(),
            };
            let benimKutu = sGet(`dm_${kullaniciId}_${aktifSohbetHedef}`) || [];
            let onlarinKutu =
              sGet(`dm_${aktifSohbetHedef}_${kullaniciId}`) || [];
            benimKutu.push(mesajObjesi);
            onlarinKutu.push(mesajObjesi);
            sSet(`dm_${kullaniciId}_${aktifSohbetHedef}`, benimKutu);
            sSet(`dm_${aktifSohbetHedef}_${kullaniciId}`, onlarinKutu);
            bildirimGonder(
              aktifSohbetHedef,
              `<@${kullaniciId}> sana fotoğraf gönderdi.`,
              'mesaj',
            );
          } else {
            let gruplar = sGet('gruplar') || [];
            const gIdx = gruplar.findIndex((g) => g.id === aktifSohbetHedef);
            if (gIdx !== -1) {
              gruplar[gIdx].mesajlar.push({
                gonderen: kullaniciId,
                metin: metin,
                medya: medyaYollar,
                dil: ayarlar.dil,
                zaman: Date.now(),
              });
              sSet('gruplar', gruplar);
            }
          }
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId === `mesaj_sil_menu_${kullaniciId}`) {
        dmMesajSilMenuAcik = !dmMesajSilMenuAcik;
        await render(i);
        return;
      }
      if (cId === `mesaj_sil_sec_${kullaniciId}`) {
        const silinenMesajIdx = parseInt(degerler[0]);
        if (aktifSohbetTur === 'dm') {
          let benimKutu = sGet(`dm_${kullaniciId}_${aktifSohbetHedef}`) || [];
          if (silinenMesajIdx >= 0 && silinenMesajIdx < benimKutu.length && benimKutu[silinenMesajIdx].gonderen === kullaniciId) {
            if (benimKutu[silinenMesajIdx].medya) {
              for (const medyaYolu of benimKutu[silinenMesajIdx].medya) {
                if (fs.existsSync(medyaYolu)) fs.unlinkSync(medyaYolu);
              }
            }
            benimKutu.splice(silinenMesajIdx, 1);
            sSet(`dm_${kullaniciId}_${aktifSohbetHedef}`, benimKutu);
            let onlarinKutusu = sGet(`dm_${aktifSohbetHedef}_${kullaniciId}`) || [];
            const digerIdx = onlarinKutusu.findIndex(
              (m) => m.gonderen === kullaniciId && m.zaman === benimKutu[silinenMesajIdx - 1]?.zaman,
            );
            if (digerIdx !== -1) {
              onlarinKutusu.splice(digerIdx, 1);
              sSet(`dm_${aktifSohbetHedef}_${kullaniciId}`, onlarinKutusu);
            }
          }
        } else {
          let gruplar = sGet('gruplar') || [];
          const gIdx = gruplar.findIndex((g) => g.id === aktifSohbetHedef);
          if (gIdx !== -1) {
            if (silinenMesajIdx >= 0 && silinenMesajIdx < gruplar[gIdx].mesajlar.length && gruplar[gIdx].mesajlar[silinenMesajIdx].gonderen === kullaniciId) {
              gruplar[gIdx].mesajlar.splice(silinenMesajIdx, 1);
              sSet('gruplar', gruplar);
            }
          }
        }
        dmMesajSilMenuAcik = false;
        await i.reply({ content: '🗑️ Mesaj silindi.', ephemeral: true });
        await render({ update: async (data) => anaMesaj.edit(data) });
        return;
      }
      if (cId === `kendi_mesajlarimi_sil_${kullaniciId}`) {
        await i.reply({
          content: 'Kendi mesajlarınızı silmek istiyor musunuz? (evet / hayır)',
          ephemeral: true,
        });
        const msgCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 30000,
        });
        msgCol.on('collect', async (m) => {
          m.delete().catch(() => {});
          if (m.content.toLowerCase() === 'evet') {
            if (aktifSohbetTur === 'dm') {
              let benimKutu =
                sGet(`dm_${kullaniciId}_${aktifSohbetHedef}`) || [];
              for (const msg of benimKutu) {
                if (msg.gonderen === kullaniciId && msg.medya) {
                  for (const medyaYolu of msg.medya) {
                    if (fs.existsSync(medyaYolu)) fs.unlinkSync(medyaYolu);
                  }
                }
              }
              benimKutu = benimKutu.filter(
                (msg) => msg.gonderen !== kullaniciId,
              );
              sSet(`dm_${kullaniciId}_${aktifSohbetHedef}`, benimKutu);
              let onlarınKutusu =
                sGet(`dm_${aktifSohbetHedef}_${kullaniciId}`) || [];
              onlarınKutusu = onlarınKutusu.filter(
                (msg) => msg.gonderen !== kullaniciId,
              );
              sSet(`dm_${aktifSohbetHedef}_${kullaniciId}`, onlarınKutusu);
            } else {
              let gruplar = sGet('gruplar') || [];
              const gIdx = gruplar.findIndex((g) => g.id === aktifSohbetHedef);
              if (gIdx !== -1) {
                gruplar[gIdx].mesajlar = gruplar[gIdx].mesajlar.filter(
                  (msg) =>
                    msg.gonderen !== kullaniciId || msg.gonderen === 'sistem',
                );
                sSet('gruplar', gruplar);
              }
            }
          }
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }

      if (cId === `gruptan_cik_${kullaniciId}`) {
        let gruplar = sGet('gruplar') || [];
        const gIdx = gruplar.findIndex((g) => g.id === aktifSohbetHedef);
        if (gIdx !== -1) {
          gruplar[gIdx].uyeler = gruplar[gIdx].uyeler.filter(
            (u) => u !== kullaniciId,
          );
          gruplar[gIdx].mesajlar.push({
            gonderen: 'sistem',
            metin: `<@${kullaniciId}> gruptan ayrıldı.`,
            zaman: Date.now(),
          });
          sSet('gruplar', gruplar);
        }
        mevcutMenu = 'sohbetler';
        await render(i);
        return;
      }

      if (cId === `grubu_sil_${kullaniciId}`) {
        let gruplar = sGet('gruplar') || [];
        const grp = gruplar.find((g) => g.id === aktifSohbetHedef);
        if (grp && grp.sahip === kullaniciId) {
          sSet(
            'gruplar',
            gruplar.filter((g) => g.id !== aktifSohbetHedef),
          );
          const bilgiMesaji = await sosyalKanal.send('🗑️ Grup silindi.');
          setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
        }
        mevcutMenu = 'sohbetler';
        await render(i);
        return;
      }

      if (cId === `grubu_yonet_${kullaniciId}`) {
        mevcutMenu = 'grup_yonet';
        await render(i);
        return;
      }

      if (cId === `grup_at_sec_${kullaniciId}`) {
        const hedefId = degerler[0];
        let gruplar = sGet('gruplar') || [];
        const gIdx = gruplar.findIndex((g) => g.id === mevcutGrupId);
        if (gIdx !== -1) {
          const grp = gruplar[gIdx];
          const adminMi =
            grp.sahip === kullaniciId ||
            (grp.adminler || []).includes(kullaniciId);
          if (adminMi && hedefId !== grp.sahip) {
            gruplar[gIdx].uyeler = gruplar[gIdx].uyeler.filter(
              (u) => u !== hedefId,
            );
            gruplar[gIdx].mesajlar.push({
              gonderen: 'sistem',
              metin: `Bir üye gruptan atıldı.`,
              zaman: Date.now(),
            });
            sSet('gruplar', gruplar);
            bildirimGonder(hedefId, `${grp.ad} grubundan atıldınız.`, 'grup');
            const bilgiMesaji = await sosyalKanal.send(
              '👢 Üye gruptan atıldı.',
            );
            setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
          }
        }
        await render(i);
        return;
      }

      if (cId === `grup_banla_sec_${kullaniciId}`) {
        const hedefId = degerler[0];
        let gruplar = sGet('gruplar') || [];
        const gIdx = gruplar.findIndex((g) => g.id === mevcutGrupId);
        if (gIdx !== -1) {
          const grp = gruplar[gIdx];
          const adminMi =
            grp.sahip === kullaniciId ||
            (grp.adminler || []).includes(kullaniciId);
          if (adminMi && hedefId !== grp.sahip) {
            if (!gruplar[gIdx].banlilar) gruplar[gIdx].banlilar = [];
            if (!gruplar[gIdx].banlilar.includes(hedefId)) {
              gruplar[gIdx].banlilar.push(hedefId);
              gruplar[gIdx].uyeler = gruplar[gIdx].uyeler.filter(
                (u) => u !== hedefId,
              );
              gruplar[gIdx].mesajlar.push({
                gonderen: 'sistem',
                metin: `Bir üye banlandı.`,
                zaman: Date.now(),
              });
              sSet('gruplar', gruplar);
              bildirimGonder(
                hedefId,
                `${grp.ad} grubundan banlandınız.`,
                'grup',
              );
              const bilgiMesaji =
                await sosyalKanal.send('🛡️ Üye banlandı.');
              setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
            }
          }
        }
        await render(i);
        return;
      }

      if (cId === `grup_admin_sec_${kullaniciId}`) {
        const hedefId = degerler[0];
        let gruplar = sGet('gruplar') || [];
        const gIdx = gruplar.findIndex((g) => g.id === mevcutGrupId);
        if (gIdx !== -1 && gruplar[gIdx].sahip === kullaniciId) {
          if (!gruplar[gIdx].adminler) gruplar[gIdx].adminler = [];
          const aIdx = gruplar[gIdx].adminler.indexOf(hedefId);
          if (aIdx === -1) {
            gruplar[gIdx].adminler.push(hedefId);
            bildirimGonder(
              hedefId,
              `${gruplar[gIdx].ad} grubunda admin yapıldınız.`,
              'grup',
            );
            const bilgiMesaji = await sosyalKanal.send(
              '⭐ Admin yetkisi verildi.',
            );
            setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
          } else {
            gruplar[gIdx].adminler.splice(aIdx, 1);
            const bilgiMesaji = await sosyalKanal.send(
              '⭐ Admin yetkisi alındı.',
            );
            setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
          }
          sSet('gruplar', gruplar);
        }
        await render(i);
        return;
      }

      if (cId === `grup_mesaj_sil_sec_${kullaniciId}`) {
        const hedefId = degerler[0];
        let gruplar = sGet('gruplar') || [];
        const gIdx = gruplar.findIndex((g) => g.id === mevcutGrupId);
        if (gIdx !== -1) {
          const grp = gruplar[gIdx];
          const adminMi =
            grp.sahip === kullaniciId ||
            (grp.adminler || []).includes(kullaniciId);
          if (adminMi) {
            gruplar[gIdx].mesajlar = gruplar[gIdx].mesajlar.filter(
              (m) => m.gonderen !== hedefId,
            );
            sSet('gruplar', gruplar);
            const bilgiMesaji = await sosyalKanal.send(
              '🗑️ Kullanıcının mesajları silindi.',
            );
            setTimeout(() => bilgiMesaji.delete().catch(() => {}), 2000);
          }
        }
        await render(i);
        return;
      }

      if (cId === `grup_kur_${kullaniciId}`) {
        await i.reply({ content: '🏛️ Grup adını yazın:', ephemeral: true });
        const gCol = sosyalKanal.createMessageCollector({
          filter: (m) => m.author.id === kullaniciId,
          max: 1,
          time: 30000,
        });
        gCol.on('collect', async (m) => {
          let gruplar = sGet('gruplar') || [];
          gruplar.push({
            id: `grup_${Date.now()}`,
            ad: m.content,
            sahip: kullaniciId,
            adminler: [],
            uyeler: [kullaniciId],
            mesajlar: [],
            banlilar: [],
          });
          sSet('gruplar', gruplar);
          m.delete().catch(() => {});
          mevcutMenu = 'sohbetler';
          await render({ update: async (data) => anaMesaj.edit(data) });
        });
        return;
      }
    } catch (hata) {
      console.error('toplayici hatası:', hata);
    }
  });
};

exports.help = {
  name: 'social',
  aliases: ['desnet', 'sosyal', 'medya'],
  usage: 'social',
  description: 'DesNet Sosyal Medya Ağı',
  category: 'Sosyal',
  cooldown: 5,
};

exports.runFromChannel = async (client, channel, user) => {
  const fakeMessage = {
    channel,
    author: user,
    member: await channel.guild.members.fetch(user.id).catch(() => null),
    guild: channel.guild,
    reply: async (content) => channel.send(typeof content === 'string' ? content : content),
    _sosyalKanalMode: true,
  };
  if (!fakeMessage.member) return;
  await exports.execute(client, fakeMessage, []);
};
