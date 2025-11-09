const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    name: 'ytmp3',
    aliases: ['yta', 'ytaudio', 'youtubeaudio'],
    category: 'download',
    description: 'Télécharge l\'audio d\'une vidéo YouTube au format MP3',
    usage: '.ytmp3 <lien YouTube ou recherche>',
    cooldown: 30,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: false,
    hidden: false,

    async execute(socket, msgInfo, handler) {
        const { from, args, text } = msgInfo;

        if (!args.length) {
            return await handler.reply(from,
                `❌ *Utilisation incorrecte*\n\n` +
                `📝 *Usage:* ${handler.config.PREFIX}ytmp3 <lien ou recherche>\n\n` +
                `📖 *Exemples:*\n` +
                `• ${handler.config.PREFIX}ytmp3 https://youtube.com/watch?v=abc123\n` +
                `• ${handler.config.PREFIX}ytmp3 Imagine Dragons Believer`
            );
        }

        const query = args.join(' ');

        try {
            await handler.react(from, msgInfo.msg.key, '🔍');

            let videoUrl = '';
            let videoInfo = null;

            // Vérifier si c'est déjà un lien YouTube
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                videoUrl = query;
                try {
                    videoInfo = await ytdl.getInfo(videoUrl);
                } catch (error) {
                    return await handler.reply(from, '❌ Lien YouTube invalide ou vidéo non accessible.');
                }
            } else {
                // Rechercher la vidéo
                await handler.reply(from, `🔍 *Recherche en cours...* "${query}"`);

                const searchResults = await ytSearch(query);
                if (!searchResults.videos.length) {
                    return await handler.reply(from, '❌ Aucune vidéo trouvée pour cette recherche.');
                }

                const video = searchResults.videos[0];
                videoUrl = video.url;
                videoInfo = {
                    videoDetails: {
                        title: video.title,
                        author: { name: video.author.name },
                        lengthSeconds: video.duration.seconds,
                        viewCount: video.views
                    }
                };
            }

            // Vérifier la durée de la vidéo (limite: 10 minutes)
            const duration = parseInt(videoInfo.videoDetails.lengthSeconds);
            if (duration > 600) {
                return await handler.reply(from,
                    `⚠️ *Vidéo trop longue*\n\n` +
                    `⏱️ Durée: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}\n` +
                    `📏 Limite: 10 minutes\n\n` +
                    `💡 Veuillez choisir une vidéo plus courte.`
                );
            }

            await handler.react(from, msgInfo.msg.key, '⏳');

            const title = videoInfo.videoDetails.title;
            const author = videoInfo.videoDetails.author.name;
            const views = videoInfo.videoDetails.viewCount;
            const durationFormatted = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

            // Message d'information sur la vidéo
            const infoMsg = `╭─「 🎵 *YTMP3 DOWNLOAD* 」\n` +
                          `│\n` +
                          `│ 🎬 *ᴛɪᴛʀᴇ:* ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}\n` +
                          `│ 👤 *ᴀᴜᴛᴇᴜʀ:* ${author}\n` +
                          `│ ⏱️ *ᴅᴜʀᴇ́ᴇ:* ${durationFormatted}\n` +
                          `│ 👀 *ᴠᴜᴇs:* ${Number(views).toLocaleString()}\n` +
                          `│\n` +
                          `│ 📥 *ᴛᴇ́ʟᴇ́ᴄʜᴀʀɢᴇᴍᴇɴᴛ ᴇɴ ᴄᴏᴜʀs...*\n` +
                          `│ ⏳ *ᴠᴇᴜɪʟʟᴇᴢ ᴘᴀᴛɪᴇɴᴛᴇʀ...*\n` +
                          `│\n` +
                          `╰────────────────𖠇`;

            await handler.reply(from, infoMsg);

            // Créer le dossier temporaire
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            await fs.ensureDir(tempDir);

            const sanitizedTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 50);
            const audioPath = path.join(tempDir, `${sanitizedTitle}_${Date.now()}.mp3`);

            // Télécharger et convertir en MP3
            await new Promise((resolve, reject) => {
                const stream = ytdl(videoUrl, {
                    filter: 'audioonly',
                    quality: 'highestaudio'
                });

                ffmpeg(stream)
                    .audioBitrate(128)
                    .audioChannels(2)
                    .audioFrequency(44100)
                    .format('mp3')
                    .save(audioPath)
                    .on('end', () => {
                        console.log('*✅ ᴄᴏɴᴠᴇʀsɪᴏɴ ᴍᴘ3 ᴛᴇʀᴍɪɴᴇ́ᴇ*');
                        resolve();
                    })
                    .on('error', (error) => {
                        console.error('*❌ ᴇʀʀᴇᴜʀ ᴄᴏɴᴠᴇʀsɪᴏɴ:*', error);
                        reject(error);
                    });
            });

            // Vérifier la taille du fichier
            const stats = await fs.stat(audioPath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > 100) {
                await fs.remove(audioPath);
                return await handler.reply(from,
                    `*❌ ғɪᴄʜɪᴇʀ ᴛʀᴏᴘ ᴠᴏʟᴜᴍɪɴᴇᴜx*\n\n` +
                    `📊 ᴛᴀɪʟʟᴇ: ${fileSizeMB.toFixed(2)} ᴍʙ\n` +
                    `📏 ʟɪᴍɪᴛᴇ: 100 ᴍʙ\n\n` +
                    `💡 ᴄʜᴏɪsɪssᴇᴢ ᴜɴᴇ ᴠɪᴅᴇ́ᴏ ᴘʟᴜs ᴄᴏᴜʀᴛᴇ.`
                );
            }

            await handler.react(from, msgInfo.msg.key, '📤');

            // Envoyer le fichier audio
            const finalCaption = `╭──」 🎵 *AUDIO TÉLÉCHARGÉ* 」\n` +
                               `│\n` +
                               `│ 🎬 *Titre:* ${title}\n` +
                               `│ 👤 *Auteur:* ${author}\n` +
                               `│ ⏱️ *Durée:* ${durationFormatted}\n` +
                               `│ 📊 *Taille:* ${fileSizeMB.toFixed(2)} MB\n` +
                               `│ 🎵 *Format:* MP3 (128kbps)\n` +
                               `│\n` +
                               `╰────────────────𖠇\n\n` +
                               `${handler.config.BOT_FOOTER || '© HEINZ-MD BOT'}`;

            await socket.sendMessage(from, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: `${sanitizedTitle}.mp3`,
                caption: finalCaption,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: `Par ${author} • ${durationFormatted}`,
                        mediaType: 1,
                        sourceUrl: videoUrl,
                        thumbnailUrl: `https://img.youtube.com/vi/${ytdl.getURLVideoID(videoUrl)}/maxresdefault.jpg`
                    }
                }
            });

            await handler.react(from, msgInfo.msg.key, '✅');

            // Nettoyer le fichier temporaire
            setTimeout(async () => {
                try {
                    await fs.remove(audioPath);
                } catch (error) {
                    console.error('Erreur suppression fichier temp:', error);
                }
            }, 10000);

        } catch (error) {
            console.error('Erreur ytmp3:', error);
            await handler.react(from, msgInfo.msg.key, '❌');

            let errorMessage = '❌ *Erreur de téléchargement*\n\n';

            if (error.message.includes('Video unavailable')) {
                errorMessage += '🚫 *Vidéo non disponible*\n' +
                              'Cette vidéo pourrait être:\n' +
                              '• Privée ou supprimée\n' +
                              '• Géo-bloquée dans votre région\n' +
                              '• Soumise à des restrictions d\'âge';
            } else if (error.message.includes('format')) {
                errorMessage += '🎵 *Erreur de format*\n' +
                              'Impossible de traiter l\'audio de cette vidéo.\n' +
                              'Essayez avec une autre vidéo.';
            } else if (error.message.includes('network') || error.message.includes('timeout')) {
                errorMessage += '🌐 *Erreur réseau*\n' +
                              'Problème de connexion. Réessayez plus tard.';
            } else {
                errorMessage += `📝 *Détails:* ${error.message}`;
            }

            await handler.reply(from, errorMessage);
        }
    }
};
