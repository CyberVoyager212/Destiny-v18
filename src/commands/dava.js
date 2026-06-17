const axios = require('axios');
const {
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
  Modal,
  TextInputComponent,
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

let emojis;
try {
  emojis = require('../emoji.json');
} catch (e) {
  emojis = { bot: { succes: '✅', error: '❌' } };
}
const config = require('../botConfig.js');

exports.help = {
  name: 'dava',
  description:
    'Genişletilmiş dedektiflik oyunu. Şüphelileri sorgula, görgü tanığını dinle ve laboratuvarı kullan!',
  usage: 'dava başlat',
  category: 'Yapay Zeka',
  cooldown: 1,
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = config.model;

async function callAI(
  client,
  message,
  messages,
  maxTokens = 1000,
  temperature = 0.7,
) {
  try {
    const aiHelper = require('../utils/aiHelper');
    const aiRes = await aiHelper.requestAI(client, message, {
      messages,
      max_tokens: maxTokens,
      temperature,
    });
    return aiRes;
  } catch (err) {
    console.error('aiHelper call error:', err);
    return { allowed: true, text: null };
  }
}

function formatErrorForUser(member, text) {
  return `${emojis.bot.error} | **${member.displayName}**, ${text}`;
}

async function addToLeaderboard(guildId, userId, username, score, outcome) {
  const entry = { userId, username, score, outcome, at: Date.now() };
  await db.push(`leaderboard_${guildId}`, entry);
}

exports.execute = async (client, message, args) => {
  const COOLDOWN = exports.help.cooldown * 1000;
  const userKey = `game_${message.author.id}`;
  const now = Date.now();
  const last = (await db.get(`${userKey}.last`)) || 0;

  if (now - last < COOLDOWN) {
    const remaining = Math.ceil((COOLDOWN - (now - last)) / 1000);
    return message.reply(
      formatErrorForUser(
        message.member,
        `lütfen biraz yavaş ol~ ${remaining} saniye sonra tekrar deneyebilirsin.`,
      ),
    );
  }
  await db.set(`${userKey}.last`, now);

  const isActive = (await db.get(`${userKey}.active`)) || false;
  if (isActive) {
    return message.reply(
      formatErrorForUser(
        message.member,
        'Zaten masanda açık bir dosya var komiserim! Önce onu çözmelisin.',
      ),
    );
  }

  if (!args[0] || args[0].toLowerCase() !== 'başlat') {
    return message.reply(
      formatErrorForUser(
        message.member,
        'Yeni bir dava açmak için `dava başlat` yazmalısın.',
      ),
    );
  }

  const API_KEY =
    client.config?.GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    config.GROQ_API_KEY;
  if (!API_KEY) {
    return message.reply(
      `${emojis.bot.error} | **HATA:** GROQ API anahtarı ayarlı değil.`,
    );
  }

  const suspects = ['A', 'B', 'C', 'D'];
  const correct = suspects[Math.floor(Math.random() * suspects.length)];

  const SYSTEM_PROMPT = `Sen bir interaktif dedektiflik oyununun zeki oyun kurucusu ve tüm karakterlerisin. 
Karşındaki oyuncu davayı çözmeye çalışan "Komiser". 
Olay: Şehir merkezindeki lüks bir otel odasında zengin bir iş insanı ölü bulundu.

KADRO:
- Şüpheli A: Kurbanın eski iş ortağı (Agresif, sabırsız, alacaklı).
- Şüpheli B: Kurbanın asistanı (Gergin, bir şeyler saklıyor gibi çekingen).
- Şüpheli C: Rakip şirket yöneticisi (Soğukkanlı, kibirli, alaycı).
- Şüpheli D: Otelin gece güvenliği (Uykusuz, umursamaz ama kameralara erişimi var).
- Görgü Tanığı: Olay gecesi koridorda dolaşan gizemli bir otel müşterisi. (Not: Görgü tanığı yalan söylüyor veya hedef saptırıyor olabilir. Buna sen kurguya göre karar ver).
- Kriminal Laboratuvar: Komiser parmak izi/eşya analizi istediğinde adli tıp uzmanı gibi kısa ve kesin raporlar ver.

GİZLİ BİLGİ (Komisere ASLA doğrudan söyleme): GERÇEK SUÇLU ŞÜPHELİ ${correct}. Diğerleri masum ama sırları var.

KURALLAR:
1. Oyun boyunca kurguya sadık kal. Komiser kiminle konuştuğunu (Şüpheli, Tanık, Lab) belirtirse o karaktere bürün.
2. Karakterlerin yanıtları çok kısa, net ve sürükleyici olsun (Maksimum 2-3 cümle). Asla uzun hikayeler anlatma.
3. Kriminal Lab sonuçlarında, eşya gerçek suçluya (${correct}) aitse pozitif, değilse negatif eşleşme ver.
4. Verdiğin bilgilerin hepsi kurgu içinde birbiriyle tutarlı olsun. Oyunu hızlı, gizemli ve heyecanlı tut.`;

  let gameHistory = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        'Komiser olay yerine (otel odası) yeni geldi. Lütfen kurbanın durumunu, ortamı ve olayın girişini çok kısa (2 paragraf), merak uyandırıcı bir dille bana raporla.',
    },
  ];

  const summaryMessage = await message.reply(
    `${emojis.bot.succes} | Dava dosyaları ve kriminal laboratuvar hazırlanıyor komiserim...`,
  );

  const aiRes = await callAI(client, message, gameHistory);
  if (!aiRes.allowed) {
    await summaryMessage.edit(aiRes.reason);
    setTimeout(() => {
      message.delete().catch(() => {});
      summaryMessage.delete().catch(() => {});
    }, 5000);
    return;
  }
  const summary = aiRes.text;
  if (!summary) {
    return summaryMessage.edit(
      `${emojis.bot.error} | **Dosya oluşturulamadı.** AI servisinde bir sorun var.`,
    );
  }

  gameHistory.push({ role: 'assistant', content: summary });

  await db.set(`${userKey}.active`, true);
  await db.set(`${userKey}.correct`, correct);
  await db.set(`${userKey}.history`, gameHistory);
  await db.set(`${userKey}.score`, 0);

  const limits = { A: 0, B: 0, C: 0, D: 0, Tanık: 0, Lab: 0 };
  await db.set(`${userKey}.limits`, limits);

  const embed = new MessageEmbed()
    .setTitle(`🔍 Cinayet Bürosu - Yeni Dava`)
    .setDescription(summary)
    .setColor('#2F3136')
    .setFooter({
      text: "Tanıklara soru sor, olay yerini incele veya delilleri Kriminal Lab'a gönder!",
    })
    .setTimestamp();

  const row1 = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId('ask_A')
      .setLabel('Sorgu: A')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId('ask_B')
      .setLabel('Sorgu: B')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId('ask_C')
      .setLabel('Sorgu: C')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId('ask_D')
      .setLabel('Sorgu: D')
      .setStyle('PRIMARY'),
    new MessageButton()
      .setCustomId('ask_Tanık')
      .setLabel('Görgü Tanığı')
      .setStyle('SUCCESS'),
  );

  const row2 = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId('investigate_scene')
      .setLabel('Olay Yeri İnceleme')
      .setStyle('SECONDARY'),
    new MessageButton()
      .setCustomId('investigate_lab')
      .setLabel('Kriminal Laboratuvar (Parmak İzi)')
      .setStyle('SUCCESS'),
    new MessageButton()
      .setCustomId('cancel_game')
      .setLabel('Davayı Kapat')
      .setStyle('DANGER'),
  );

  const row3 = new MessageActionRow().addComponents(
    new MessageSelectMenu()
      .setCustomId('accuse')
      .setPlaceholder('Kelepçeyi Kim Takacak? (Karar Vakti!)')
      .addOptions([
        { label: 'Şüpheli A', value: 'A' },
        { label: 'Şüpheli B', value: 'B' },
        { label: 'Şüpheli C', value: 'C' },
        { label: 'Şüpheli D', value: 'D' },
      ]),
  );

  const sent = await summaryMessage.edit({
    content: null,
    embeds: [embed],
    components: [row1, row2, row3],
  });

  const filter = (i) => i.user.id === message.author.id;
  const collector = sent.createMessageComponentCollector({
    filter,
    time: 900000,
  });

  collector.on('collect', async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith('ask_')) {
        const target = interaction.customId.split('_')[1];
        const currentLimits = await db.get(`${userKey}.limits`);

        if (currentLimits[target] >= 3) {
          return interaction.reply({
            content: `${emojis.bot.error} | Komiserim, ${target} artık konuşmak istemiyor. (3/3 soru hakkı doldu)`,
            ephemeral: true,
          });
        }

        const modal = new Modal()
          .setCustomId(`modal_ask_${target}`)
          .setTitle(`${target} Sorgusu`);

        const questionInput = new TextInputComponent()
          .setCustomId('question_input')
          .setLabel('Komiser olarak sorunuzu yazın:')
          .setStyle('PARAGRAPH')
          .setMaxLength(300)
          .setRequired(true);

        modal.addComponents(
          new MessageActionRow().addComponents(questionInput),
        );
        await interaction.showModal(modal);

        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            filter: (i) =>
              i.customId === `modal_ask_${target}` &&
              i.user.id === message.author.id,
            time: 60000,
          });

          await modalSubmit.deferReply({ ephemeral: true });
          const userQuestion =
            modalSubmit.fields.getTextInputValue('question_input');

          let history = await db.get(`${userKey}.history`);
          history.push({
            role: 'user',
            content: `Komiserin ${target}'e sorusu: "${userQuestion}" (Kısa ve inandırıcı cevap ver. Tanık ise yalan söyleyip söylemediği kurguna bağlı olsun.)`,
          });

          const aiRes = await callAI(client, message, history);
          if (!aiRes.allowed) return modalSubmit.editReply(aiRes.reason);
          const aiAnswer = aiRes.text;
          if (!aiAnswer)
            return modalSubmit.editReply(
              `${emojis.bot.error} | Bağlantı koptu...`,
            );

          history.push({ role: 'assistant', content: aiAnswer });
          await db.set(`${userKey}.history`, history);

          currentLimits[target] += 1;
          await db.set(`${userKey}.limits`, currentLimits);

          const answerEmbed = new MessageEmbed()
            .setTitle(`Sorgu: ${target} (${currentLimits[target]}/3)`)
            .setDescription(
              `**Sizin Sorunuz:**\n"${userQuestion}"\n\n**${target}:**\n"${aiAnswer}"`,
            )
            .setColor(target === 'Tanık' ? '#2ECC71' : '#FFA500');

          return modalSubmit.editReply({ embeds: [answerEmbed] });
        } catch (err) {
          return;
        }
      }

      if (interaction.customId === 'investigate_lab') {
        const currentLimits = await db.get(`${userKey}.limits`);
        if (currentLimits.Lab >= 2) {
          return interaction.reply({
            content: `${emojis.bot.error} | Laboratuvar şu an çok yoğun komiserim, analiz hakkınız doldu!`,
            ephemeral: true,
          });
        }

        const modal = new Modal()
          .setCustomId('modal_lab')
          .setTitle('Kriminal Delil Analizi');

        const evidenceInput = new TextInputComponent()
          .setCustomId('evidence_input')
          .setLabel('Hangi delili inceliyoruz? (Örn: Cam Bardak)')
          .setStyle('SHORT')
          .setRequired(true);

        const suspectInput = new TextInputComponent()
          .setCustomId('suspect_input')
          .setLabel('Kiminle eşleşsin? (A, B, C veya D)')
          .setStyle('SHORT')
          .setMaxLength(1)
          .setRequired(true);

        modal.addComponents(
          new MessageActionRow().addComponents(evidenceInput),
          new MessageActionRow().addComponents(suspectInput),
        );

        await interaction.showModal(modal);

        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            filter: (i) =>
              i.customId === 'modal_lab' && i.user.id === message.author.id,
            time: 60000,
          });

          await modalSubmit.deferReply({ ephemeral: true });
          const evidence =
            modalSubmit.fields.getTextInputValue('evidence_input');
          const targetSuspect = modalSubmit.fields
            .getTextInputValue('suspect_input')
            .toUpperCase();

          let history = await db.get(`${userKey}.history`);
          history.push({
            role: 'user',
            content: `Kriminal Laboratuvar Uzmanı: Komiser "${evidence}" üzerindeki parmak izi/DNA izlerini Şüpheli ${targetSuspect} ile karşılaştırmamızı istiyor. Kurguya ve gerçek suçluya göre uyum var mı yok mu? Sadece kısa ve bilimsel bir rapor sun.`,
          });

          const aiRes = await callAI(client, message, history);
          if (!aiRes.allowed) return modalSubmit.editReply(aiRes.reason);
          const labReport = aiRes.text;
          if (!labReport)
            return modalSubmit.editReply(
              `${emojis.bot.error} | Laboratuvar sonuçları gecikti...`,
            );

          history.push({ role: 'assistant', content: labReport });
          await db.set(`${userKey}.history`, history);

          currentLimits.Lab += 1;
          await db.set(`${userKey}.limits`, currentLimits);

          const labEmbed = new MessageEmbed()
            .setTitle(`🔬 Kriminal Rapor - Analiz (${currentLimits.Lab}/2)`)
            .addField('İncelenen Delil', evidence, true)
            .addField('Hedef Şüpheli', `Şüpheli ${targetSuspect}`, true)
            .setDescription(`**Uzman Görüşü:**\n${labReport}`)
            .setColor('#9B59B6');

          return modalSubmit.editReply({ embeds: [labEmbed] });
        } catch (err) {
          return;
        }
      }

      if (interaction.customId === 'investigate_scene') {
        await interaction.deferReply({ ephemeral: true });

        let savedReport = await db.get(`${userKey}.sceneReport`);

        if (savedReport) {
          const sceneEmbed = new MessageEmbed()
            .setTitle(`${emojis.bot.succes} | Olay Yeri Raporu (Arşiv)`)
            .setDescription(savedReport)
            .setColor('#00BFFF')
            .setFooter({
              text: 'Olay yeri zaten incelendi, bu önceki rapordur.',
            });

          return interaction.editReply({ embeds: [sceneEmbed] });
        }

        let history = await db.get(`${userKey}.history`);
        history.push({
          role: 'user',
          content:
            'Komiser olay yerini inceliyor. Lütfen gözden kaçmış olabilecek, şüphelilere (A, B, C, D) işaret eden 3 somut eşya/iz listele.',
        });

        const aiRes = await callAI(client, message, history);
        if (!aiRes.allowed) return interaction.editReply(aiRes.reason);
        const sceneReport = aiRes.text;
        if (!sceneReport)
          return interaction.editReply(
            `${emojis.bot.error} | Olay yerine girilemiyor, bağlantı koptu...`,
          );

        history.push({ role: 'assistant', content: sceneReport });
        await db.set(`${userKey}.history`, history);
        await db.set(`${userKey}.sceneReport`, sceneReport);

        const sceneEmbed = new MessageEmbed()
          .setTitle(`${emojis.bot.succes} | Olay Yeri Raporu`)
          .setDescription(sceneReport)
          .setColor('#00BFFF');

        return interaction.editReply({ embeds: [sceneEmbed] });
      }

      if (interaction.isSelectMenu() && interaction.customId === 'accuse') {
        await interaction.deferReply({ ephemeral: false });
        const choice = interaction.values[0];
        const correctSuspect = await db.get(`${userKey}.correct`);

        let resultEmbed;
        if (choice === correctSuspect) {
          await db.add(`${userKey}.score`, 15);
          resultEmbed = new MessageEmbed()
            .setTitle(`${emojis.bot.succes} | Dosya Kapatıldı: Başarı!`)
            .setDescription(
              `Harika iş çıkardınız Komiserim! Katil gerçekten de **Şüpheli ${choice}** idi. Tüm delilleri mükemmel birleştirdiniz.\n\n*(+15 Puan)*`,
            )
            .setColor('GREEN');
          await addToLeaderboard(
            message.guild.id,
            message.author.id,
            message.member.displayName,
            15,
            'win',
          );
        } else {
          resultEmbed = new MessageEmbed()
            .setTitle(`${emojis.bot.error} | Adalet Yanıltıldı...`)
            .setDescription(
              `Yanlış kişiyi tutukladınız. Gerçek katil **Şüpheli ${correctSuspect}** kaçmayı başardı. Üstleriniz bu duruma hiç sevinmeyecek.\n\n*(-5 Puan)*`,
            )
            .setColor('RED');
          await db.sub(`${userKey}.score`, 5);
          await addToLeaderboard(
            message.guild.id,
            message.author.id,
            message.member.displayName,
            -5,
            'lose',
          );
        }

        await db.set(`${userKey}.active`, false);
        await sent.edit({ components: [] });
        collector.stop('accused');
        return interaction.editReply({ embeds: [resultEmbed] });
      }

      if (interaction.customId === 'cancel_game') {
        await db.delete(userKey);
        await sent.edit({ components: [] });
        collector.stop('cancelled');
        return interaction.reply({
          content: `${emojis.bot.succes} | Dava dosyası rafa kaldırıldı komiserim.`,
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error(err);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: `${emojis.bot.error} | Beklenmedik bir hata oluştu~`,
            ephemeral: true,
          });
        } catch (e) {}
      }
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'time') {
      await db.set(`${userKey}.active`, false);
      try {
        await sent.edit({
          components: [],
          content: '⏳ Oyun süresi doldu, katil çoktan şehri terk etti!',
        });
      } catch (e) {}
    }
  });
};
