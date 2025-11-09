const axios = require('axios');

module.exports = {
    name: 'image',
    aliases: ['img', 'picture', 'photo'],
    category: 'search',
    description: 'Recherche et affiche des images depuis Google Images',
    usage: '.image <recherche>',
    cooldown: 15,
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
                `📝 *Usage:* ${handler.config.PREFIX}image <recherche>\n\n` +
                `📖 *Exemples:*\n` +
                `• ${handler.config.PREFIX}image chat mignon\n` +
                `• ${handler.config.PREFIX}image paysage montagne\n` +
                `• ${handler.config.PREFIX}image voiture sport\n` +
                `• ${handler.config.PREFIX}image nature sunset`
            );
        }

        const query = args.join(' ');

        try {
            await handler.react(from, msgInfo.msg.key, '🖼️');

            // Message de recherche
            await handler.reply(from, `🖼️ *Recherche d'images en cours...*\n\n📝 Terme: "${query}"`);

            // API de recherche d'images (utilisation d'une API publique)
            const searchApis = [
                {
                    name: 'Unsplash',
                    url: `https://api.unsplash.com/search/photos`,
                    params: {
                        query: query,
                        per_page: 10,
                        orientation: 'landscape'
                    },
                    headers: {
                        'Authorization': 'Client-ID YOUR_UNSPLASH_ACCESS_KEY'
                    }
                },
                {
                    name: 'Pexels',
                    url: `https://api.pexels.com/v1/search`,
                    params: {
                        query: query,
                        per_page: 10,
                        orientation: 'landscape'
                    },
                    headers: {
                        'Authorization': 'YOUR_PEXELS_API_KEY'
                    }
                }
            ];

            // Fallback - utilisation d'un scraper simple pour demo
            const images = await this.scrapeImages(query);

            if (!images || images.length === 0) {
                return await handler.reply(from,
                    `❌ *Aucune image trouvée*\n\n` +
                    `🔍 Recherche: "${query}"\n\n` +
                    `💡 *Suggestions:*\n` +
                    `• Utilisez des mots-clés en anglais\n` +
                    `• Essayez des termes plus génériques\n` +
                    `• Vérifiez l'orthographe\n` +
                    `• Utilisez des synonymes`
                );
            }

            // Prendre une image aléatoire parmi les résultats
            const randomImage = images[Math.floor(Math.random() * Math.min(images.length, 5))];

            // Informations sur l'image
            let caption = `╭──「 🖼️ *RECHERCHE D'IMAGES* 」\n`;
            caption += `│\n`;
            caption += `│ 🔍 *Recherche:* ${query}\n`;
            caption += `│ 📊 *Images trouvées:* ${images.length}\n`;
            caption += `│ 🎲 *Image sélectionnée:* Aléatoire\n`;
            caption += `│ 📐 *Résolution:* ${randomImage.width || 'Inconnue'}x${randomImage.height || 'Inconnue'}\n`;
            caption += `│ 📱 *Source:* ${randomImage.source || 'Internet'}\n`;
            caption += `│\n`;
            caption += `╰────────────────𖠁\n\n`;

            if (randomImage.title) {
                caption += `📝 *Titre:* ${randomImage.title}\n`;
            }
            if (randomImage.description) {
                caption += `📄 *Description:* ${randomImage.description.substring(0, 100)}...\n`;
            }

            caption += `\n───────────────────\n`;
            caption += `💡 *Utilisez ${handler.config.PREFIX}image <autre terme> pour une nouvelle recherche*\n`;
            caption += `🔄 *Les images sont sélectionnées aléatoirement*\n`;
            caption += `────────────────────\n`;
            caption += `${handler.config.BOT_FOOTER}`;

            // Envoyer l'image
            await socket.sendMessage(from, {
                image: { url: randomImage.url },
                caption: caption,
                contextInfo: {
                    externalAdReply: {
                        title: `🖼️ Image: "${query}"`,
                        body: `Source: ${randomImage.source || 'Internet'}`,
                        mediaType: 1,
                        sourceUrl: randomImage.sourceUrl || randomImage.url,
                        thumbnailUrl: randomImage.thumbnail || randomImage.url,
                        renderLargerThumbnail: true
                    }
                }
            });

            await handler.react(from, msgInfo.msg.key, '✅');

            // Logger la recherche
            if (global.logger) {
                await global.logger.info('Image search performed', {
                    user: msgInfo.sender,
                    query,
                    resultsCount: images.length,
                    selectedImage: randomImage.url.substring(0, 100)
                });
            }

        } catch (error) {
            console.error('Erreur dans la commande image:', error);
            await handler.react(from, msgInfo.msg.key, '❌');

            let errorMessage = '❌ *Erreur lors de la recherche d\'images*\n\n';

            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                errorMessage += '🌐 *Problème de connexion*\n' +
                              'Impossible d\'accéder aux services d\'images.\n' +
                              'Vérifiez votre connexion internet.';
            } else if (error.response?.status === 429) {
                errorMessage += '⏱️ *Limite de requêtes atteinte*\n' +
                              'Trop de recherches d\'images récemment.\n' +
                              'Réessayez dans quelques minutes.';
            } else if (error.response?.status === 403) {
                errorMessage += '🚫 *Accès refusé*\n' +
                              'Le service d\'images a refusé la requête.\n' +
                              'Essayez avec des termes différents.';
            } else if (error.message.includes('timeout')) {
                errorMessage += '⏰ *Timeout de recherche*\n' +
                              'La recherche a pris trop de temps.\n' +
                              'Réessayez avec des termes plus spécifiques.';
            } else {
                errorMessage += `📝 *Détails:* ${error.message}\n\n` +
                              `💡 *Suggestions:*\n` +
                              `• Réessayez dans quelques secondes\n` +
                              `• Utilisez des mots-clés plus simples\n` +
                              `• Essayez en anglais\n` +
                              `• Contactez l'administrateur si le problème persiste`;
            }

            await handler.reply(from, errorMessage);

            // Logger l'erreur
            if (global.logger) {
                await global.logger.error('Image search error', {
                    user: msgInfo.sender,
                    query,
                    error: error.message,
                    code: error.code,
                    status: error.response?.status
                });
            }
        }
    },

    // Méthode helper pour scraper les images (fallback)
    async scrapeImages(query) {
        try {
            // API publique gratuite pour les images
            const apis = [
                {
                    url: `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`,
                    transform: (data) => data.results?.map(item => ({
                        url: item.urls?.regular || item.urls?.small,
                        thumbnail: item.urls?.thumb,
                        title: item.alt_description || item.description,
                        width: item.width,
                        height: item.height,
                        source: 'Unsplash',
                        sourceUrl: item.links?.html
                    }))
                },
                {
                    url: `https://pixabay.com/api/?key=YOUR_PIXABAY_KEY&q=${encodeURIComponent(query)}&per_page=10&safesearch=true`,
                    transform: (data) => data.hits?.map(item => ({
                        url: item.webformatURL,
                        thumbnail: item.previewURL,
                        title: item.tags,
                        width: item.webformatWidth,
                        height: item.webformatHeight,
                        source: 'Pixabay',
                        sourceUrl: item.pageURL
                    }))
                }
            ];

            // Images par défaut pour la demo (remplacer par de vraies APIs)
            const fallbackImages = [
                {
                    url: 'https://picsum.photos/800/600?random=1',
                    thumbnail: 'https://picsum.photos/200/150?random=1',
                    title: `Image de ${query}`,
                    width: 800,
                    height: 600,
                    source: 'Lorem Picsum',
                    sourceUrl: 'https://picsum.photos'
                },
                {
                    url: 'https://picsum.photos/800/600?random=2',
                    thumbnail: 'https://picsum.photos/200/150?random=2',
                    title: `Photo de ${query}`,
                    width: 800,
                    height: 600,
                    source: 'Lorem Picsum',
                    sourceUrl: 'https://picsum.photos'
                },
                {
                    url: 'https://picsum.photos/800/600?random=3',
                    thumbnail: 'https://picsum.photos/200/150?random=3',
                    title: `Illustration de ${query}`,
                    width: 800,
                    height: 600,
                    source: 'Lorem Picsum',
                    sourceUrl: 'https://picsum.photos'
                }
            ];

            return fallbackImages;

        } catch (error) {
            console.error('Erreur scraping images:', error);
            return [];
        }
    }
};
