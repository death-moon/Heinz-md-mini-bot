module.exports = {
  name: 'restart',
  aliases: ['reboot'],
  description: 'Redémarrer le bot (propriétaire uniquement)',
  usage: '.restart',
  category: 'owner',
  ownerOnly: true,
  cooldown: 0,

  async execute(socket, msgInfo, handler) {
    const { from } = msgInfo;
    
    await handler.reply(from, '🔄 *ʀᴇᴅᴇ́ᴍᴀʀʀᴀɢᴇ ᴅᴜ ʙᴏᴛ...*\n\n' +
      '⏳ ʟᴇ ʙᴏᴛ ᴠᴀ ʀᴇᴅᴇ́ᴍᴀʀʀᴇʀ ᴅᴀɴs ǫᴜᴇʟǫᴜᴇs sᴇᴄᴏɴᴅᴇs.\n' +
      '✅ ʀᴇᴄᴏɴɴᴇxɪᴏɴ ᴀᴜᴛᴏᴍᴀᴛɪǫᴜᴇ ᴇɴ ᴄᴏᴜʀs...');
    
    // Attendre un peu avant de redémarrer
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  }
};