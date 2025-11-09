const os = require('os');
const moment = require('moment-timezone');
const fs = require('fs-extra');

module.exports = {
    name: 'stats',
    aliases: ['statistics', 'status', 'botstats'],
    category: 'owner',
    description: 'Affiche les statistiques détaillées du bot (Propriétaire uniquement)',
    usage: '.stats [detail]',
    cooldown: 10,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: true,
    hidden: false,

    async execute(socket, msgInfo, handler) {
        const { from, args } = msgInfo;

        try {
            await handler.react(from, msgInfo.msg.key, '📊');

            // Informations système
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            // Mémoire
            const processMemory = process.memoryUsage();
            const heapUsed = Math.round(processMemory.heapUsed / 1024 / 1024);
            const heapTotal = Math.round(processMemory.heapTotal / 1024 / 1024);
            const rss = Math.round(processMemory.rss / 1024 / 1024);

            // Système
            const totalMemory = Math.round(os.totalmem() / 1024 / 1024);
            const freeMemory = Math.round(os.freemem() / 1024 / 1024);
            const cpuCount = os.cpus().length;
            const platform = os.platform();
            const arch = os.arch();
            const nodeVersion = process.version;

            // Statistiques bot
            const totalCommands = handler.commands.size;
            let activeConnections = 0;
            let totalMessages = 0;
            let totalUsers = 0;
            let totalGroups = 0;
            let commandsExecuted = 0;

            // Obtenir les stats depuis la base de données si disponible
            if (global.db) {
                try {
                    const dbStats = await global.db.getStats();
                    totalMessages = dbStats.totalMessages || 0;
                    totalUsers = dbStats.totalUsers || 0;
                    totalGroups = dbStats.totalGroups || 0;
                    commandsExecuted = dbStats.totalCommands || 0;
                } catch (error) {
                    console.log('Erreur récupération stats DB:', error);
                }
            }

            // Obtenir les connexions actives
            if (global.botManager) {
                try {
                    const status = await global.botManager.getAllStatus();
                    activeConnections = Object.values(status).filter(bot => bot.active).length;
                } catch (error) {
                    console.log('Erreur récupération connexions:', error);
                }
            }

            // Statistiques des logs
            let logStats = {
                total: 0,
                errors: 0,
                warnings: 0
            };

            if (global.logger) {
                try {
                    logStats = await global.logger.getStats();
                } catch (error) {
                    console.log('Erreur récupération logs stats:', error);
                }
            }

            // Date de démarrage
            const startTime = moment().subtract(uptime, 'seconds').tz('Africa/Douala');
            const currentTime = moment().tz('Africa/Douala');

            let statsText = `╭─「 *🦄STATUTS* 」\n`;
            statsText += `│     📊 *STATISTIQUES BOT*     │\n`;
            statsText += `│    👑 *PROPRIÉTAIRE UNIQUEMENT*  │\n`;
            statsText += `╰────────────────𖠇\n\n`;

            statsText += `╭─「 🤖 *BOT STATS* 」\n`;
            statsText += `│\n`;
            statsText += `│ 🚀 *ᴅᴇ́ᴍᴀʀʀᴇ́:* ${startTime.format('DD/MM/YYYY HH:mm:ss')}\n`;
            statsText += `│ ⏰ *ᴜᴘᴛɪᴍᴇ:* ${days}j ${hours}ʜ ${minutes}ᴍ ${seconds}s\n`;
            statsText += `│ 📱 *ᴄᴏɴɴᴇxɪᴏɴs ᴀᴄᴛɪᴠᴇs:* ${activeConnections}\n`;
            statsText += `│ 📚 *ᴄᴏᴍᴍᴀɴᴅᴇs ᴅɪsᴘᴏɴɪʙʟᴇs:* ${totalCommands}\n`;
            statsText += `│ ⚡ *ᴄᴏᴍᴍᴀɴᴅᴇs ᴇxᴇ́ᴄᴜᴛᴇ́ᴇs:* ${commandsExecuted.toLocaleString()}\n`;
            statsText += `│ 💬 *ᴍᴇssᴀɢᴇs ᴛʀᴀɪᴛᴇ́s:* ${totalMessages.toLocaleString()}\n`;
            statsText += `│ 👥 *ᴜᴛɪʟɪsᴀᴛᴇᴜʀs ᴜɴɪǫᴜᴇs:* ${totalUsers.toLocaleString()}\n`;
            statsText += `│ 🏘️ *ɢʀᴏᴜᴘᴇs ᴄᴏɴɴᴇᴄᴛᴇ́s:* ${totalGroups.toLocaleString()}\n`;
            statsText += `│\n`;
            statsText += `╰───────────────𖠇\n\n`;

            statsText += `╭──「 💻 *SYSTÈME* 」\n`;
            statsText += `│\n`;
            statsText += `│ 🖥️ *ᴏs:* ${platform} (${arch})\n`;
            statsText += `│ ⚡ *ɴᴏᴅᴇ.ᴊs:* ${nodeVersion}\n`;
            statsText += `│ 🔧 *ᴄᴘᴜ ᴄᴏʀᴇs:* ${cpuCount}\n`;
            statsText += `│ 🧠 *ʀᴀᴍ sʏsᴛᴇ̀ᴍᴇ:* ${(totalMemory - freeMemory)}ᴍʙ / ${totalMemory}ᴍʙ\n`;
            statsText += `│ 💾 *ʀᴀᴍ ʟɪʙʀᴇ:* ${freeMemory}ᴍʙ (${Math.round((freeMemory/totalMemory)*100)}%)\n`;
            statsText += `│ 🚀 *ᴘʀᴏᴄᴇss ʜᴇᴀᴘ:* ${heapUsed}ᴍʙ / ${heapTotal}ᴍʙ\n`;
            statsText += `│ 📊 *ᴘʀᴏᴄᴇss ʀss:* ${rss}ᴍʙ\n`;
            statsText += `│\n`;
            statsText += `╰───────────────𖠇\n\n`;

            statsText += `╭──「 📋 *LOGS & ERREURS* 」\n`;
            statsText += `│\n`;
            statsText += `│ 📝 *ᴛᴏᴛᴀʟ ʟᴏɢs:* ${logStats.total || 0}\n`;
            statsText += `│ ⚠️ *ᴡᴀʀɴɪɴɢs:* ${logStats.byLevel?.warn || 0}\n`;
            statsText += `│ ❌ *ᴇʀʀᴇᴜʀs:* ${logStats.byLevel?.error || 0}\n`;
            statsText += `│ 💀 *ᴇʀʀᴇᴜʀs ғᴀᴛᴀʟᴇs:* ${logStats.byLevel?.fatal || 0}\n`;
            statsText += `│ 💽 *ᴇsᴘᴀᴄᴇ ʟᴏɢs:* ${Math.round((logStats.diskUsage || 0) / 1024 / 1024)}ᴍʙ\n`;
            statsText += `│\n`;
            statsText += `╰───────────────𖠇\n\n`;

            // Performance et charge
            const loadAvg = os.loadavg();
            const cpuUsage = process.cpuUsage();

            statsText += `╭──「 ⚡ *PERFORMANCE* 」\n`;
            statsText += `│\n`;
            statsText += `│ 📈 *Load Average:*\n`;
            statsText += `│   • 1min: ${loadAvg[0].toFixed(2)}\n`;
            statsText += `│   • 5min: ${loadAvg[1].toFixed(2)}\n`;
            statsText += `│   • 15min: ${loadAvg[2].toFixed(2)}\n`;
            statsText += `│ 🔄 *CPU Usage:*\n`;
            statsText += `│   • User: ${Math.round(cpuUsage.user / 1000)}ms\n`;
            statsText += `│   • System: ${Math.round(cpuUsage.system / 1000)}ms\n`;
            statsText += `│ 🕒 *Event Loop Lag:* En cours...\n`;
            statsText += `│\n`;
            statsText += `╰──────────────𖠇\n\n`;

            // Si argument "detail" fourni, ajouter plus d'infos
            if (args[0] === 'detail' || args[0] === 'detailed') {
                // Variables d'environnement importantes
                const envVars = {
                    NODE_ENV: process.env.NODE_ENV || 'development',
                    DEBUG: process.env.DEBUG || 'false',
                    PORT: process.env.PORT || '3000'
                };

                statsText += `╭─「 🔧 *CONFIGURATION* 」\n`;
                statsText += `│\n`;
                for (const [key, value] of Object.entries(envVars)) {
                    statsText += `│ 📝 *${key}:* ${value}\n`;
                }
                statsText += `│ 🔑 *ᴀᴘɪs ᴄᴏɴғɪɢᴜʀᴇ́ᴇs:* ${this.countConfiguredAPIs()}\n`;
                statsText += `│\n`;
                statsText += `╰──────────────𖠇\n\n`;

                // Top commandes les plus utilisées
                if (global.db) {
                    try {
                        const topCommands = await global.db.getTopCommands(5);
                        if (topCommands.length > 0) {
                            statsText += `╭─「 🏆 *TOP COMMANDES* 」\n`;
                            statsText += `│\n`;
                            for (let i = 0; i < topCommands.length; i++) {
                                const cmd = topCommands[i];
                                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
                                statsText += `│ ${medal} *${cmd.name}:* ${cmd.count} fois\n`;
                            }
                            statsText += `│\n`;
                            statsText += `╰────────────────𖠇\n\n`;
                        }
                    } catch (error) {
                        console.log('Erreur récupération top commandes:', error);
                    }
                }
            }

            // Footer
            statsText += `╭─「 ℹ️ *INFORMATIONS* 」\n`;
            statsText += `│\n`;
            statsText += `│ 📊 *ᴅᴇʀɴɪᴇ̀ʀᴇ ᴍɪsᴇ ᴀ̀ ᴊᴏᴜʀ:* ${currentTime.format('HH:mm:ss')}\n`;
            statsText += `│ 💡 *ᴜᴛɪʟɪsᴇᴢ .sᴛᴀᴛs ᴅᴇᴛᴀɪʟ* ᴘᴏᴜʀ ᴘʟᴜs ᴅ'ɪɴғᴏs\n`;
            statsText += `│ 🔄 *ᴀᴜᴛᴏ-ʀᴇғʀᴇsʜ:* ᴄʜᴀǫᴜᴇ ᴍɪɴᴜᴛᴇ\n`;
            statsText += `│\n`;
            statsText += `╰──────────────𖠇\n\n`;

            statsText += `${handler.config.BOT_FOOTER}`;

            // Envoyer avec image du dashboard
            const statsImageUrl = 'https://files.catbox.moe/ym2qui.jpg';

            await socket.sendMessage(from, {
                image: { url: statsImageUrl },
                caption: statsText,
                contextInfo: {
                    externalAdReply: {
                        title: '📊 ʜᴇɪɴᴢ-ᴍᴅ sᴛᴀᴛɪsᴛɪᴄs ᴅᴀsʜʙᴏᴀʀᴅ',
                        body: `${totalMessages} messages • ${activeConnections} connexions actives`,
                        mediaType: 1,
                        sourceUrl: handler.config.GITHUB_REPO,
                        thumbnailUrl: statsImageUrl,
                        renderLargerThumbnail: true
                    }
                }
            });

            await handler.react(from, msgInfo.msg.key, '✅');

        } catch (error) {
            console.error('Erreur dans la commande stats:', error);
            await handler.react(from, msgInfo.msg.key, '❌');
            await handler.reply(from,
                '❌ *Erreur lors de la récupération des statistiques*\n\n' +
                `📝 ᴅᴇ́ᴛᴀɪʟs: ${error.message}`
            );
        }
    },

    // Méthode helper pour compter les APIs configurées
    countConfiguredAPIs() {
        const apis = [
            'OPENAI_API_KEY',
            'GEMINI_API_KEY',
            'WEATHER_API_KEY',
            'YOUTUBE_API_KEY',
            'SPOTIFY_CLIENT_ID',
            'GITHUB_TOKEN',
            'REMOVE_BG_KEY',
            'NEWS_API_KEY'
        ];

        return apis.filter(api => process.env[api] && process.env[api].length > 5).length;
    }
};
