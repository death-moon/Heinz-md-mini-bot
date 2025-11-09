module.exports = {
  name: 'ping',
  aliases: ['latency'],
  description: 'Vérifier la latence du bot',
  usage: '.ping',
  category: 'general',
  cooldown: 5,

  async execute(socket, msgInfo, handler) {
    const { from } = msgInfo;
    
    const start = Date.now();
    await handler.reply(from, '🏓 Pong!');
    const end = Date.now();
    
    const latency = end - start;
    const uptime = process.uptime();
    
    const uptimeFormatted = formatUptime(uptime);
    
    const response = `🏓 *ᴘᴏɴɢ!*\n\n` +
      `⚡ *ʟᴀᴛᴇɴᴄᴇ:* ${latency}ᴍs\n` +
      `⏰ *ᴜᴘᴛɪᴍᴇ:* ${uptimeFormatted}\n` +
      `🤖 *ʙᴏᴛ:* ${handler.config.BOT_NAME}\n` +
      `📱 *ᴠᴇʀsɪᴏɴ:* ${handler.config.BOT_VERSION}`;
    
    await handler.reply(from, response);
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