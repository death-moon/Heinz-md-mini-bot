const moment = require('moment-timezone');

module.exports = {
  name: 'info',
  aliases: ['about', 'botinfo'],
  description: 'Informations détaillées sur le bot',
  usage: '.info',
  category: 'general',
  cooldown: 10,

  async execute(socket, msgInfo, handler) {
    const { from } = msgInfo;
    
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const nodeVersion = process.version;
    const platform = process.platform;
    
    const uptimeFormatted = formatUptime(uptime);
    const memoryFormatted = formatBytes(memoryUsage.heapUsed);
    const totalMemory = formatBytes(memoryUsage.heapTotal);
    
    const info = `╭──「 🤖 *BOT INFO* 」\n` +
      `│\n` +
      `│ 📱 *ɴᴏᴍ:* ${handler.config.BOT_NAME}\n` +
      `│ 🔢 *ᴠᴇʀsɪᴏɴ:* ${handler.config.BOT_VERSION}\n` +
      `│ 👨‍💻 *ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇᴜʀ:* ${handler.config.BOT_DEVELOPER}\n` +
      `│ 📌 *ᴘʀᴇ́ғɪxᴇ:* ${handler.config.PREFIX}\n` +
      `│\n` +
      `╰───────────────𖠇\n\n` +
      
      `╭──「 📊 *STATISTIQUES* 」\n` +
      `│\n` +
      `│ ⏰ *ᴜᴘᴛɪᴍᴇ:* ${uptimeFormatted}\n` +
      `│ 💾 *ʀᴀᴍ:* ${memoryFormatted}/${totalMemory}\n` +
      `│ 🖥️ *ᴘʟᴀᴛᴇғᴏʀᴍᴇ:* ${platform}\n` +
      `│ 🟢 *ɴᴏᴅᴇ.ᴊs:* ${nodeVersion}\n` +
      `│ 📚 *ᴄᴏᴍᴍᴀɴᴅᴇs:* ${handler.commands.size}\n` +
      `│\n` +
      `╰───────────────𖠇\n\n` +
      
      `╭──「 🔗 *LIENS* 」\n` +
      `│\n` +
      `│ 📱 *ɢɪᴛʜᴜʙ:* ${handler.config.GITHUB_REPO}\n` +
      `│ 💬 *sᴜᴘᴘᴏʀᴛ:* ${handler.config.SUPPORT_GROUP}\n` +
      `│ 📢 *ᴄᴀɴᴀʟ:* ${handler.config.CHANNEL_LINK}\n` +
      `│\n` +
      `╰───────────────𖠇\n\n` +
      
      `╭──「 ⏰ *HEURE* 」\n` +
      `│\n` +
      `│ 🌍 *Cameroun:* ${moment().tz('Africa/Douala').format('DD/MM/YYYY HH:mm:ss')}\n` +
      `│ 🌍 *France:* ${moment().tz('Europe/Paris').format('DD/MM/YYYY HH:mm:ss')}\n` +
      `│ 🌍 *UTC:* ${moment().utc().format('DD/MM/YYYY HH:mm:ss')}\n` +
      `│\n` +
      `╰────────────────𖠇\n\n` +
      
      `${handler.config.BOT_FOOTER}`;
    
    await handler.reply(from, info, {
      contextInfo: {
        externalAdReply: {
          title: '🤖 HEINZ-MD BOT INFO',
          body: 'Bot WhatsApp avancé par Heinz boy',
          mediaType: 1,
          sourceUrl: handler.config.GITHUB_REPO,
          thumbnailUrl: 'https://files.catbox.moe/ym2qui.jpg',
          renderLargerThumbnail: true
        }
      }
    });
  }
};

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  let result = '';
  if (days > 0) result += `${days}j `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${secs}s`;
  
  return result;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
