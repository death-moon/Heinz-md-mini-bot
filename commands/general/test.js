module.exports = {
  name: 'test',
  aliases: ['t'],
  description: 'Commande de test simple',
  usage: '.test',
  category: 'general',
  cooldown: 3,

  async execute(socket, msgInfo, handler) {
    const { from, sender } = msgInfo;
    
    const message = `✅ *ᴛᴇsᴛ ʀᴇ́ᴜssɪ!*\n\n` +
      `👤 *ᴜᴛɪʟɪsᴀᴛᴇᴜʀ:* ${sender}\n` +
      `📱 *ᴄʜᴀᴛ:* ${from}\n` +
      `⏰ *ʜᴇᴜʀᴇ:* ${new Date().toLocaleString()}\n` +
      `🤖 *ʙᴏᴛ:* ${handler.config.BOT_NAME} v${handler.config.BOT_VERSION}\n\n` +
      `ʟᴇ ʙᴏᴛ ғᴏɴᴄᴛɪᴏɴɴᴇ ᴄᴏʀʀᴇᴄᴛᴇᴍᴇɴᴛ! 🎉`;
    
    await handler.reply(from, message);
  }
};