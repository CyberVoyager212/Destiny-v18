const { MessageAttachment } = require('discord.js');
const { generateCaptcha, generateCaptchaImage } = require('../utils/captcha');
const emojis = require('../emoji.json');

module.exports = {
  name: 'verify',
  aliases: ['doğrulama'],
  usage:
    'verify [ayar yap <@rol1,@rol2,...> <#kanal> [@customRole]|ayar sil|help]',
  description:
    'Kullanıcının doğrulama rolü almasını sağlar. Yönetici verify ayar yap, ayar sil komutlarıyla yapılandırabilir.',
  cooldown: 5,

  async execute(client, message, args) {
    try {
      const { guild, member, channel } = message;

      if (args[0] === 'ayar') {
        if (!member.permissions.has('ADMINISTRATOR'))
          return message.reply(
            `${emojis.bot.error} | **${message.member.displayName}**, bu işlemi sadece sunucu yöneticileri yapabilir~`
          );

        if (args[1] === 'yap') {
          if (args[2] === 'help') {
            return message.channel.send(
              `${emojis.bot.succes} | **verify ayar yap** ile doğrulama ayarlarını yapılandırabilirsin:\n` +
                `• \`verify ayar yap @CustomRole #Kanal @Rol1,@Rol2,...\` — Bir özel rol, bir kanal ve bir veya daha fazla doğrulama rolü ayarlar.\n` +
                `• Roller virgülle ayrılmalıdır.\n` +
                `Örnek: \`verify ayar yap @Bekleyen #doğrulama @Üye,@Yetkili\``
            );
          }

          const targetChannel = message.mentions.channels.first();
          if (!targetChannel) {
            return message.reply(
              `${emojis.bot.error} | **${message.member.displayName}**, lütfen bir kanal etiketle~ (\`verify ayar yap help\`)`
            );
          }

          const mentionedRoles = [...message.mentions.roles.values()].filter(
            (r) => r.id !== targetChannel.id
          );

          if (!mentionedRoles.length) {
            return message.reply(
              `${emojis.bot.error} | **${message.member.displayName}**, lütfen en az bir rol etiketle~ (\`verify ayar yap help\`)`
            );
          }

          const customRole = mentionedRoles.shift();
          const roleIDs = mentionedRoles.map((r) => r.id);
          const customRoleID = customRole ? customRole.id : null;

          if (!roleIDs.length) {
            return message.reply(
              `${emojis.bot.error} | **${message.member.displayName}**, özel rol dışında en az bir doğrulama rolü eklemelisin~`
            );
          }

          await client.db.set(`verify_${guild.id}`, {
            roleIDs,
            channelID: targetChannel.id,
            customRoleID,
          });

          const rolesList = roleIDs.map((id) => `<@&${id}>`).join(', ');
          const customText = customRoleID
            ? `\n• Özel Rol: <@&${customRoleID}>`
            : '';

          return message.channel.send(
            `${emojis.bot.succes} | **Doğrulama ayarları kaydedildi!**\n• Roller: ${rolesList}\n• Kanal: <#${targetChannel.id}>${customText}`
          );
        }

        if (args[1] === 'sil') {
          const exists = await client.db.get(`verify_${guild.id}`);
          if (!exists) {
            return message.reply(
              `${emojis.bot.error} | **${message.member.displayName}**, bu sunucu için doğrulama ayarı bulunmuyor~`
            );
          }
          await client.db.delete(`verify_${guild.id}`);
          return message.channel.send(
            `${emojis.bot.succes} | Doğrulama ayarları başarıyla silindi~`
          );
        }

        return message.reply(
          `${emojis.bot.error} | Geçersiz alt komut~ \`verify ayar yap\`, \`verify ayar sil\` veya \`verify ayar yap help\` kullanabilirsin.`
        );
      }

      if (args[0] === 'help') {
        return message.channel.send(
          `${emojis.bot.succes} | **verify** komutu kısaca:\n` +
            `• \`verify ayar yap\` — Sunucu yöneticileri doğrulama ayarlarını yapar.\n` +
            `• \`verify ayar sil\` — Doğrulama ayarlarını siler.\n` +
            `• \`verify\` — Kullanıcılar doğrulama kodu alır ve doğrulanır.`
        );
      }

      const config = await client.db.get(`verify_${guild.id}`);
      if (!config)
        return message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, bu sunucu için doğrulama ayarlanmamış~ Yöneticin \`verify ayar yap\` kullanmalı.`
        );

      const { roleIDs, channelID, customRoleID } = config;

      if (channel.id !== channelID) {
        const msg = await message.reply(
          `${emojis.bot.error} | Bu komut sadece <#${channelID}> kanalında çalışır~`
        );
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
      }

      if (roleIDs.some((r) => member.roles.cache.has(r))) {
        const msg = await message.reply(
          `${emojis.bot.error} | **${message.member.displayName}**, zaten doğrulanmışsın~`
        );
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
      }

      const captcha = generateCaptcha();
      const captchaImage = generateCaptchaImage(captcha); 
      const attachment = new MessageAttachment(captchaImage, 'captcha.png');

      const captchaMessage = await message.channel.send({
        content: `${emojis.bot.succes} | **${message.member.displayName}**, lütfen aşağıdaki CAPTCHA kodunu gir:`,
        files: [attachment],
      });

      const filter = (response) => response.author.id === member.id;
      let attempts = 0;
      const maxAttempts = 3;
      const captchaTimeout = 50000;

      const checkCaptcha = async () => {
        const response = await message.channel
          .awaitMessages({
            filter,
            max: 1,
            time: captchaTimeout,
            errors: ['time'],
          })
          .catch(() => null);

        if (!response) {
          const timeoutMsg = await message.channel.send(
            `${emojis.bot.error} | **${message.member.displayName}**, süre doldu~ Lütfen tekrar deneyin :c`
          );
          setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
          setTimeout(() => captchaMessage.delete().catch(() => {}), 5000);
          return;
        }

        const userResponse = response.first().content.trim();
        if (userResponse === captcha) {
          if (customRoleID) {
            try {
              const oldRole = await guild.roles.fetch(customRoleID);
              if (oldRole && member.roles.cache.has(customRoleID)) {
                await member.roles.remove(customRoleID);
              }
            } catch (err) {
              console.error('Custom role removal error:', err);
            }
          }

          for (const id of roleIDs) {
            try {
              await member.roles.add(id);
            } catch (err) {
              console.error(
                `Rol eklenemedi (${id}) -> ${member.user.tag}:`,
                err
              );
            }
          }

          const successMessage = await message.channel.send(
            `${emojis.bot.succes} | Tebrikler <@${member.id}>! Başarıyla doğrulandın~`
          );
          setTimeout(() => successMessage.delete().catch(() => {}), 5000);
          setTimeout(() => message.delete().catch(() => {}), 5000);
          setTimeout(() => captchaMessage.delete().catch(() => {}), 5000);
          setTimeout(
            () =>
              response
                .first()
                .delete()
                .catch(() => {}),
            5000
          );
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            const retryMsg = await message.channel.send(
              `${emojis.bot.error} | Yanlış CAPTCHA~ Kalan hak: ${
                maxAttempts - attempts
              } — Tekrar deneyin!`
            );
            setTimeout(() => retryMsg.delete().catch(() => {}), 5000);
            setTimeout(
              () =>
                response
                  .first()
                  .delete()
                  .catch(() => {}),
              5000
            );
            return checkCaptcha();
          } else {
            const failureMsg = await message.channel.send(
              `${emojis.bot.error} | Doğrulama başarısız oldu — tüm haklarını kullandın :c`
            );
            setTimeout(() => failureMsg.delete().catch(() => {}), 5000);
            setTimeout(
              () =>
                response
                  .first()
                  .delete()
                  .catch(() => {}),
              5000
            );
            setTimeout(() => captchaMessage.delete().catch(() => {}), 5000);
            return;
          }
        }
      };

      checkCaptcha();
      setTimeout(() => captchaMessage.delete().catch(() => {}), captchaTimeout);
    } catch (error) {
      console.error('Doğrulama sırasında bir hata oluştu:', error);
      const errorMsg = await message.reply(
        `${emojis.bot.error} | **${message.member.displayName}**, doğrulama sırasında bir hata oluştu qwq~ Lütfen tekrar dene!`
      );
      setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
    }
  },

  help: {
    name: 'doğrulama',
    aliases: ['verify'],
    usage: 'doğrulama',
    description: 'Kullanıcının doğrulama rolü almasını sağlar.',
    category: 'Moderasyon',
    cooldown: 5,
  },
};
