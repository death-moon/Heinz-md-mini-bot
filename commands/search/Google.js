const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    name: 'google',
    aliases: ['search', 'googlesearch'],
    category: 'search',
    description: 'Effectue une recherche Google et affiche les résultats',
    usage: '.google <recherche>',
    cooldown: 10,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: false,
    hidden: false,

    async execute(socket, msgInfo, handler) {
        const { from, args } = msgInfo;

        if (!args.length) {
            return await handler.reply(from,
                `❌ *Terme de recherche requis*\n\n` +
                `📝 *Usage:* ${handler.config.PREFIX}google <recherche>\n\n` +
                `📖 *Exemples:*\n` +
                `• ${handler.config.PREFIX}google NICE-MD bot\n` +
                `• ${handler.config.PREFIX}google Node.js tutorial\n` +
                `• ${handler.config.PREFIX}google weather Paris`
            );
        }

        const query = args.join(' ');

        try {
            await handler.react(from, msgInfo.msg.key, '🔍');

            // Message de recherche
            await handler.reply(from, `🔍 *Recherche Google en cours...*\n\n📝 Terme: "${query}"`);

            // Headers pour simuler un navigateur réel
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            };

            // URL de recherche Google
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=fr`;

            const response = await axios.get(searchUrl, {
                headers,
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            // Extraire les résultats de recherche
            $('.g').each((index, element) => {
                if (results.length >= 8) return false; // Limiter à 8 résultats

                const titleElement = $(element).find('h3').first();
                const linkElement = $(element).find('a').first();
                const descriptionElement = $(element).find('.VwiC3b, .s3v9rd, .st').first();

                const title = titleElement.text().trim();
                const link = linkElement.attr('href');
                const description = descriptionElement.text().trim();

                if (title && link && !link.includes('google.com/search')) {
                    // Nettoyer l'URL
                    let cleanUrl = link;
                    if (link.startsWith('/url?q=')) {
                        const urlParams = new URLSearchParams(link.substring(7));
                        cleanUrl = urlParams.get('q') || link;
                    }

                    results.push({
                        title: title.substring(0, 60),
                        description: description.substring(0, 100),
                        url: cleanUrl
                    });
                }
            });

            if (results.length === 0) {
                return await handler.reply(from,
                    `❌ *Aucun résultat trouvé*\n\n` +
                    `🔍 Recherche: "${query}"\n\n` +
                    `💡 *Suggestions:*\n` +
                    `• Vérifiez l'orthographe\n` +
                    `• Utilisez des mots-clés différents\n` +
                    `• Essayez une recherche plus générale`
                );
            }

            // Formater les résultats
            let searchResults = `╭──「 🔍 *RÉSULTATS GOOGLE* 」\n`;
            searchResults += `┃\n`;
            searchResults += `│ 📝 *Recherche:* ${query}\n`;
            searchResults += `│ 📊 *Résultats trouvés:* ${results.length}\n`;
            searchResults += `│ 🌐 *Source:* Google Search\n`;
            searchResults += `│\n`;
            searchResults += `╰───────────────𖠁\n\n`;

            results.forEach((result, index) => {
                searchResults += `*${index + 1}. ${result.title}*\n`;
                searchResults += `📝 ${result.description}${result.description.length === 100 ? '...' : ''}\n`;
                searchResults += `🔗 ${result.url}\n\n`;
            });

            searchResults += `────────────────────\n`;
            searchResults += `💡 *Cliquez sur les liens pour accéder aux pages*\n`;
            searchResults += `🔄 *Utilisez ${handler.config.PREFIX}google <nouveau terme> pour une nouvelle recherche*\n`;
            searchResults += `────────────────────\n`;
            searchResults += `${handler.config.BOT_FOOTER}`;

            // Envoyer les résultats avec une image Google
            const googleImageUrl = 'https://files.catbox.moe/69ruml.png';

            await socket.sendMessage(from, {
                image: { url: googleImageUrl },
                caption: searchResults,
                contextInfo: {
                    externalAdReply: {
                        title: `🔍 Recherche Google: "${query}"`,
                        body: `${results.length} résultats trouvés`,
                        mediaType: 1,
                        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                        thumbnailUrl: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
                        renderLargerThumbnail: true
                    }
                }
            });

            await handler.react(from, msgInfo.msg.key, '✅');

            // Logger la recherche
            if (global.logger) {
                await global.logger.info('Google search performed', {
                    user: msgInfo.sender,
                    query,
                    resultsCount: results.length
                });
            }

        } catch (error) {
            console.error('Erreur dans la commande google:', error);
            await handler.react(from, msgInfo.msg.key, '❌');

            let errorMessage = '❌ *Erreur lors de la recherche*\n\n';

            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                errorMessage += '🌐 *Problème de connexion*\n' +
                              'Vérifiez votre connexion internet et réessayez.';
            } else if (error.response?.status === 429) {
                errorMessage += '⏱️ *Limite de requêtes atteinte*\n' +
                              'Google a temporairement bloqué les requêtes.\n' +
                              'Réessayez dans quelques minutes.';
            } else if (error.response?.status === 403) {
                errorMessage += '🚫 *Accès bloqué*\n' +
                              'Google a bloqué cette requête.\n' +
                              'Essayez avec des termes différents.';
            } else if (error.code === 'ECONNABORTED') {
                errorMessage += '⏰ *Timeout de la recherche*\n' +
                              'La recherche a pris trop de temps.\n' +
                              'Réessayez avec des termes plus spécifiques.';
            } else {
                errorMessage += `📝 *Détails:* ${error.message}\n\n` +
                              `💡 *Suggestions:*\n` +
                              `• Réessayez dans quelques secondes\n` +
                              `• Utilisez des termes plus simples\n` +
                              `• Contactez l'administrateur si le problème persiste`;
            }

            await handler.reply(from, errorMessage);

            // Logger l'erreur
            if (global.logger) {
                await global.logger.error('Google search error', {
                    user: msgInfo.sender,
                    query,
                    error: error.message,
                    code: error.code,
                    status: error.response?.status
                });
            }
        }
    }
};
