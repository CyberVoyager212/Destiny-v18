const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const emojis = require("../emoji.json");

let questions = [
    { question: "Kuantum fiziğinde, gözlemcinin sistemi nasıl etkilediğini açıklayan kavram nedir?", options: { A: "Süperpozisyon", B: "Örüntüleme", C: "Kuantum Dolanıklığı", D: "Gözlemci Etkisi" }, correct: "D" },
    { question: "'Gödel'in Eksiksizsizlik Teoremi' neyi ifade eder?", options: { A: "Tüm matematiksel ifadelerin doğrulanabilir olduğunu", B: "Her tutarlı biçimsel sistemin karar verilemez ifadeler içerdiğini", C: "Tüm doğa yasalarının birleşik bir teoride açıklanabileceğini", D: "Zaman yolculuğunun mümkün olduğunu" }, correct: "B" },
    { question: "Evrenin genişlemesinin hızlanmasından sorumlu olduğu düşünülen gizemli enerji türü nedir?", options: { A: "Kara madde", B: "Kara enerji", C: "Nükleer enerji", D: "Kinetik enerji" }, correct: "B" },
    { question: "Hangi felsefi akım, 'Varlık özden önce gelir' ilkesini savunur?", options: { A: "Nihilizm", B: "Rasyonalizm", C: "Egzistansiyalizm", D: "Hedonizm" }, correct: "C" },
    { question: "James Joyce'un 'Ulysses' romanı hangi şehrin bir gününü anlatır?", options: { A: "Londra", B: "Dublin", C: "Paris", D: "New York" }, correct: "B" },
    { question: "Periyodik tabloda atom numarası 100 olan element hangisidir?", options: { A: "Fermiyum", B: "Nobelyum", C: "Mendelevyum", D: "Einsteinium" }, correct: "A" },
    { question: "I. Dünya Savaşı'nı resmen bitiren antlaşma hangisidir?", options: { A: "Mondros", B: "Lozan", C: "Versay", D: "Sevr" }, correct: "C" },
    { question: "Hangi matematikçi 'Oyun Teorisi'nin kurucusu olarak kabul edilir?", options: { A: "Alan Turing", B: "John Nash", C: "Isaac Newton", D: "John von Neumann" }, correct: "D" },
    { question: "Divan edebiyatında 'Şairler Sultanı' olarak bilinen sanatçı kimdir?", options: { A: "Fuzuli", B: "Baki", C: "Nedim", D: "Nef'i" }, correct: "B" },
    { question: "Olay ufkundan kaçışın imkansız olduğu gök cismi hangisidir?", options: { A: "Beyaz Cüce", B: "Nötron Yıldızı", C: "Kara Delik", D: "Kuasar" }, correct: "C" },
    { question: "Schrödinger'in Kedisi deneyi hangi durumu açıklamak için kullanılır?", options: { A: "Entropi", B: "Kuantum Süperpozisyonu", C: "Görelilik", D: "Termodinamik" }, correct: "B" },
    { question: "Napolyon Bonapart hangi savaşta kesin bir yenilgi almıştır?", options: { A: "Austerlitz", B: "Waterloo", C: "Borodino", D: "Marengo" }, correct: "B" },
    { question: "DNA'nın çift sarmal yapısını keşfeden isimler kimlerdir?", options: { A: "Pasteur & Koch", B: "Watson & Crick", C: "Tesla & Edison", D: "Curie & Becquerel" }, correct: "B" },
    { question: "Fizikte 'Güç' birimi nedir?", options: { A: "Joule", B: "Newton", C: "Watt", D: "Pascal" }, correct: "C" },
    { question: "Mona Lisa tablosu hangi müzede sergilenmektedir?", options: { A: "British Museum", B: "Louvre Museum", C: "Prado", D: "Metropolitan" }, correct: "B" },
    { question: "Türkiye'nin ilk kadın pilotu kimdir?", options: { A: "Sabiha Gökçen", B: "Leman Bozkurt", C: "Feriha Sanerk", D: "Bedriye Tahir" }, correct: "D" },
    { question: "Pi sayısının virgülden sonraki ilk 5 hanesi nedir?", options: { A: "14159", B: "14265", C: "14168", D: "14592" }, correct: "A" },
    { question: "Klasik müzikte 'Ayışığı Sonatı' kimin eseridir?", options: { A: "Mozart", B: "Bach", C: "Beethoven", D: "Chopin" }, correct: "C" },
    { question: "İstiklal Marşı hangi yıl kabul edilmiştir?", options: { A: "1920", B: "1921", C: "1923", D: "1924" }, correct: "B" },
    { question: "Dante'nin 'İlahi Komedya' eserinde rehberlik eden şair kimdir?", options: { A: "Homer", B: "Virgilius", C: "Ovidius", D: "Petrarca" }, correct: "B" },
    { question: "Dünyanın en derin noktası olan Mariana Çukuru hangi okyanustadır?", options: { A: "Hint", B: "Atlas", C: "Pasifik", D: "Arktik" }, correct: "C" },
    { question: "Güneş sistemindeki en sıcak gezegen hangisidir?", options: { A: "Merkür", B: "Venüs", C: "Mars", D: "Jüpiter" }, correct: "B" },
    { question: "Türkiye'nin en yüksek dağı hangisidir?", options: { A: "Erciyes", B: "Ağrı", C: "Süphan", D: "Kaçkar" }, correct: "B" },
    { question: "Kan gruplarını keşfeden bilim insanı kimdir?", options: { A: "Landsteiner", B: "Fleming", C: "Mendel", D: "Darwin" }, correct: "A" },
    { question: "Rus edebiyatının dev ismi Dostoyevski'nin ilk romanı hangisidir?", options: { A: "Suç ve Ceza", B: "İnsancıklar", C: "Budala", D: "Kumarbaz" }, correct: "B" },
    { question: "Nobel ödülleri hangi ülkede verilmektedir?", options: { A: "Norveç & İsveç", B: "Danimarka", C: "İsviçre", D: "Finlandiya" }, correct: "A" },
    { question: "Hangi element oda sıcaklığında sıvı haldedir?", options: { A: "Azot", B: "Cıva", C: "Sodyum", D: "Galyum" }, correct: "B" },
    { question: "Türk tarihinin ilk yazılı belgeleri hangisidir?", options: { A: "Orhun Yazıtları", B: "Divan-ı Lügatit Türk", C: "Atabetü'l Hakayık", D: "Kutadgu Bilig" }, correct: "A" },
    { question: "İnsan vücudundaki en küçük kemik nerededir?", options: { A: "Burun", B: "Kulak", C: "El Bileği", D: "Ayak Parmağı" }, correct: "B" },
    { question: "Osmanlı Devleti'nde 'Lale Devri' hangi padişah dönemindedir?", options: { A: "III. Ahmed", B: "II. Mahmud", C: "IV. Murad", D: "I. Abdülhamid" }, correct: "A" },
    { question: "Satürn'ün en büyük uydusu hangisidir?", options: { A: "Europa", B: "Titan", C: "Ganymede", D: "Io" }, correct: "B" },
    { question: "Hücrenin enerji santrali olarak bilinen organel nedir?", options: { A: "Ribozom", B: "Lizozom", C: "Mitokondri", D: "Koful" }, correct: "C" },
    { question: "Prizmalar ışığı hangi fiziksel olayla renklerine ayırır?", options: { A: "Yansıma", B: "Kırılma", C: "Soğurulma", D: "Girişim" }, correct: "B" },
    { question: "Modern kimyanın babası sayılan bilim insanı kimdir?", options: { A: "Lavoisier", B: "Dalton", C: "Boyle", D: "Avogadro" }, correct: "A" },
    { question: "Uluğ Bey hangi Türk devletinin hükümdarı ve gökbilimcisidir?", options: { A: "Selçuklu", B: "Osmanlı", C: "Timur", D: "Babür" }, correct: "C" },
    { question: "Bir ışık yılı yaklaşık kaç kilometredir?", options: { A: "9.5 Trilyon", B: "1 Trilyon", C: "150 Milyon", D: "500 Milyar" }, correct: "A" },
    { question: "Fatih Sultan Mehmet kaç dil biliyordu?", options: { A: "3", B: "4", C: "6", D: "2" }, correct: "C" },
    { question: "Işık hızı saniyede yaklaşık kaç metredir?", options: { A: "300.000", B: "300.000.000", C: "3.000.000", D: "30.000" }, correct: "B" },
    { question: "Hangi vitamin güneş ışığı yardımıyla sentezlenir?", options: { A: "A", B: "B12", C: "C", D: "D" }, correct: "D" },
    { question: "Atatürk'ün nüfusa kayıtlı olduğu il hangisidir?", options: { A: "İstanbul", B: "Ankara", C: "Gaziantep", D: "Selanik" }, correct: "C" },
    { question: "Don Kişot romanının yazarı kimdir?", options: { A: "Cervantes", B: "Shakespeare", C: "Moliere", D: "Dante" }, correct: "A" },
    { question: "Dünyanın en küçük ülkesi hangisidir?", options: { A: "Monako", B: "Vatikan", C: "San Marino", D: "Malta" }, correct: "B" },
    { question: "Periyodik tabloda 'Au' simgesi hangi elemente aittir?", options: { A: "Gümüş", B: "Bakır", C: "Altın", D: "Platin" }, correct: "C" },
    { question: "Brezilya'nın başkenti neresidir?", options: { A: "Rio de Janeiro", B: "Sao Paulo", C: "Brasilia", D: "Salvador" }, correct: "C" },
    { question: "En çok uydusu olan gezegen (2024 verilerine göre) hangisidir?", options: { A: "Jüpiter", B: "Satürn", C: "Neptün", D: "Uranüs" }, correct: "B" },
    { question: "Türkiye'nin üye olmadığı kuruluş hangisidir?", options: { A: "NATO", B: "Avrupa Birliği", C: "OECD", D: "İslam İşbirliği Teşkilatı" }, correct: "B" },
    { question: "Safra sıvısı nerede üretilir?", options: { A: "Mide", B: "Pankreas", C: "Karaciğer", D: "İnce Bağırsak" }, correct: "C" },
    { question: "Hangi gaz atmosferde en yüksek oranda bulunur?", options: { A: "Oksijen", B: "Karbondioksit", C: "Azot", D: "Argon" }, correct: "C" },
    { question: "Modern fiziğin kurucusu sayılan 'Max Planck' hangi alanda Nobel almıştır?", options: { A: "Kuantum Kuramı", B: "Fotoelektrik Etki", C: "X-Işınları", D: "Radyoaktivite" }, correct: "A" },
    { question: "Yedi Harika'dan günümüze ulaşan tek yapı hangisidir?", options: { A: "Rodos Heykeli", B: "Babil'in Asma Bahçeleri", C: "Keops Piramidi", D: "Artemis Tapınağı" }, correct: "C" }
];

exports.execute = async (client, message, args) => {
    const authorId = message.author.id;

    try {
        if (questions.length === 0) {
            return message.reply(`${emojis.bot.error} | Ahh, **${message.member?.displayName || message.author.username}**, tüm sorular cevaplanmış! Botun yeniden başlamasını bekle~`);
        }

        const randomIndex = Math.floor(Math.random() * questions.length);
        const questionData = questions[randomIndex];

        const embed = new MessageEmbed()
            .setTitle("📚 Bilgi Sorusu (Zor)")
            .setDescription(`**Soru:**\n${questionData.question}`)
            .addFields(
                { name: "A)", value: questionData.options.A, inline: true },
                { name: "B)", value: questionData.options.B, inline: true },
                { name: "C)", value: questionData.options.C, inline: true },
                { name: "D)", value: questionData.options.D, inline: true }
            )
            .setColor("DARK_PURPLE")
            .setFooter({ text: `Sadece ${message.author.username} cevaplayabilir. • Süre: 60 saniye` })
            .setTimestamp();

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId("A").setLabel("A").setStyle("PRIMARY"),
            new MessageButton().setCustomId("B").setLabel("B").setStyle("PRIMARY"),
            new MessageButton().setCustomId("C").setLabel("C").setStyle("PRIMARY"),
            new MessageButton().setCustomId("D").setLabel("D").setStyle("PRIMARY")
        );

        const sentMessage = await message.channel.send({
            content: `${emojis.bot.succes} | Bir soru hazırladım, bakalım bilebilecek misin?`,
            embeds: [embed],
            components: [row],
        });

        const filter = (interaction) => interaction.user.id === authorId; 

        const collector = sentMessage.createMessageComponentCollector({
            filter,
            time: 60000,
            max: 1
        });

        collector.on("collect", async (interaction) => {
            const isCorrect = interaction.customId === questionData.correct;

            const resultEmbed = new MessageEmbed()
                .setTitle(isCorrect ? `${emojis.bot.succes} Tebrikler!` : `${emojis.bot.error} Maalesef Yanlış...`)
                .setDescription(`**Soru:** ${questionData.question}\n\n**Senin Cevabın:** ${interaction.customId}\n**Doğru Cevap:** ${questionData.correct}\n\n${isCorrect ? "Harikasın! Bu zor soruyu doğru bildin." : "Tüh, bir dahaki sefere daha dikkatli ol!"}`)
                .setColor(isCorrect ? "GREEN" : "RED")
                .setTimestamp();

            await interaction.update({ embeds: [resultEmbed], components: [] });
            collector.stop("answered");
        });

        collector.on("end", async (collected, reason) => {
            if (reason === "time") {
                const timeOutEmbed = new MessageEmbed()
                    .setTitle(`${emojis.bot.error} | Süre Doldu!`)
                    .setDescription(`Üzgünüm, cevap vermen için tanınan 60 saniye doldu.\n\n**Doğru Cevap:** ${questionData.correct}`)
                    .setColor("ORANGE");

                await sentMessage.edit({ embeds: [timeOutEmbed], components: [] }).catch(() => {});
            }
        });

        questions.splice(randomIndex, 1); 
    } catch (error) {
        console.error("bilgisorusu komutu hatası:", error);
        return message.reply(`${emojis.bot.error} | Ayy, bir sorun çıktı~`);
    }
};

exports.help = {
    name: "bilgisorusu",
    aliases: ["triviasoru", "bsoru"],
    usage: "bilgisorusu",
    description: "Zor seviye Türkçe bilgi sorusu sorar.",
    category: "Eğlence",
    cooldown: 10,
};