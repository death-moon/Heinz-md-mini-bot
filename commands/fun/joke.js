module.exports = {
    name: 'joke',
    aliases: ['blague', 'rire', 'humour', 'mdr'],
    category: 'fun',
    description: 'Raconte une blague aléatoire pour vous faire rire',
    usage: '.joke [type]',
    cooldown: 5,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: false,
    hidden: false,

    async execute(socket, msgInfo, handler) {
        const { from, args } = msgInfo;

        try {
            await handler.react(from, msgInfo.msg.key, '😄');

            const jokeType = args[0]?.toLowerCase() || 'random';

            // Base de données de blagues par catégories
            const jokes = {
                dad: [
                    {
                        setup: "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ?",
                        punchline: "Parce que sinon, ils tombent dans le bateau ! 🚤"
                    },
                    {
                        setup: "Que dit un escargot quand il croise une limace ?",
                        punchline: "Regarde le nudiste ! 😂"
                    },
                    {
                        setup: "Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ?",
                        punchline: "Un chat-mallow ! 🎨"
                    },
                    {
                        setup: "Qu'est-ce qui est jaune et qui attend ?",
                        punchline: "Jonathan ! 🍌"
                    },
                    {
                        setup: "Pourquoi les poissons n'aiment pas jouer au tennis ?",
                        punchline: "Parce qu'ils ont peur du filet ! 🎾"
                    }
                ],
                tech: [
                    {
                        setup: "Pourquoi les programmeurs préfèrent-ils le mode sombre ?",
                        punchline: "Parce que la lumière attire les bugs ! 🐛"
                    },
                    {
                        setup: "Comment un développeur compte-t-il ses moutons ?",
                        punchline: "1, 2, 3, 4... Stack Overflow ! 💻"
                    },
                    {
                        setup: "Pourquoi les développeurs détestent la nature ?",
                        punchline: "Trop de bugs et pas de WiFi ! 🌿"
                    },
                    {
                        setup: "Qu'est-ce qui différencie un développeur junior d'un senior ?",
                        punchline: "Le junior casse le code, le senior casse la prod ! 🔥"
                    },
                    {
                        setup: "Combien de développeurs faut-il pour changer une ampoule ?",
                        punchline: "Aucun, c'est un problème hardware ! 💡"
                    }
                ],
                school: [
                    {
                        setup: "Que dit un prof de maths à un élève qui n'écoute pas ?",
                        punchline: "Tu peux répéter la question... en français ! 📚"
                    },
                    {
                        setup: "Pourquoi les livres de mathématiques sont-ils toujours tristes ?",
                        punchline: "Parce qu'ils ont trop de problèmes ! 📖"
                    },
                    {
                        setup: "Qu'est-ce qui est pire qu'un ver dans une pomme ?",
                        punchline: "Un demi-ver dans une pomme ! 🍎"
                    },
                    {
                        setup: "Comment appelle-t-on un étudiant qui arrive en retard ?",
                        punchline: "Un retardataire... comme d'habitude ! ⏰"
                    }
                ],
                food: [
                    {
                        setup: "Qu'est-ce qui est jaune et qui fait 'crac crac' ?",
                        punchline: "Un poussin qui mange des chips ! 🐣"
                    },
                    {
                        setup: "Pourquoi les tomates sont-elles rouges ?",
                        punchline: "Parce qu'elles ont vu la salade se déshabiller ! 🍅"
                    },
                    {
                        setup: "Que dit un cannibale en voyant un homme en fauteuil roulant ?",
                        punchline: "Oh chouette, un plateau-repas ! 🦽"
                    },
                    {
                        setup: "Comment appelle-t-on un café qui n'est pas payé ?",
                        punchline: "Un expresso ! ☕"
                    }
                ],
                animals: [
                    {
                        setup: "Qu'est-ce qui est blanc et se balance dans la forêt ?",
                        punchline: "Un éléphant qui fait de la luge ! 🐘"
                    },
                    {
                        setup: "Comment appelle-t-on un chien magicien ?",
                        punchline: "Un labracadabrador ! 🐕"
                    },
                    {
                        setup: "Que dit un pingouin qui mange trop salé ?",
                        punchline: "Ça pique ! ❄️"
                    },
                    {
                        setup: "Pourquoi les poules n'ont pas de seins ?",
                        punchline: "Parce que les coqs n'ont pas de mains ! 🐓"
                    }
                ],
                random: [
                    {
                        setup: "Qu'est-ce qui monte et descend mais ne bouge jamais ?",
                        punchline: "La température ! 🌡️"
                    },
                    {
                        setup: "Qu'est-ce qui a des dents mais ne peut pas mordre ?",
                        punchline: "Un peigne ! 💇‍♀️"
                    },
                    {
                        setup: "Comment appelle-t-on une voyante qui ne peut plus prédire l'avenir ?",
                        punchline: "Une ex-médium ! 🔮"
                    }
                ]
            };

            // Obtenir toutes les catégories disponibles
            const availableCategories = Object.keys(jokes);

            // Si une catégorie spécifique est demandée
            let selectedCategory = 'random';
            if (jokeType !== 'random' && availableCategories.includes(jokeType)) {
                selectedCategory = jokeType;
            } else if (jokeType !== 'random') {
                // Catégorie inconnue, afficher les catégories disponibles
                return await handler.reply(from,
                    `❌ *Catégorie de blague inconnue*\n\n` +
                    `📝 *Usage:* ${handler.config.PREFIX}joke [type]\n\n` +
                    `📂 *Catégories disponibles:*\n` +
                    `• \`dad\` - Blagues de papa 👨\n` +
                    `• \`tech\` - Blagues informatiques 💻\n` +
                    `• \`school\` - Blagues d'école 📚\n` +
                    `• \`food\` - Blagues sur la nourriture 🍕\n` +
                    `• \`animals\` - Blagues d'animaux 🐾\n` +
                    `• \`random\` - Blague aléatoire 🎲\n\n` +
                    `📖 *Exemple:* ${handler.config.PREFIX}joke tech`
                );
            }

            // Si random, choisir une catégorie aléatoire
            if (selectedCategory === 'random') {
                const categories = availableCategories.filter(cat => cat !== 'random');
                selectedCategory = categories[Math.floor(Math.random() * categories.length)];
            }

            // Sélectionner une blague aléatoire dans la catégorie
            const categoryJokes = jokes[selectedCategory];
            const selectedJoke = categoryJokes[Math.floor(Math.random() * categoryJokes.length)];

            // Emojis pour chaque catégorie
            const categoryEmojis = {
                dad: '👨',
                tech: '💻',
                school: '📚',
                food: '🍕',
                animals: '🐾'
            };

            const categoryEmoji = categoryEmojis[selectedCategory] || '😄';

            // Formater la blague
            let jokeText = `╭──「 ${categoryEmoji} *BLAGUE DU JOUR* 」\n`;
            jokeText += `│\n`;
            jokeText += `│ 📂 *Catégorie:* ${selectedCategory.toUpperCase()}\n`;
            jokeText += `│ 😄 *Niveau de rire:* Garanti !\n`;
            jokeText += `│\n`;
            jokeText += `╰────────────────𖠇\n\n`;

            jokeText += `❓ *${selectedJoke.setup}*\n\n`;

            // Attendre un peu avant la chute
            await handler.reply(from, jokeText + `⏳ *Réflexion en cours...*`);

            // Délai dramatique
            await new Promise(resolve => setTimeout(resolve, 3000));

            jokeText += `💡 *${selectedJoke.punchline}*\n\n`;

            jokeText += `───────────────────\n`;
            jokeText += `😂 *J'espère que ça vous a fait rire !*\n`;
            jokeText += `🔄 *Utilisez ${handler.config.PREFIX}joke pour une autre blague*\n`;
            jokeText += `📂 *Ou ${handler.config.PREFIX}joke <catégorie> pour un type spécifique*\n`;
            jokeText += `───────────────────\n`;
            jokeText += `${handler.config.BOT_FOOTER}`;

            // Réactions possibles pour la chute
            const reactions = ['😂', '🤣', '😆', '😄', '😁', '🙃'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];

            await socket.sendMessage(from, {
                text: jokeText,
                contextInfo: {
                    externalAdReply: {
                        title: `${categoryEmoji} Blague ${selectedCategory}`,
                        body: 'Heinz-md Comedy Club',
                        mediaType: 1,
                        sourceUrl: handler.config.GITHUB_REPO,
                        thumbnailUrl: 'https://files.catbox.moe/ym2qui.jpg',
                        renderLargerThumbnail: false
                    }
                }
            });

            await handler.react(from, msgInfo.msg.key, randomReaction);

            // Logger la blague racontée
            if (global.logger) {
                await global.logger.info('Joke told', {
                    user: msgInfo.sender,
                    category: selectedCategory,
                    setup: selectedJoke.setup.substring(0, 50)
                });
            }

        } catch (error) {
            console.error('Erreur dans la commande joke:', error);
            await handler.react(from, msgInfo.msg.key, '😅');

            await handler.reply(from,
                `😅 *Oups ! La blague a raté...*\n\n` +
                `❌ Une erreur s'est produite en racontant la blague.\n` +
                `📝 Détails: ${error.message}\n\n` +
                `💡 Mais voici une blague de secours:\n` +
                `❓ Pourquoi les bots font-ils des erreurs ?\n` +
                `💡 Parce qu'ils sont humains... Oh wait ! 🤖`
            );

            // Logger l'erreur
            if (global.logger) {
                await global.logger.error('Joke command error', {
                    user: msgInfo.sender,
                    error: error.message
                });
            }
        }
    }
};
