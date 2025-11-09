const util = require('util');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    name: 'eval',
    aliases: ['>', 'exec', 'js'],
    category: 'owner',
    description: 'Exécute du code JavaScript dans le contexte du bot (Propriétaire uniquement - DANGEREUX)',
    usage: '.eval <code JavaScript>',
    cooldown: 5,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: true,
    hidden: true, // Cachée du menu pour sécurité

    async execute(socket, msgInfo, handler) {
        const { from, args, text, sender } = msgInfo;

        if (!args.length) {
            return await handler.reply(from,
                `❌ *Code JavaScript requis*\n\n` +
                `📝 *Usage:* ${handler.config.PREFIX}eval <code>\n\n` +
                `⚠️ *ATTENTION:* Cette commande peut modifier le système!\n\n` +
                `📖 *Exemples:*\n` +
                `• \`${handler.config.PREFIX}eval 2 + 2\`\n` +
                `• \`${handler.config.PREFIX}eval process.version\`\n` +
                `• \`${handler.config.PREFIX}eval handler.commands.size\``
            );
        }

        const code = args.join(' ');

        // Log de sécurité
        if (global.logger) {
            await global.logger.warn(`EVAL command executed by ${sender}`, {
                code: code.substring(0, 200),
                sender,
                timestamp: new Date().toISOString()
            });
        }

        try {
            await handler.react(from, msgInfo.msg.key, '⚡');

            // Message d'avertissement pour les commandes dangereuses
            const dangerousPatterns = [
                'rm ', 'del ', 'delete', 'unlink',
                'process.exit', 'process.kill',
                'require(', 'import(',
                'exec(', 'spawn(', 'child_process',
                'fs.rm', 'fs.unlink', 'fs.write'
            ];

            const isDangerous = dangerousPatterns.some(pattern =>
                code.toLowerCase().includes(pattern.toLowerCase())
            );

            if (isDangerous) {
                const warningMsg = `⚠️ *CODE POTENTIELLEMENT DANGEREUX DÉTECTÉ*\n\n` +
                                 `🔥 Le code suivant pourrait affecter le système:\n` +
                                 `\`\`\`${code.substring(0, 100)}${code.length > 100 ? '...' : ''}\`\`\`\n\n` +
                                 `⏳ Exécution dans 5 secondes...\n` +
                                 `💡 Tapez \`.cancel\` pour annuler`;

                await handler.reply(from, warningMsg);

                // Attendre 5 secondes
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Contexte d'exécution sécurisé
            const context = {
                socket,
                handler,
                msgInfo,
                from,
                sender,
                config: handler.config,
                db: global.db,
                logger: global.logger,
                botManager: global.botManager,
                console,
                util,
                process: {
                    version: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    uptime: process.uptime,
                    memoryUsage: process.memoryUsage,
                    // Pas d'accès aux méthodes dangereuses
                },
                Math,
                Date,
                JSON,
                Buffer,
                setTimeout,
                setInterval,
                clearTimeout,
                clearInterval
            };

            const startTime = Date.now();
            let result;

            // Fonction d'évaluation async
            const asyncEval = async (code) => {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const contextKeys = Object.keys(context);
                const contextValues = Object.values(context);

                const func = new AsyncFunction(...contextKeys,
                    `"use strict"; return (async () => { ${code} })()`
                );

                return await func(...contextValues);
            };

            try {
                result = await Promise.race([
                    asyncEval(code),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout: Code execution exceeded 30 seconds')), 30000)
                    )
                ]);
            } catch (error) {
                result = error;
            }

            const executionTime = Date.now() - startTime;

            // Formater le résultat
            let output;
            let isError = false;

            if (result instanceof Error) {
                isError = true;
                output = `❌ *Erreur d'exécution:*\n\n` +
                        `\`\`\`\n${result.name}: ${result.message}\n\`\`\``;

                if (result.stack) {
                    const stackLines = result.stack.split('\n').slice(0, 5);
                    output += `\n\n*Stack trace (5 premières lignes):*\n\`\`\`\n${stackLines.join('\n')}\n\`\`\``;
                }
            } else {
                const inspected = util.inspect(result, {
                    depth: 3,
                    colors: false,
                    compact: false,
                    breakLength: 60,
                    maxArrayLength: 10,
                    maxStringLength: 200
                });

                const resultType = typeof result;
                const resultConstructor = result?.constructor?.name || 'Unknown';

                output = `✅ *Exécution réussie*\n\n` +
                        `🔍 *Type:* ${resultType}\n` +
                        `🏗️ *Constructeur:* ${resultConstructor}\n` +
                        `⏱️ *Temps:* ${executionTime}ms\n\n` +
                        `📤 *Résultat:*\n\`\`\`\n${inspected}\n\`\`\``;
            }

            // Limiter la taille de sortie
            if (output.length > 4000) {
                output = output.substring(0, 3900) + '\n\n... *(Résultat tronqué)*\`\`\`';
            }

            // Informations sur le code exécuté
            const codeInfo = `╭─「💻 *EVAL DEBUGGER* 」\n` +
                           `│\n` +
                           `│ 👤 *Exécuté par:* ${msgInfo.pushName}\n` +
                           `│ 📱 *Numéro:* ${sender.replace('@s.whatsapp.net', '')}\n` +
                           `│ ⏱️ *Timestamp:* ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}\n` +
                           `│ 📏 *Taille code:* ${code.length} caractères\n` +
                           `│ ${isDangerous ? '⚠️ *Niveau:* DANGEREUX' : '✅ *Niveau:* SÛRE'}\n` +
                           `│\n` +
                           `╰───────────────𖠇\n\n`;

            const codeBlock = `💻 *Code exécuté:*\n\`\`\`javascript\n${code}\n\`\`\`\n\n`;

            const fullResponse = codeInfo + codeBlock + output;

            await handler.reply(from, fullResponse);
            await handler.react(from, msgInfo.msg.key, isError ? '❌' : '✅');

            // Log détaillé
            if (global.logger) {
                await global.logger.info(`EVAL ${isError ? 'ERROR' : 'SUCCESS'}`, {
                    sender,
                    code: code.substring(0, 500),
                    executionTime,
                    resultType: typeof result,
                    error: isError ? result.message : null,
                    dangerous: isDangerous
                });
            }

        } catch (error) {
            console.error('Erreur fatale dans eval:', error);
            await handler.react(from, msgInfo.msg.key, '💥');

            await handler.reply(from,
                `💥 *Erreur fatale du système*\n\n` +
                `❌ *Type:* ${error.name}\n` +
                `📝 *Message:* ${error.message}\n\n` +
                `🚨 *Le code a provoqué une erreur système critique!*\n` +
                `⚠️ *Veuillez vérifier les logs du serveur*\n\n` +
                `💻 *Code problématique:*\n\`\`\`\n${code.substring(0, 200)}${code.length > 200 ? '...' : ''}\n\`\`\``
            );

            // Log d'urgence
            if (global.logger) {
                await global.logger.fatal('EVAL FATAL ERROR', {
                    sender,
                    code,
                    error: error.message,
                    stack: error.stack
                });
            }
        }
    }
};
