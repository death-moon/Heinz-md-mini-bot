module.exports = {
    name: 'broadcast',
    aliases: ['bc', 'sendall', 'announce'],
    category: 'owner',
    description: 'Diffuse un message à tous les utilisateurs ou groupes connectés au bot (Propriétaire uniquement)',
    usage: '.broadcast <users|groups|all> <message>',
    cooldown: 60,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: true,
    hidden: false,

    async execute(socket, msgInfo, handler) {
        const { from, args, text } = msgInfo;

        if (args.length < 2) {
            return await handler.reply(from,
                `❌ *ᴜᴛɪʟɪsᴀᴛɪᴏɴ ɪɴᴄᴏʀʀᴇᴄᴛᴇ*\n\n` +
                `📝 *ᴜsᴀɢᴇ:* ${handler.config.PREFIX}ʙʀᴏᴀᴅᴄᴀsᴛ <ᴛʏᴘᴇ> <ᴍᴇssᴀɢᴇ>\n\n` +
                `📖 *ᴛʏᴘᴇs ᴅɪsᴘᴏɴɪʙʟᴇs:*\n` +
                `• \`ᴜsᴇʀs\` - ᴅɪғғᴜsᴇʀ ᴀᴜx ᴜᴛɪʟɪsᴀᴛᴇᴜʀs ᴘʀɪᴠᴇ́s\n` +
                `• \`ɢʀᴏᴜᴘs\` - ᴅɪғғᴜsᴇʀ ᴀᴜx ɢʀᴏᴜᴘᴇs\n` +
                `• \`ᴀʟʟ\` - ᴅɪғғᴜsᴇʀ ᴀ̀ ᴛᴏᴜs\n\n` +
                `📌 *ᴇxᴇᴍᴘʟᴇs:*\n` +
                `• ${handler.config.PREFIX}ʙʀᴏᴀᴅᴄᴀsᴛ ᴜsᴇʀs ɴᴏᴜᴠᴇʟʟᴇ ᴍɪsᴇ ᴀ̀ ᴊᴏᴜʀ ᴅɪsᴘᴏɴɪʙʟᴇ!\n` +
                `• ${handler.config.PREFIX}ʙʀᴏᴀᴅᴄᴀsᴛ ɢʀᴏᴜᴘs ʟᴇ ʙᴏᴛ sᴇʀᴀ ᴇɴ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ ᴅᴇᴍᴀɪɴ\n` +
                `• ${handler.config.PREFIX}ʙʀᴏᴀᴅᴄᴀsᴛ ᴀʟʟ ᴊᴏʏᴇᴜx ɴᴏᴇ̈ʟ ᴀ̀ ᴛᴏᴜs! 🎄`
            );
        }

        const broadcastType = args[0].toLowerCase();
        const message = args.slice(1).join(' ');

        if (!['users', 'groups', 'all'].includes(broadcastType)) {
            return await handler.reply(from,
                `❌ *ᴛʏᴘᴇ ᴅᴇ ᴅɪғғᴜsɪᴏɴ ɪɴᴠᴀʟɪᴅᴇ*\n\n` +
                `✅ ᴛʏᴘᴇs ᴠᴀʟɪᴅᴇs: \`ᴜsᴇʀs\`, \`ɢʀᴏᴜᴘs\`, \`ᴀʟʟ\``
            );
        }

        try {
            await handler.react(from, msgInfo.msg.key, '📡');

            // Message de confirmation
            const confirmText = `╭─「 📡 *BROADCAST SYSTEM* 」\n` +
                              `│\n` +
                              `│ 📋 *ᴛʏᴘᴇ:* ${broadcastType.toUpperCase()}\n` +
                              `│ 📝 *ᴍᴇssᴀɢᴇ:* ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}\n` +
                              `│ 👤 *ᴇxᴘᴇ́ᴅɪᴛᴇᴜʀ:* ${msgInfo.pushName}\n` +
                              `│\n` +
                              `│ ⏳ *ᴘʀᴇ́ᴘᴀʀᴀᴛɪᴏɴ ᴅᴇ ʟᴀ ᴅɪғғᴜsɪᴏɴ...*\n` +
                              `│\n` +
                              `╰───────────────𖠇`;

            await handler.reply(from, confirmText);

            // Obtenir la liste des chats
            let targetChats = [];

            if (global.db) {
                try {
                    if (broadcastType === 'users' || broadcastType === 'all') {
                        const users = await global.db.getAllUsers();
                        targetChats = targetChats.concat(users.map(user => ({ jid: user.jid, type: 'user' })));
                    }

                    if (broadcastType === 'groups' || broadcastType === 'all') {
                        const groups = await global.db.getAllGroups();
                        targetChats = targetChats.concat(groups.map(group => ({ jid: group.jid, type: 'group' })));
                    }
                } catch (error) {
                    console.error('Erreur récupération chats depuis DB:', error);
                }
            }

            // Si pas de DB, essayer d'obtenir depuis les chats récents
            if (targetChats.length === 0) {
                try {
                    const chats = await socket.getChats();
                    for (const chat of chats) {
                        if (broadcastType === 'users' || broadcastType === 'all') {
                            if (!chat.id.endsWith('@g.us')) {
                                targetChats.push({ jid: chat.id, type: 'user' });
                            }
                        }
                        if (broadcastType === 'groups' || broadcastType === 'all') {
                            if (chat.id.endsWith('@g.us')) {
                                targetChats.push({ jid: chat.id, type: 'group' });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur récupération chats:', error);
                }
            }

            if (targetChats.length === 0) {
                return await handler.reply(from,
                    `❌ *ᴀᴜᴄᴜɴ ᴅᴇsᴛɪɴᴀᴛᴀɪʀᴇ ᴛʀᴏᴜᴠᴇ́*\n\n` +
                    `📝 ᴀᴜᴄᴜɴ ᴄʜᴀᴛ ᴛʀᴏᴜᴠᴇ́ ᴘᴏᴜʀ ʟᴇ ᴛʏᴘᴇ: ${broadcastType}`
                );
            }

            // Préparer le message de diffusion
            const broadcastHeader = `╭─「 📢 *ANNONCE OFFICIELLE* 」\n` +
                                  `│          🤖 *${handler.config.BOT_NAME}*          │\n` +
                             `╰────────────────𖠇\n\n`;

            const broadcastFooter = `\n\n────────────────────\n` +
                                  `📱 *Support:* ${handler.config.SUPPORT_GROUP}\n` +
                                  `📺 *Chaîne:* ${handler.config.CHANNEL_LINK}\n` +
                                  `───────────────────────\n` +
                                  `${handler.config.BOT_FOOTER}`;

            const fullMessage = broadcastHeader + message + broadcastFooter;

            // Commencer la diffusion
            let successCount = 0;
            let failCount = 0;
            const totalChats = targetChats.length;

            await handler.reply(from,
                `📡 *ᴅɪғғᴜsɪᴏɴ ᴅᴇ́ᴍᴀʀʀᴇ́ᴇ...*\n\n` +
                `📊 *ᴅᴇsᴛɪɴᴀᴛᴀɪʀᴇs:* ${totalChats}\n` +
                `⏳ *ᴠᴇᴜɪʟʟᴇᴢ ᴘᴀᴛɪᴇɴᴛᴇʀ...*`
            );

            // Diffuser avec délai pour éviter le spam
            for (let i = 0; i < targetChats.length; i++) {
                const chat = targetChats[i];

                try {
                    // Vérifier si c'est notre propre numéro
                    if (chat.jid === from) continue;

                    await socket.sendMessage(chat.jid, {
                        text: fullMessage,
                        contextInfo: {
                            externalAdReply: {
                                title: `📢 ᴀɴɴᴏɴᴄᴇ ᴅᴇ ${handler.config.BOT_NAME}`,
                                body: 'ᴍᴇssᴀɢᴇ ᴏғғɪᴄɪᴇʟ ᴅᴜ ᴘʀᴏᴘʀɪᴇ́ᴛᴀɪʀᴇ ᴅᴜ ʙᴏᴛ',
                                mediaType: 1,
                                sourceUrl: handler.config.GITHUB_REPO,
                                thumbnailUrl: 'https://files.catbox.moe/y0ra0d.jpg'
                            }
                        }
                    });

                    successCount++;

                    // Log pour le propriétaire
                    if (global.logger) {
                        await global.logger.info(`ʙʀᴏᴀᴅᴄᴀsᴛ ᴇɴᴠᴏʏᴇ́ ᴀ̀ ${chat.jid}`, {
                            type: chat.type,
                            message: message.substring(0, 100)
                        });
                    }

                } catch (error) {
                    failCount++;
                    console.error(`Erreur envoi à ${chat.jid}:`, error);
                }

                // Délai entre les envois pour éviter le rate limiting
                if (i < targetChats.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seconde
                }

                // Mettre à jour le progress tous les 10 envois
                if ((i + 1) % 10 === 0) {
                    const progress = Math.round(((i + 1) / totalChats) * 100);
                    await handler.reply(from,
                        `📊 *ᴘʀᴏɢʀᴇssɪᴏɴ:* ${progress}%\n` +
                        `✅ *sᴜᴄᴄᴇ̀s:* ${successCount}\n` +
                        `❌ *ᴇ́ᴄʜᴇᴄs:* ${failCount}`
                    );
                }
            }

            // Rapport final
            const finalReport = `╭─「 📊 *RAPPORT DE DIFFUSION* 」\n` +
                               `│\n` +
                               `│ 📡 *ᴛʏᴘᴇ:* ${broadcastType.toUpperCase()}\n` +
                               `│ 📊 *ᴛᴏᴛᴀʟ ᴅᴇsᴛɪɴᴀᴛᴀɪʀᴇs:* ${totalChats}\n` +
                               `│ ✅ *ᴇɴᴠᴏʏᴇ́s ᴀᴠᴇᴄ sᴜᴄᴄᴇ̀s:* ${successCount}\n` +
                               `│ ❌ *ᴇ́ᴄʜᴇᴄs:* ${failCount}\n` +
                               `│ 📈 *ᴛᴀᴜx ᴅᴇ ʀᴇ́ᴜssɪᴛᴇ:* ${Math.round((successCount/totalChats)*100)}%\n` +
                               `│\n` +
                               `│ ⏱️ *ᴛᴇᴍᴘs ᴛᴏᴛᴀʟ:* ${Math.round(totalChats * 1.2)}s ᴇɴᴠɪʀᴏɴ\n` +
                               `│ 📝 *ᴍᴇssᴀɢᴇ:* "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"\n` +
                               `│\n` +
                               `╰────────────────𖠇\n\n` +
                               `${successCount > 0 ? '✅ ᴅɪғғᴜsɪᴏɴ ᴛᴇʀᴍɪɴᴇ́ᴇ ᴀᴠᴇᴄ sᴜᴄᴄᴇ̀s!' : '❌ ᴅɪғғᴜsɪᴏɴ ᴇ́ᴄʜᴏᴜᴇ́ᴇ!'}`;

            await handler.reply(from, finalReport);
            await handler.react(from, msgInfo.msg.key, successCount > failCount ? '✅' : '⚠️');

            // Enregistrer la diffusion dans les logs
            if (global.logger) {
                await global.logger.info('Broadcast completed', {
                    type: broadcastType,
                    total: totalChats,
                    success: successCount,
                    failed: failCount,
                    message: message.substring(0, 100),
                    sender: msgInfo.sender
                });
            }

        } catch (error) {
            console.error('Erreur dans la commande broadcast:', error);
            await handler.react(from, msgInfo.msg.key, '❌');

            await handler.reply(from,
                `❌ *ᴇʀʀᴇᴜʀ ʟᴏʀs ᴅᴇ ʟᴀ ᴅɪғғᴜsɪᴏɴ*\n\n` +
                `📝 *ᴅᴇ́ᴛᴀɪʟs:* ${error.message}\n\n` +
                `💡 *sᴜɢɢᴇsᴛɪᴏɴs:*\n` +
                `• ᴠᴇ́ʀɪғɪᴇᴢ ᴠᴏᴛʀᴇ ᴄᴏɴɴᴇxɪᴏɴ ɪɴᴛᴇʀɴᴇᴛ\n` +
                `• ʀᴇ́ᴇssᴀʏᴇᴢ ᴀᴠᴇᴄ ᴜɴ ᴍᴇssᴀɢᴇ ᴘʟᴜs ᴄᴏᴜʀᴛ\n` +
                `• ᴄᴏɴᴛᴀᴄᴛᴇᴢ ʟᴇ ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇᴜʀ sɪ ʟᴇ ᴘʀᴏʙʟᴇ̀ᴍᴇ ᴘᴇʀsɪsᴛᴇ`
            );
        }
    }
};
