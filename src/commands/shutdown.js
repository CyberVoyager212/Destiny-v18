const fs = require("fs");
const path = require("path");
const emojis = require("../emoji.json");
const botConfig = require("../botConfig.js");

module.exports.help = {
  name: "shutdown",
  aliases: ["kapat", "botkapat"],
  description: "Botu kapatır (sadece bot sahibi).",
  usage: "shutdown",
  category: "Bot",
  cooldown: 5,
  admin: true,
};

module.exports.execute = async (client, message) => {
  const ownerId = (client.config && client.config.ownerId) || botConfig.ownerId;
  if (message.author.id !== ownerId) {
    return message
      .reply(`${emojis.bot.error} | Bu komutu sadece bot sahibi kullanabilir.`)
      .catch(() => {});
  }

  const baseDir = path.join(__dirname, "..");
  const stopFlagPath = path.join(baseDir, "launcher_background.stop");
  const launcherPidPath = path.join(baseDir, "launcher_background.pid");

  try {
    fs.writeFileSync(stopFlagPath, String(Date.now()));
  } catch {}

  try {
    if (fs.existsSync(launcherPidPath)) {
      const raw = fs.readFileSync(launcherPidPath, "utf8").trim();
      const pid = parseInt(raw, 10);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid);
        } catch {}
      }
    }
  } catch {}

  await message.channel
    .send(`${emojis.bot.succes} | Bot kapatılıyor...`)
    .catch(() => {});

  try {
    if (client && typeof client.destroy === "function") client.destroy();
  } catch {}

  setTimeout(() => process.exit(0), 300);
};
