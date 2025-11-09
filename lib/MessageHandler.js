const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const {
  downloadContentFromMessage,
  getContentType,
} = require("@whiskeysockets/baileys");

class MessageHandler {
  constructor(socket, config = {}) {
    this.socket = socket;
    this.config = config;
    this.commands = new Map();
    this.cooldowns = new Map();
    this.spamCount = new Map();
    this.loadCommands();
  }

  /**
   * Charger toutes les commandes
   */
  async loadCommands() {
    const commandsPath = path.join(__dirname, "..", "commands");

    // Créer le dossier commands s'il n'existe pas
    await fs.ensureDir(commandsPath);

    // Créer les sous-dossiers de catégories
    const categories = [
      "general",
      "download",
      "search",
      "tools",
      "fun",
      "group",
      "owner",
      "economy",
      "ai",
    ];

    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);
      await fs.ensureDir(categoryPath);

      // Charger les commandes de cette catégorie
      if (await fs.pathExists(categoryPath)) {
        const files = await fs.readdir(categoryPath);
        for (const file of files) {
          if (file.endsWith(".js")) {
            try {
              const command = require(path.join(categoryPath, file));
              if (command.name) {
                this.commands.set(command.name.toLowerCase(), {
                  ...command,
                  category,
                });
                // Ajouter les alias
                if (command.aliases) {
                  for (const alias of command.aliases) {
                    this.commands.set(alias.toLowerCase(), {
                      ...command,
                      category,
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Erreur lors du chargement de ${file}:`, error);
            }
          }
        }
      }
    }

    console.log(`📚 ${this.commands.size} commandes chargées`);
  }

  /**
   * Traiter un message entrant
   */
  async handleMessage(msg) {
    try {
      // Extraire les informations du message
      const msgInfo = await this.extractMessageInfo(msg);
      if (!msgInfo) return;

      // Vérifier le spam
      if (await this.checkSpam(msgInfo.from)) {
        if (this.config.AUTO_BLOCK_SPAM) {
          await this.socket.updateBlockStatus(msgInfo.from, "block");
        }
        return;
      }

      // Gérer les fonctionnalités automatiques
      await this.handleAutoFeatures(msgInfo);

      // Vérifier si c'est une commande
      if (msgInfo.isCommand) {
        await this.handleCommand(msgInfo);
      } else {
        // Gérer les messages non-commande
        await this.handleNonCommand(msgInfo);
      }

      // Enregistrer les statistiques
      await this.updateStats(msgInfo);
    } catch (error) {
      console.error("Erreur dans handleMessage:", error);
    }
  }

  /**
   * Extraire les informations du message
   */
  async extractMessageInfo(msg) {
    try {
      const type = getContentType(msg.message);
      if (!type) return null;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const sender = isGroup ? msg.key.participant : from;
      const pushName = msg.pushName || "Unknown";
      const messageTimestamp = msg.messageTimestamp;

      // Extraire le texte du message
      let text = "";
      let quoted = null;

      if (type === "conversation") {
        text = msg.message.conversation;
      } else if (type === "imageMessage") {
        text = msg.message.imageMessage.caption || "";
      } else if (type === "videoMessage") {
        text = msg.message.videoMessage.caption || "";
      } else if (type === "extendedTextMessage") {
        text = msg.message.extendedTextMessage.text || "";
        quoted = msg.message.extendedTextMessage.contextInfo?.quotedMessage;
      } else if (type === "buttonsResponseMessage") {
        text = msg.message.buttonsResponseMessage.selectedButtonId || "";
      } else if (type === "listResponseMessage") {
        text =
          msg.message.listResponseMessage.singleSelectReply?.selectedRowId ||
          "";
      } else if (type === "templateButtonReplyMessage") {
        text = msg.message.templateButtonReplyMessage.selectedId || "";
      }

      // Vérifier si c'est une commande
      const prefix = this.config.PREFIX || ".";
      const isCommand = text.startsWith(prefix);
      let command = "";
      let args = [];

      if (isCommand) {
        const cmdText = text.slice(prefix.length).trim();
        const parts = cmdText.split(/\s+/);
        command = parts[0].toLowerCase();
        args = parts.slice(1);
      }

      return {
        msg,
        type,
        from,
        isGroup,
        sender,
        pushName,
        text,
        command,
        args,
        isCommand,
        quoted,
        messageTimestamp,
        isOwner:
          sender.replace("@s.whatsapp.net", "") === this.config.OWNER_NUMBER,
        isBot: msg.key.fromMe,
      };
    } catch (error) {
      console.error("Erreur dans extractMessageInfo:", error);
      return null;
    }
  }

  /**
   * Gérer une commande
   */
  async handleCommand(msgInfo) {
    const { command, from, sender, isGroup } = msgInfo;

    // Vérifier si la commande existe
    const cmd = this.commands.get(command);
    if (!cmd) {
      // Commande non trouvée, suggérer des commandes similaires
      const suggestions = this.findSimilarCommands(command);
      if (suggestions.length > 0) {
        await this.reply(
          from,
          `❌ Commande "${command}" non trouvée.\n\n` +
            `💡 Suggestions: ${suggestions.map((s) => `*${this.config.PREFIX}${s}*`).join(", ")}`,
        );
      }
      return;
    }

    // Vérifier les permissions
    if (cmd.ownerOnly && !msgInfo.isOwner) {
      await this.reply(from, this.config.MESSAGES.ONLY_OWNER);
      return;
    }

    if (cmd.groupOnly && !isGroup) {
      await this.reply(from, this.config.MESSAGES.ONLY_GROUP);
      return;
    }

    if (cmd.privateOnly && isGroup) {
      await this.reply(from, this.config.MESSAGES.ONLY_PRIVATE);
      return;
    }

    // Vérifier le cooldown
    if (await this.checkCooldown(sender, command)) {
      await this.reply(from, this.config.MESSAGES.RATE_LIMIT);
      return;
    }

    // Vérifier les permissions admin si nécessaire
    if (cmd.adminOnly && isGroup) {
      const groupMetadata = await this.socket.groupMetadata(from);
      const participant = groupMetadata.participants.find(
        (p) => p.id === sender,
      );
      if (!participant?.admin && !msgInfo.isOwner) {
        await this.reply(from, this.config.MESSAGES.ONLY_ADMIN);
        return;
      }
    }

    try {
      // Envoyer la réaction de traitement
      if (this.config.AUTO_REACT) {
        await this.react(from, msgInfo.msg.key, "⏳");
      }

      // Simuler l'écriture si activé
      if (this.config.AUTO_TYPING) {
        await this.socket.sendPresenceUpdate("composing", from);
      }

      // Exécuter la commande
      const startTime = Date.now();
      await cmd.execute(this.socket, msgInfo, this);
      const duration = Date.now() - startTime;

      // Envoyer la réaction de succès
      if (this.config.AUTO_REACT) {
        await this.react(from, msgInfo.msg.key, "✅");
      }

      // Logger la commande
      if (global.logger) {
        global.logger.logCommand(sender, command, msgInfo.args, {
          success: true,
          duration,
        });
      }
    } catch (error) {
      console.error(`Erreur lors de l'exécution de ${command}:`, error);

      // Envoyer la réaction d'erreur
      if (this.config.AUTO_REACT) {
        await this.react(from, msgInfo.msg.key, "❌");
      }

      await this.reply(
        from,
        `❌ Une erreur s'est produite lors de l'exécution de la commande.\n\n` +
          `📝 Erreur: ${error.message}`,
      );

      // Logger l'erreur
      if (global.logger) {
        global.logger.logCommand(sender, command, msgInfo.args, {
          success: false,
          error: error.message,
        });
      }
    } finally {
      // Arrêter la simulation d'écriture
      if (this.config.AUTO_TYPING) {
        await this.socket.sendPresenceUpdate("paused", from);
      }
    }
  }

  /**
   * Gérer les messages non-commande
   */
  async handleNonCommand(msgInfo) {
    const { from, text, isGroup } = msgInfo;

    // Vérifier les liens si l'anti-lien est activé
    if (isGroup && this.config.ENABLE_ANTI_LINK) {
      const linkRegex = /(https?:\/\/|www\.)[^\s]+/gi;
      if (linkRegex.test(text)) {
        // Supprimer le message
        await this.socket.sendMessage(from, {
          delete: msgInfo.msg.key,
        });

        await this.reply(
          from,
          "🚫 Les liens ne sont pas autorisés dans ce groupe!",
        );
        return;
      }
    }

    // Vérifier les mots toxiques si activé
    if (this.config.ENABLE_ANTI_TOXIC) {
      const toxicWords = this.config.BLOCKED_WORDS || [];
      const hasToxic = toxicWords.some((word) =>
        text.toLowerCase().includes(word.toLowerCase()),
      );

      if (hasToxic) {
        await this.socket.sendMessage(from, {
          delete: msgInfo.msg.key,
        });

        await this.reply(
          from,
          "🚫 Message supprimé: contenu inapproprié détecté!",
        );
        return;
      }
    }

    // Chat IA si activé
    if (
      this.config.EXPERIMENTAL_FEATURES?.AI_CHAT &&
      text.toLowerCase().startsWith("nice")
    ) {
      await this.handleAIChat(msgInfo);
    }
  }

  /**
   * Gérer les fonctionnalités automatiques
   */
  async handleAutoFeatures(msgInfo) {
    const { from, type } = msgInfo;

    // Auto-read
    if (this.config.AUTO_READ_MESSAGES && !msgInfo.isBot) {
      await this.socket.readMessages([msgInfo.msg.key]);
    }

    // Auto-download status
    if (from === "status@broadcast" && this.config.AUTO_DOWNLOAD_STATUS) {
      await this.downloadStatus(msgInfo);
    }

    // Auto-like status
    if (from === "status@broadcast" && this.config.AUTO_LIKE_STATUS) {
      const emoji = this.config.AUTO_LIKE_EMOJI || "❤️";
      await this.react(from, msgInfo.msg.key, emoji);
    }
  }

  /**
   * Gérer le chat IA
   */
  async handleAIChat(msgInfo) {
    // Implémentation du chat IA
    await this.reply(
      msgInfo.from,
      "🤖 Fonction IA en cours de développement...\n" +
        "Cette fonctionnalité sera bientôt disponible!",
    );
  }

  /**
   * Vérifier le spam
   */
  async checkSpam(sender) {
    const count = this.spamCount.get(sender) || 0;
    this.spamCount.set(sender, count + 1);

    // Réinitialiser après 1 minute
    setTimeout(() => {
      this.spamCount.delete(sender);
    }, 60000);

    return count > (this.config.SPAM_THRESHOLD || 5);
  }

  /**
   * Vérifier le cooldown
   */
  async checkCooldown(sender, command) {
    const key = `${sender}-${command}`;
    const now = Date.now();
    const cooldown = this.cooldowns.get(key);

    if (cooldown && now < cooldown) {
      return true;
    }

    const duration = this.config.RATE_LIMIT_TIME || 60000;
    this.cooldowns.set(key, now + duration);
    return false;
  }

  /**
   * Trouver des commandes similaires
   */
  findSimilarCommands(input) {
    const commands = Array.from(this.commands.keys());
    return commands
      .filter((cmd) => {
        // Recherche par début de commande
        if (cmd.startsWith(input)) return true;
        // Recherche par inclusion
        if (cmd.includes(input) || input.includes(cmd)) return true;
        // Distance de Levenshtein simple
        return this.levenshteinDistance(input, cmd) <= 2;
      })
      .slice(0, 3);
  }

  /**
   * Calculer la distance de Levenshtein
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Mettre à jour les statistiques
   */
  async updateStats(msgInfo) {
    if (global.db) {
      await global.db.incrementStats(msgInfo.sender, "messages");
      if (msgInfo.isCommand) {
        await global.db.incrementStats(msgInfo.sender, "commands");
      }
    }
  }

  /**
   * Télécharger un statut
   */
  async downloadStatus(msgInfo) {
    // Implémentation du téléchargement de statut
    try {
      const { type, msg } = msgInfo;
      if (type === "imageMessage" || type === "videoMessage") {
        const stream = await downloadContentFromMessage(
          msg.message[type],
          type.replace("Message", ""),
        );

        const buffer = [];
        for await (const chunk of stream) {
          buffer.push(chunk);
        }

        const finalBuffer = Buffer.concat(buffer);
        const extension = type === "imageMessage" ? "jpg" : "mp4";
        const filename = `status_${Date.now()}.${extension}`;
        const filepath = path.join(__dirname, "..", "downloads", filename);

        await fs.writeFile(filepath, finalBuffer);
        console.log(`📥 Statut téléchargé: ${filename}`);
      }
    } catch (error) {
      console.error("Erreur lors du téléchargement du statut:", error);
    }
  }

  /**
   * Méthodes utilitaires
   */

  async reply(to, text, options = {}) {
    return await this.socket.sendMessage(to, {
      text,
      ...options,
    });
  }

  async react(to, key, emoji) {
    return await this.socket.sendMessage(to, {
      react: {
        text: emoji,
        key,
      },
    });
  }

  async sendImage(to, image, caption = "", options = {}) {
    return await this.socket.sendMessage(to, {
      image,
      caption,
      ...options,
    });
  }

  async sendVideo(to, video, caption = "", options = {}) {
    return await this.socket.sendMessage(to, {
      video,
      caption,
      ...options,
    });
  }

  async sendAudio(to, audio, options = {}) {
    return await this.socket.sendMessage(to, {
      audio,
      ...options,
    });
  }

  async sendDocument(to, document, options = {}) {
    return await this.socket.sendMessage(to, {
      document,
      ...options,
    });
  }

  async sendSticker(to, sticker, options = {}) {
    return await this.socket.sendMessage(to, {
      sticker,
      ...options,
    });
  }

  async sendLocation(to, latitude, longitude, options = {}) {
    return await this.socket.sendMessage(to, {
      location: { latitude, longitude },
      ...options,
    });
  }

  async sendContact(to, vcard, options = {}) {
    return await this.socket.sendMessage(to, {
      contacts: {
        displayName: options.displayName || "Contact",
        contacts: [{ vcard }],
      },
    });
  }

  async sendButtons(to, text, buttons, options = {}) {
    return await this.socket.sendMessage(to, {
      text,
      buttons,
      ...options,
    });
  }

  async sendList(to, text, sections, options = {}) {
    return await this.socket.sendMessage(to, {
      text,
      sections,
      ...options,
    });
  }

  /**
   * Obtenir le menu d'une catégorie spécifique
   */
  getCategoryMenu(category) {
    const commands = [];

    // Grouper les commandes par catégorie
    for (const [name, cmd] of this.commands) {
      if (cmd.hidden) continue;
      if (
        cmd.category === category &&
        (!cmd.aliases || !cmd.aliases.includes(name))
      ) {
        commands.push({
          name,
          description: cmd.description || "Pas de description",
          usage: cmd.usage || `${this.config.PREFIX}${name}`,
          cooldown: cmd.cooldown || 0,
          ownerOnly: cmd.ownerOnly || false,
          adminOnly: cmd.adminOnly || false,
          groupOnly: cmd.groupOnly || false,
          privateOnly: cmd.privateOnly || false,
        });
      }
    }

    if (commands.length === 0) {
      return null;
    }

    // Emojis par catégorie
    const categoryEmojis = {
      general: "🌟",
      download: "📥",
      search: "🔍",
      tools: "🛠️",
      fun: "🎮",
      group: "👥",
      owner: "👑",
      admin: "⚙️",
      economy: "💰",
      ai: "🤖",
    };

    const emoji = categoryEmojis[category] || "📂";
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    let menu = `╭─「 ʜᴇɪɴᴢ-ᴍᴅ 」\n`;
    menu += `│    ${emoji} *MENU ${categoryName.toUpperCase()}*    │\n`;
    menu += `│     🤖 *${this.config.BOT_NAME}*     │\n`;
    menu += `╰────────────────𖠇\n\n`;

    menu += `╭──「 📚 *COMMANDES* 」\n`;
    menu += `│\n`;
    menu += `│ 📂 *Catégorie:* ${categoryName}\n`;
    menu += `│ 📊 *Total:* ${commands.length} commandes\n`;
    menu += `│ 📌 *Préfixe:* ${this.config.PREFIX}\n`;
    menu += `│\n`;
    menu += `╰───────────────𖠇\n\n`;

    // Ajouter chaque commande
    for (const cmd of commands) {
      const restrictions = [];
      if (cmd.ownerOnly) restrictions.push("👑 Propriétaire");
      if (cmd.adminOnly) restrictions.push("⚡ Admin");
      if (cmd.groupOnly) restrictions.push("👥 Groupe");
      if (cmd.privateOnly) restrictions.push("🔒 Privé");

      menu += `╭──「 ${this.config.PREFIX}${cmd.name} 」\n`;
      menu += `│ 📝 ${cmd.description}\n`;
      menu += `│ 💻 *Usage:* ${cmd.usage}\n`;
      if (cmd.cooldown > 0) {
        menu += `│ ⏱️ *Cooldown:* ${cmd.cooldown}s\n`;
      }
      if (restrictions.length > 0) {
        menu += `│ 🔐 *Restrictions:* ${restrictions.join(", ")}\n`;
      }
      menu += `╰────────────────𖠇\n\n`;
    }

    menu += `───────────────────\n`;
    menu += `💡 *Utilisez ${this.config.PREFIX}help <commande>*\n`;
    menu += `pour plus d'informations détaillées\n`;
    menu += `🔙 *${this.config.PREFIX}menu* pour le menu principal\n`;
    menu += `───────────────────\n`;
    menu += `${this.config.BOT_FOOTER}`;

    return menu;
  }

  /**
   * Obtenir le menu formaté
   */
  getMenu() {
    const categories = {};

    // Grouper les commandes par catégorie
    for (const [name, cmd] of this.commands) {
      if (cmd.hidden) continue;
      const category = cmd.category || "autres";
      if (!categories[category]) {
        categories[category] = [];
      }
      if (!cmd.aliases || !cmd.aliases.includes(name)) {
        categories[category].push({
          name,
          description: cmd.description || "Pas de description",
        });
      }
    }

    // Formater le menu
    let menu = `╭──「 *HEINZ-MD MENU* 」\n`;
    menu += `│ 🤖 *Bot:* ${this.config.BOT_NAME}\n`;
    menu += `│ 📌 *Préfixe:* ${this.config.PREFIX}\n`;
    menu += `│ 📚 *Commandes:* ${this.commands.size}\n`;
    menu += `│ ⏰ *Heure:* ${moment().tz("Africa/Douala").format("HH:mm:ss")}\n`;
    menu += `╰────────────────𖠇\n\n`;

    // Emojis par catégorie
    const categoryEmojis = {
      general: "🌟",
      download: "📥",
      search: "🔍",
      tools: "🛠️",
      fun: "🎮",
      group: "👥",
      owner: "👑",
      economy: "💰",
      ai: "🤖",
    };

    // Ajouter les catégories
    for (const [category, commands] of Object.entries(categories)) {
      const emoji = categoryEmojis[category] || "📂";
      menu += `╭─「 ${emoji} *${category.toUpperCase()}* 」\n`;

      for (const cmd of commands) {
        menu += `│ • ${this.config.PREFIX}${cmd.name}\n`;
        menu += `│   ${cmd.description}\n`;
      }

      menu += `╰────────────────𖠇\n\n`;
    }

    menu += `───────────────────\n`;
    menu += `💡 *Tapez ${this.config.PREFIX}help <commande>*\n`;
    menu += `pour plus d'informations sur une commande\n`;
    menu += `───────────────────\n`;
    menu += `${this.config.BOT_FOOTER}`;

    return menu;
  }
}

module.exports = MessageHandler;
