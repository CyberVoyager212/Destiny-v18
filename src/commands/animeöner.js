const { MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");
const emojis = require("../emoji.json");

const defaultAnimes = [
  "Fullmetal Alchemist: Brotherhood", "Death Note", "Attack on Titan", "Steins;Gate", 
  "Hunter x Hunter", "Naruto: Shippuden", "One Piece", "Bleach", "Sword Art Online", 
  "My Hero Academia", "Demon Slayer", "Jujutsu Kaisen", "Tokyo Ghoul", "One Punch Man", 
  "Mob Psycho 100", "Cowboy Bebop", "Neon Genesis Evangelion", "Code Geass", 
  "Gurren Lagann", "Fate/Zero", "No Game No Life", "Re:Zero", "Konosuba", 
  "Overlord", "The Rising of the Shield Hero", "That Time I Got Reincarnated as a Slime", 
  "Mushoku Tensei", "Vinland Saga", "Chainsaw Man", "Spy x Family", 
  "Cyberpunk: Edgerunners", "Your Lie in April", "Violet Evergarden", "Clannad: After Story", 
  "Toradora!", "Kaguya-sama: Love is War", "Fruits Basket", "Haikyuu!!", 
  "Kuroko no Basket", "Blue Lock", "Death Parade", "Psycho-Pass", "Parasyte: The Maxim", 
  "Made in Abyss", "Dr. Stone", "Black Clover", "Fairy Tail", 
  "JoJo's Bizarre Adventure", "Hellsing Ultimate", "Gintama", "Monster", 
  "Erased", "Akame ga Kill!", "Noragami", "Kakegurui",
  
  "Dragon Ball", "Dragon Ball Z", "Dragon Ball Super", "Yu Yu Hakusho", "Rurouni Kenshin",
  "Inuyasha", "Shaman King", "D.Gray-man", "Soul Eater", "Blue Exorcist",
  "The Seven Deadly Sins", "Magi: The Labyrinth of Magic", "Magi: The Kingdom of Magic", "Fire Force", "Record of Ragnarok",
  "Baki", "Kengan Ashura", "Tokyo Revengers", "Bungo Stray Dogs", "Black Lagoon",
  "Jormungand", "Gangsta.", "91 Days", "Baccano!", "Durarara!!",
  "Kill la Kill", "Akudama Drive", "Dorohedoro", "Golden Kamuy", "Hell's Paradise",
  "Mashle: Magic and Muscles", "Zom 100: Bucket List of the Dead", "Btooom!", "Highschool of the Dead", "Seraph of the End",
  "World Trigger", "Guilty Crown", "K", "Darker than Black", "Elfen Lied",
  "Mirai Nikki", "Deadman Wonderland", "Claymore", "Berserk", "Gantz",

  "Log Horizon", "Grimgar of Fantasy and Ash", "Sword Art Online II", "Sword Art Online: Alicization", "Is It Wrong to Try to Pick Up Girls in a Dungeon?",
  "The Devil is a Part-Timer!", "The Eminence in Shadow", "Cautious Hero: The Hero Is Overpowered but Overly Cautious", "Arifureta: From Commonplace to World's Strongest", "So I'm a Spider, So What?",
  "TsukiMichi: Moonlit Fantasy", "Campfire Cooking in Another World with My Absurd Skill", "Uncle from Another World", "How Not to Summon a Demon Lord", "Death March to the Parallel World Rhapsody",
  "In Another World With My Smartphone", "Wise Man's Grandchild", "The World's Finest Assassin Gets Reincarnated in Another World as an Aristocrat", "Re:Creators", "Gate",
  "Outbreak Company", "Problem Children Are Coming From Another World, Aren't They?", "The Familiar of Zero", "Shakugan no Shana", "A Certain Magical Index",
  "A Certain Scientific Railgun", "A Certain Scientific Accelerator", "Little Witch Academia", "The Ancient Magus' Bride", "Frieren: Beyond Journey's End",
  "Ranking of Kings", "To Your Eternity", "Someday's Dreamers", "Flying Witch", "Wandering Witch: The Journey of Elaina",
  "Ascendance of a Bookworm", "My Next Life as a Villainess: All Routes Lead to Doom!", "I'm the Villainess, So I'm Taming the Final Boss", "Tearmoon Empire", "The Misfit of Demon King Academy",
  "The Irregular at Magic High School", "Chivalry of a Failed Knight", "The Asterisk War", "Campione!", "Strike the Blood",
  "High School DxD", "Trinity Seven", "Date A Live", "Sekirei", "Oregairu: My Teen Romantic Comedy SNAFU",

  "Horimiya", "Rent-a-Girlfriend", "The Quintessential Quintuplets", "Nisekoi", "Kimi ni Todoke: From Me to You",
  "Kaichou wa Maid-sama!", "Say \"I Love You\"", "My Little Monster", "Blue Spring Ride", "Orange",
  "Rascal Does Not Dream of Bunny Girl Senpai", "The Pet Girl of Sakurasou", "Golden Time", "Lovely Complex", "Itazura na Kiss",
  "Snow White with the Red Hair", "Yona of the Dawn", "Kamisama Kiss", "Spice and Wolf", "My Dress-Up Darling",
  "Komi Can't Communicate", "Don't Toy with Me, Miss Nagatoro", "Teasing Master Takagi-san", "Uzaki-chan Wants to Hang Out!", "Tomo-chan Is a Girl!",
  "The Dangers in My Heart", "Wotakoi: Love is Hard for Otaku", "Recovery of an MMO Junkie", "Tsuredure Children", "Monthly Girls' Nozaki-kun",
  "Tada Never Falls in Love", "Boarding School Juliet", "Yamada-kun and the Seven Witches", "Kokoro Connect", "Plastic Memories",
  "Angel Beats!", "Charlotte", "The Day I Became a God", "Anohana: The Flower We Saw That Day", "Clannad",
  "Kanon", "Air", "White Album 2", "Scum's Wish", "Domestic Girlfriend",
  "School Days", "Nana", "Paradise Kiss", "Honey and Clover", "Nichijou: My Ordinary Life",

  "Azumanga Daioh", "K-On!", "Lucky Star", "Non Non Biyori", "Laid-Back Camp (Yuru Camp)",
  "A Place Further Than the Universe", "Barakamon", "Usagi Drop", "Sweetness & Lightning", "Hinamatsuri",
  "Daily Lives of High School Boys", "Asobi Asobase", "Grand Blue Dreaming", "Prison School", "Shimoneta",
  "Seitokai Yakuindomo", "D-Frag!", "Baka and Test", "The Disastrous Life of Saiki K.", "Haven't You Heard? I'm Sakamoto",
  "Clean Freak! Aoyama-kun", "Handa-kun", "Tanaka-kun is Always Listless", "Sleepy Princess in the Demon Castle", "Gabriel DropOut",
  "Blend S", "Working!!", "Servant x Service", "Shirobako", "Bakuman.",
  "New Game!", "Keep Your Hands Off Eizouken!", "Comic Girls", "Miss Kobayashi's Dragon Maid", "The Helpful Fox Senko-san",
  "The Way of the Househusband", "Kakushigoto", "March Comes In Like a Lion", "Chihayafuru", "Nodame Cantabile",
  "Kids on the Slope", "Beck: Mongolian Chop Squad", "Carole & Tuesday", "Ya Boy Kongming!", "Kono Oto Tomare! Sounds of Life",
  "Tari Tari", "Hanasaku Iroha", "Sakura Quest", "Shirokuma Cafe", "Slam Dunk",

  "Hajime no Ippo", "Ace of Diamond", "Major", "Cross Game", "Touch",
  "Ping Pong the Animation", "Yuri!!! on Ice", "Free!", "Tsurune", "Run with the Wind",
  "The Prince of Tennis", "Baby Steps", "Hanebado!", "Yowamushi Pedal", "Initial D",
  "Wangan Midnight", "Capeta", "Megalo Box", "Ashita no Joe", "Air Gear",
  "SK8 the Infinity", "Burning Kabaddi", "Hinomaru Sumo", "All Out!!", "Eyeshield 21",
  "Captain Tsubasa", "Inazuma Eleven", "Ao Ashi", "Giant Killing", "Days",
  "Ro-Kyu-Bu!", "Ahiru no Sora", "Dear Boys", "Iwa Kakeru! Sport Climbing Girls", "Keijo!!!!!!!!",
  "Harukana Receive", "Uma Musume: Pretty Derby", "Birdie Wing: Golf Girls' Story", "Baki the Grappler", "Mobile Suit Gundam",

  "Mobile Suit Gundam Wing", "Mobile Suit Gundam SEED", "Mobile Suit Gundam 00", "Mobile Suit Gundam: Iron-Blooded Orphans", "Mobile Suit Gundam: The Witch from Mercury",
  "Macross", "Macross Frontier", "Macross Delta", "Eureka Seven", "Promare",
  "Darling in the Franxx", "86 (Eighty-Six)", "Aldnoah.Zero", "Valvrave the Liberator", "Star Driver",
  "Captain Earth", "Gargantia on the Verdurous Planet", "Knight's & Magic", "SSSS.Gridman", "SSSS.Dynazenon",
  "Gunbuster", "Diebuster", "Full Metal Panic!", "FLCL", "Ghost in the Shell: Stand Alone Complex",
  "Akira", "Ergo Proxy", "Texhnolyze", "Serial Experiments Lain", "Steins;Gate 0",
  "Vivy: Fluorite Eye's Song", "Chobits", "Planetarian: The Reverie of a Little Planet", "Planetes", "Space Brothers",
  "Astra Lost in Space", "Space Dandy", "Outlaw Star", "Trigun", "Trigun Stampede",
  "Sket Dance", "Legend of the Galactic Heroes", "Space Battleship Yamato 2199", "Crest of the Stars", "Dimension W",
  "ID:Invaded", "Deca-Dence", "Heavenly Delusion", "Nier: Automata Ver1.1a", "Pluto",

  "Perfect Blue", "Paprika", "Paranoia Agent", "Terror in Resonance", "B: The Beginning",
  "The Promised Neverland", "Shadows House", "Moriarty the Patriot", "Gosick", "Hyouka",
  "Beautiful Bones: Sakurako's Investigation", "Heaven's Memo Pad", "Un-Go", "Danganronpa: The Animation", "Persona 4 The Animation",
  "Persona 5 The Animation", "Devilman Crybaby", "Hellsing (Original)", "Blood+", "Blood-C",
  "Shiki", "Another", "Higurashi: When They Cry", "Umineko: When They Cry", "Hell Girl",
  "Ghost Hunt", "Corpse Party: Tortured Souls", "Junji Ito Collection", "Mieruko-chan", "Dark Gathering",
  "Mononoke", "Ayakashi: Samurai Horror Tales", "Boogiepop Phantom", "From the New World (Shinsekai Yori)", "Love Live! School Idol Project",

  "Love Live! Sunshine!!", "Love Live! Nijigasaki High School Idol Club", "Love Live! Superstar!!", "The Idolmaster", "The Idolmaster Cinderella Girls",
  "Oshi no Ko", "Zombieland Saga", "Uta no Prince-sama", "Idolish7", "Ensemble Stars!",
  "Symphogear", "Sailor Moon", "Sailor Moon Crystal", "Cardcaptor Sakura", "Tokyo Mew Mew",
  "Shugo Chara!", "Mermaid Melody Pichi Pichi Pitch", "Ojamajo Doremi", "Puella Magi Madoka Magica", "Magia Record",
  "Yuki Yuna is a Hero", "Magical Girl Lyrical Nanoha", "Fate/kaleid liner Prisma Illya", "Princess Tutu", "Spirited Away",

  "Howl's Moving Castle", "Princess Mononoke", "My Neighbor Totoro", "Kiki's Delivery Service", "Castle in the Sky",
  "Nausicaä of the Valley of the Wind", "Porco Rosso", "Whisper of the Heart", "The Wind Rises", "Ponyo",
  "Your Name", "Weathering With You", "Suzume", "5 Centimeters per Second", "The Garden of Words",
  "Children Who Chase Lost Voices", "The Girl Who Leapt Through Time", "Wolf Children", "Summer Wars", "The Boy and the Beast",
  "Mirai", "Belle", "A Silent Voice", "I Want to Eat Your Pancreas", "Maquia: When the Promised Flower Blooms",
  "Hotarubi no Mori e", "Patema Inverted", "Redline", "Sword of the Stranger", "Ninja Scroll",
  "Vampire Hunter D: Bloodlust", "Metropolis", "Royal Space Force: The Wings of Honneamise", "Jin-Roh: The Wolf Brigade", "Memories",
  "Neo Tokyo", "Angel's Egg", "The Tale of the Princess Kaguya", "Grave of the Fireflies", "Fate/stay night",

  "Fate/stay night: Unlimited Blade Works", "Fate/stay night: Heaven's Feel", "Fate/Apocrypha", "Fate/Grand Order: Absolute Demonic Front - Babylonia", "Fate/Extra Last Encore",
  "Tsukihime", "Kara no Kyoukai (The Garden of Sinners)", "Bakemonogatari", "Nisemonogatari", "Monogatari Series: Second Season",
  "Owarimonogatari", "Kizumonogatari", "Katanagatari", "Zaregoto: The Beheading Cycle", "Inou-Battle in the Usually Daze",

  "Kiznaiver", "Amagi Brilliant Park", "Beyond the Boundary", "Tamako Market", "Tamako Love Story",
  "Sound! Euphonium", "Liz and the Blue Bird", "Tsuritama", "Natsume's Book of Friends", "Mushishi",
  "Kino's Journey", "The Eccentric Family", "The Tatami Galaxy", "Night is Short, Walk on Girl", "Kaiba",
  "Kemonozume", "Blood Blockade Battlefront", "Space Patrol Luluco", "Inferno Cop", "Panty & Stocking with Garterbelt",
  "BNA: Brand New Animal", "Dead Leaves", "Gungrave", "Afro Samurai", "Samurai Champloo",
  "Megalo Box 2: Nomad", "Sonny Boy", "Odd Taxi", "Great Pretender", "Appare-Ranman!",
  "Lycoris Recoil", "Engage Kiss", "Buddy Daddies", "Akiba Maid War", "Call of the Night",
  "Summertime Render", "Tomodachi Game", "Classroom of the Elite", "Bocchi the Rock!", "Do It Yourself!!",
  "The Yuzuki Family's Four Sons", "Metallic Rouge", "Delicious in Dungeon", "Solo Leveling", "Shangri-La Frontier"
];

exports.help = {
  name: "animeoner",
  aliases: ["animeöner", "anime"],
  usage: "animeoner [sil]",
  description: "Sunucu havuzundan size yeni bir anime önerir.",
  category: "Eğlence",
  cooldown: 5,
};

exports.execute = async (client, message, args) => {
  const db = client.db;
  const guildId = message.guild.id;
  const userId = message.author.id;

  if (args[0] && args[0].toLowerCase() === "sil") {
    const existingChannelId = await db.get(`animeChannel_${guildId}`);
    if (!existingChannelId) {
      return message.channel.send(
        `${emojis.bot.error} | **${message.member.displayName}**, sunucuda zaten kurulu bir anime öneri sistemi yok! 😵`
      );
    }

    const channelToDelete = message.guild.channels.cache.get(existingChannelId);
    if (channelToDelete) {
      await channelToDelete.delete("Anime öneri sistemi yönetici tarafından silindi.").catch(() => null);
    }

    await db.delete(`animeChannel_${guildId}`);
    await db.delete(`animePool_${guildId}`);

    return message.channel.send(
      `${emojis.bot.succes} | **${message.member.displayName}**, anime öneri sistemi ve havuzu başarıyla silindi! ✨`
    );
  }

  const animeChannelId = await db.get(`animeChannel_${guildId}`);

  if (!animeChannelId || !message.guild.channels.cache.has(animeChannelId)) {
    const row = new MessageActionRow().addComponents(
      new MessageButton().setCustomId("setup_anime_yes").setLabel("Evet, Kur").setStyle("SUCCESS"),
      new MessageButton().setCustomId("setup_anime_no").setLabel("İptal Et").setStyle("DANGER")
    );

    const questionEmbed = new MessageEmbed()
      .setTitle("⚙️ Anime Öneri Sistemi Kurulumu")
      .setDescription("Sunucuda ayarlanmış bir anime kanalı bulamadım. Yeni bir **🔥┃anime・öneri** kanalı oluşturulmasını ve **varsayılan 500 animenin** havuza eklenmesini ister misiniz?")
      .setColor("#5865F2");

    const questionMessage = await message.channel.send({ embeds: [questionEmbed], components: [row] });

    const filter = (i) => i.user.id === userId;
    const collector = questionMessage.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "setup_anime_yes") {
        try {
          const newChannel = await message.guild.channels.create("🔥┃anime・öneri", {
            type: "GUILD_TEXT",
            topic: "Lütfen bu kanala sadece önermek istediğiniz anime isimlerini yazınız!",
            permissionOverwrites: [
              {
                id: message.guild.id,
                allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES],
              },
            ],
          });

          await db.set(`animeChannel_${guildId}`, newChannel.id);

          const existingPool = (await db.get(`animePool_${guildId}`)) || [];
          if (existingPool.length === 0) {
            await db.set(`animePool_${guildId}`, defaultAnimes);
          }

          await interaction.update({
            embeds: [
              new MessageEmbed()
                .setTitle("✅ Kurulum Başarılı!")
                .setDescription(`Kanal başarıyla oluşturuldu: ${newChannel}\n\n🎬 **${defaultAnimes.length} Adet** varsayılan efsane anime sunucu havuzuna eklendi! Üyeler kanala yazarak yenilerini ekleyebilirler.`)
                .setColor("GREEN"),
            ],
            components: [],
          });
        } catch (err) {
          console.error(err);
          await interaction.update({ content: "Kanal oluşturulurken bir hata meydana geldi!", embeds: [], components: [] });
        }
      } else {
        await interaction.update({ content: "Kurulum işlemi iptal edildi.", embeds: [], components: [] });
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        questionMessage.edit({ content: "Kurulum süresi doldu.", embeds: [], components: [] }).catch(() => null);
      }
    });

    return;
  }

  try {
    const animePool = (await db.get(`animePool_${guildId}`)) || [];
    const userHistory = (await db.get(`animeHistory_${userId}`)) || [];

    if (animePool.length === 0) {
      return message.channel.send(
        `${emojis.bot.error} | Havuzda henüz hiç anime yok! Lütfen önce <#${animeChannelId}> kanalına anime isimleri ekleyin.`
      );
    }

    const availableAnimes = animePool.filter((anime) => !userHistory.includes(anime.toLowerCase()));

    if (availableAnimes.length === 0) {
      return message.channel.send(
        `${emojis.bot.succes} | **Vay canına!** Sunucu havuzundaki tüm animeleri tükettin~ Gösterilecek yeni bir anime kalmadı! 😵`
      );
    }

    const randomAnime = availableAnimes[Math.floor(Math.random() * availableAnimes.length)];

    userHistory.push(randomAnime.toLowerCase());
    await db.set(`animeHistory_${userId}`, userHistory);

    const embed = new MessageEmbed()
      .setTitle(`🎬 | Sana Harika Bir Anime Önerim Var!`)
      .setDescription(`Bugünkü şanslı animen: **${randomAnime}** ✨`)
      .setColor("#00FFAA")
      .setFooter({ text: `${client.user.username} | Havuzda kalan izlemediğin anime: ${availableAnimes.length - 1}` })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    return message.channel.send(`${emojis.bot.error} | Öneri yapılırken teknik bir hata oluştu~ 😢`);
  }
};