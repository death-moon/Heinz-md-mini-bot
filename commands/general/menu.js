module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  description: 'Afficher le menu principal du bot',
  usage: '.menu',
  category: 'general',
  cooldown: 3,

  async execute(socket, msgInfo, handler) {
    const { from } = msgInfo;
    
    const menu = handler.getMenu();
    
    await handler.reply(from, menu, {
      contextInfo: {
        externalAdReply: {
          title: '🤖 Heinz-md Bot Menu',
          body: 'Bot WhatsApp avancé par Heinz boy',
          mediaType: 1,
          sourceUrl: handler.config.GITHUB_REPO,
          thumbnailUrl: 'https://files.catbox.moe/y0ra0d.jpg',
          renderLargerThumbnail: true
        }
      }
    });
  }
};