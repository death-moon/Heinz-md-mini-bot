const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  proto,
  getAggregateVotesInPollMessage,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const EventEmitter = require("events");
// QRCode supprimé - utilisation du pairing code
const moment = require("moment-timezone");
const config = require("../config");
const MessageHandler = require("./MessageHandler");
const Database = require("./Database");
const Logger = require("./Logger");
const PersistentPairingManager = require("./PersistentPairingManager");

class BotManager extends EventEmitter {
  constructor() {
    super();
    this.bots = new Map();
    this.sessions = new Map();
    this.pairingCodes = new Map();
    this.messageHandlers = new Map();
    this.reconnectAttempts = new Map();
    this.statusTimers = new Map();
    this.logger = global.logger || new Logger();
    this.db = global.db || new Database();
    this.store = makeInMemoryStore({
      logger: pino().child({ level: "silent", stream: "store" }),
    });
    
    // Gestionnaire de jumelage persistant
    this.pairingManager = new PersistentPairingManager();
    this.setupPairingManagerEvents();
  }

  /**
   * Initialiser le gestionnaire de bots
   */
  async initialize() {
    try {
      // Charger les sessions existantes
      await this.loadExistingSessions();

      // Configurer les événements globaux
      this.setupGlobalEvents();

      // Démarrer le moniteur de statut
      this.startStatusMonitor();

      this.logger.info("✅ BotManager initialisé avec succès");
      return { success: true };
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'initialisation du BotManager:",
        error,
      );
      throw error;
    }
  }

  /**
   * Créer une nouvelle instance de bot
   */
  async createBot(number, userSettings = {}) {
    const sanitizedNumber = this.sanitizeNumber(number);

    if (this.bots.has(sanitizedNumber)) {
      return {
        success: false,
        message: "Un bot est déjà actif pour ce numéro",
      };
    }

    try {
      // Créer le dossier de session
      const sessionPath = path.join(
        __dirname,
        "..",
        "sessions",
        sanitizedNumber,
      );
      await fs.ensureDir(sessionPath);

      // Charger ou créer l'état d'authentification
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Obtenir la dernière version de Baileys
      const { version } = await fetchLatestBaileysVersion();

      // Configuration du socket
      const socket = makeWASocket({
        version,
        logger: pino({ level: config.DEBUG ? "debug" : "silent" }),
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "silent" }),
          ),
        },
        browser: [config.BROWSER_NAME, config.PLATFORM, config.BROWSER_VERSION],
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: config.KEEP_ALIVE_INTERVAL,
        getMessage: async (key) => {
          if (this.store) {
            const msg = await this.store.loadMessage(key.remoteJid, key.id);
            return msg?.message || undefined;
          }
          return proto.Message.fromObject({});
        },
      });

      // Le code de pairing sera généré via createPairingSession si nécessaire

      // Sauvegarder dans la map
      this.bots.set(sanitizedNumber, {
        socket,
        state,
        saveCreds,
        sessionPath,
        settings: { ...config, ...userSettings },
        startTime: Date.now(),
        status: "connecting",
      });

      // Créer le gestionnaire de messages
      const messageHandler = new MessageHandler(socket, {
        ...config,
        ...userSettings,
      });
      this.messageHandlers.set(sanitizedNumber, messageHandler);

      // Configurer les événements du socket
      this.setupSocketEvents(socket, sanitizedNumber, saveCreds);

      // Bind store
      if (this.store) {
        this.store.bind(socket.ev);
      }

      this.logger.info(`🤖 Bot créé pour ${sanitizedNumber}`);
      return { success: true, number: sanitizedNumber };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création du bot pour ${sanitizedNumber}:`,
        error,
      );
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Configurer les événements du socket
   */
  setupSocketEvents(socket, number, saveCreds) {
    // Mise à jour de la connexion
    socket.ev.on("connection.update", async (update) => {
      await this.handleConnectionUpdate(socket, number, update);
    });

    // Mise à jour des credentials
    socket.ev.on("creds.update", saveCreds);

    // Messages reçus
    socket.ev.on("messages.upsert", async (m) => {
      await this.handleMessages(number, m);
    });

    // Messages mis à jour
    socket.ev.on("messages.update", async (updates) => {
      await this.handleMessageUpdates(number, updates);
    });

    // Réactions aux messages
    socket.ev.on("messages.reaction", async (reactions) => {
      await this.handleMessageReactions(number, reactions);
    });

    // Mises à jour des groupes
    socket.ev.on("groups.update", async (updates) => {
      await this.handleGroupUpdates(number, updates);
    });

    // Participants des groupes
    socket.ev.on("group-participants.update", async (update) => {
      await this.handleGroupParticipantsUpdate(number, update);
    });

    // Présence
    socket.ev.on("presence.update", async (presences) => {
      await this.handlePresenceUpdate(number, presences);
    });

    // Appels
    socket.ev.on("call", async (calls) => {
      await this.handleCalls(number, calls);
    });
  }

  /**
   * Gérer les mises à jour de connexion
   */
  async handleConnectionUpdate(socket, number, update) {
    const { connection, lastDisconnect, qr } = update;
    const bot = this.bots.get(number);

    if (!bot) return;

    // Mise à jour du statut
    bot.status = connection || "unknown";



    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !==
            DisconnectReason.loggedOut
          : true;

      if (shouldReconnect) {
        const attempts = this.reconnectAttempts.get(number) || 0;

        if (attempts < config.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts.set(number, attempts + 1);
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);

          this.logger.info(
            `🔄 Tentative de reconnexion ${attempts + 1}/${config.MAX_RECONNECT_ATTEMPTS} pour ${number} dans ${delay}ms`,
          );

          setTimeout(() => {
            this.createBot(number, bot.settings);
          }, delay);
        } else {
          this.logger.error(
            `❌ Échec de reconnexion après ${config.MAX_RECONNECT_ATTEMPTS} tentatives pour ${number}`,
          );
          await this.stopBot(number);
        }
      } else {
        this.logger.info(`🔌 Déconnexion définitive pour ${number}`);
        await this.stopBot(number);
      }
    } else if (connection === "open") {
      this.reconnectAttempts.delete(number);
      // Code de pairing utilisé avec succès
      bot.status = "connected";

      // Obtenir les informations du bot
      const botInfo = socket.user;
      bot.info = botInfo;

      this.logger.info(`✅ Bot connecté avec succès: ${botInfo?.id || number}`);
      this.emit("connected", { number, info: botInfo });

      // Activer les fonctionnalités automatiques
      await this.enableAutoFeatures(socket, number, bot.settings);

      // Auto-join au groupe de support
      if (bot.settings.AUTO_JOIN_GROUP && bot.settings.SUPPORT_GROUP) {
        try {
          await this.autoJoinSupportGroup(socket, bot.settings);
          this.logger.info(`📱 Auto-join groupe support réussi pour ${number}`);
        } catch (error) {
          this.logger.warn(
            `⚠️ Auto-join groupe support échoué pour ${number}: ${error.message}`,
          );
        }
      }

      // Message de démarrage
      if (bot.settings.OWNER_NUMBER) {
        await this.sendStartupMessage(socket, bot.settings.OWNER_NUMBER);
      }
    }

    this.emit("connection-update", { number, status: connection, update });
  }

  /**
   * Gérer les messages entrants
   */
  async handleMessages(number, { messages, type }) {
    const bot = this.bots.get(number);
    if (!bot || !messages.length) return;

    const messageHandler = this.messageHandlers.get(number);
    if (!messageHandler) return;

    for (const msg of messages) {
      try {
        // Ignorer les messages de statut
        if (msg.key.remoteJid === "status@broadcast") {
          if (bot.settings.AUTO_VIEW_STATUS) {
            await bot.socket.readMessages([msg.key]);
          }
          continue;
        }

        // Traiter le message
        await messageHandler.handleMessage(msg);

        // Auto-read
        if (bot.settings.AUTO_READ_MESSAGES && !msg.key.fromMe) {
          await bot.socket.readMessages([msg.key]);
        }

        // Enregistrer dans la base de données
        await this.db.saveMessage(number, msg);
      } catch (error) {
        this.logger.error(
          `Erreur lors du traitement du message pour ${number}:`,
          error,
        );
      }
    }
  }

  /**
   * Gérer les mises à jour de messages
   */
  async handleMessageUpdates(number, updates) {
    for (const update of updates) {
      this.emit("message-update", { number, update });
    }
  }

  /**
   * Gérer les réactions aux messages
   */
  async handleMessageReactions(number, reactions) {
    for (const reaction of reactions) {
      this.emit("message-reaction", { number, reaction });
    }
  }

  /**
   * Gérer les mises à jour de groupes
   */
  async handleGroupUpdates(number, updates) {
    const bot = this.bots.get(number);
    if (!bot) return;

    for (const update of updates) {
      this.emit("group-update", { number, update });

      // Sauvegarder les informations du groupe
      await this.db.saveGroup(number, update);
    }
  }

  /**
   * Gérer les mises à jour des participants de groupe
   */
  async handleGroupParticipantsUpdate(number, update) {
    const bot = this.bots.get(number);
    if (!bot) return;

    const { id, participants, action } = update;

    // Message de bienvenue/au revoir
    if (bot.settings.WELCOME_ENABLED || bot.settings.GOODBYE_ENABLED) {
      const group = await bot.socket.groupMetadata(id);

      for (const participant of participants) {
        if (action === "add" && bot.settings.WELCOME_ENABLED) {
          const message = bot.settings.WELCOME_MESSAGE.replace(
            "{user}",
            `@${participant.split("@")[0]}`,
          ).replace("{group}", group.subject);

          await bot.socket.sendMessage(id, {
            text: message,
            mentions: [participant],
          });
        } else if (action === "remove" && bot.settings.GOODBYE_ENABLED) {
          const message = bot.settings.GOODBYE_MESSAGE.replace(
            "{user}",
            `@${participant.split("@")[0]}`,
          ).replace("{group}", group.subject);

          await bot.socket.sendMessage(id, {
            text: message,
            mentions: [participant],
          });
        }
      }
    }

    this.emit("group-participants-update", { number, update });
  }

  /**
   * Gérer les mises à jour de présence
   */
  async handlePresenceUpdate(number, presences) {
    this.emit("presence-update", { number, presences });
  }

  /**
   * Gérer les appels
   */
  async handleCalls(number, calls) {
    const bot = this.bots.get(number);
    if (!bot) return;

    for (const call of calls) {
      // Rejeter automatiquement les appels si configuré
      if (bot.settings.AUTO_REJECT_CALLS) {
        await bot.socket.rejectCall(call.id, call.from);

        await bot.socket.sendMessage(call.from, {
          text: "🚫 Les appels sont automatiquement rejetés. Veuillez envoyer un message texte.",
        });
      }

      this.emit("call", { number, call });
    }
  }

  /**
   * Activer les fonctionnalités automatiques
   */
  async enableAutoFeatures(socket, number, settings) {
    // Auto-présence
    if (settings.AUTO_PRESENCE) {
      this.startPresenceUpdates(socket, number, settings);
    }

    // Auto-typing
    if (settings.AUTO_TYPING) {
      // Sera géré dans le MessageHandler
    }

    // Auto-recording
    if (settings.AUTO_RECORDING) {
      // Sera géré dans le MessageHandler
    }
  }

  /**
   * Démarrer les mises à jour de présence
   */
  startPresenceUpdates(socket, number, settings) {
    const interval = setInterval(async () => {
      try {
        await socket.sendPresenceUpdate(settings.PRESENCE_UPDATE);
      } catch (error) {
        this.logger.error(
          `Erreur lors de la mise à jour de présence pour ${number}:`,
          error,
        );
      }
    }, 30000); // Toutes les 30 secondes

    this.statusTimers.set(number, interval);
  }

  /**
   * Envoyer un message de démarrage
   */
  async sendStartupMessage(socket, ownerNumber) {
    try {
      const message =
        `🚀 *Heinz-md Bot v${config.BOT_VERSION}*\n\n` +
        `✅ Bot démarré avec succès!\n` +
        `📅 Date: ${moment().tz("Africa/Douala").format("DD/MM/YYYY HH:mm:ss")}\n\n` +
        `💡 Tapez *.menu* pour voir les commandes disponibles`;

      await socket.sendMessage(ownerNumber + "@s.whatsapp.net", {
        text: message,
      });
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'envoi du message de démarrage:",
        error,
      );
    }
  }

  /**
   * Générer un code de pairing
   */
  async pairDevice(number, settings = {}) {
    const sanitizedNumber = this.sanitizeNumber(number);

    try {
      // Vérifier si un bot existe déjà
      if (this.bots.has(sanitizedNumber)) {
        const bot = this.bots.get(sanitizedNumber);
        if (bot.status === "connected") {
          return {
            success: true,
            number: sanitizedNumber,
            connected: true,
            info: bot.info,
          };
        }
      }

      // Créer le bot avec les paramètres
      const result = await this.createBot(sanitizedNumber, settings);

      if (!result.success) {
        throw new Error(result.message);
      }

      // Attendre le code de pairing avec un timeout plus court
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout: Aucun code de pairing généré"));
        }, 30000); // 30 secondes au lieu de 60

        const codeListener = ({ number: n, code }) => {
          if (n === sanitizedNumber) {
            clearTimeout(timeout);
            this.removeListener("pairing-code", codeListener);
            this.removeListener("connected", connectedListener);
            resolve({
              success: true,
              number: sanitizedNumber,
              code: code,
            });
          }
        };

        const connectedListener = ({ number: n, info }) => {
          if (n === sanitizedNumber) {
            clearTimeout(timeout);
            this.removeListener("pairing-code", codeListener);
            this.removeListener("connected", connectedListener);
            this.removeListener("pairing-error", errorListener);
            resolve({
              success: true,
              number: sanitizedNumber,
              connected: true,
              info,
            });
          }
        };

        const errorListener = ({ number: n, error }) => {
          if (n === sanitizedNumber) {
            clearTimeout(timeout);
            this.removeListener("pairing-code", codeListener);
            this.removeListener("connected", connectedListener);
            this.removeListener("pairing-error", errorListener);
            reject(new Error(error));
          }
        };

        this.on("pairing-code", codeListener);
        this.on("connected", connectedListener);
        this.on("pairing-error", errorListener);
      });
    } catch (error) {
      this.logger.error(
        `Erreur lors du pairing pour ${sanitizedNumber}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Arrêter un bot
   */
  async stopBot(number) {
    const sanitizedNumber = this.sanitizeNumber(number);
    const bot = this.bots.get(sanitizedNumber);

    if (!bot) {
      return {
        success: false,
        message: "Aucun bot actif pour ce numéro",
      };
    }

    try {
      // Arrêter les timers
      const timer = this.statusTimers.get(sanitizedNumber);
      if (timer) {
        clearInterval(timer);
        this.statusTimers.delete(sanitizedNumber);
      }

      // Déconnecter le socket
      if (bot.socket) {
        bot.socket.end();
      }

      // Nettoyer les maps
      this.bots.delete(sanitizedNumber);
      this.messageHandlers.delete(sanitizedNumber);
      // Nettoyer les données temporaires
      this.reconnectAttempts.delete(sanitizedNumber);

      this.logger.info(`🛑 Bot arrêté pour ${sanitizedNumber}`);
      this.emit("bot-stopped", { number: sanitizedNumber });

      return {
        success: true,
        message: "Bot arrêté avec succès",
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'arrêt du bot pour ${sanitizedNumber}:`,
        error,
      );
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Redémarrer un bot
   */
  async restartBot(number) {
    const sanitizedNumber = this.sanitizeNumber(number);
    const bot = this.bots.get(sanitizedNumber);

    if (!bot) {
      return {
        success: false,
        message: "Aucun bot actif pour ce numéro",
      };
    }

    const settings = bot.settings;

    // Arrêter le bot
    await this.stopBot(sanitizedNumber);

    // Attendre un peu
    await delay(2000);

    // Redémarrer le bot
    return await this.createBot(sanitizedNumber, settings);
  }

  /**
   * Obtenir le statut d'un bot
   */
  getStatus(number) {
    const sanitizedNumber = this.sanitizeNumber(number);
    const bot = this.bots.get(sanitizedNumber);

    if (!bot) {
      return {
        active: false,
        status: "offline",
      };
    }

    return {
      active: true,
      status: bot.status,
      info: bot.info,
      uptime: Date.now() - bot.startTime,
      settings: bot.settings,
    };
  }

  /**
   * Obtenir le statut de tous les bots
   */
  getAllStatus() {
    const statuses = {};

    for (const [number, bot] of this.bots) {
      statuses[number] = {
        status: bot.status,
        info: bot.info,
        uptime: Date.now() - bot.startTime,
      };
    }

    return statuses;
  }

  /**
   * Obtenir les statistiques
   */
  async getStats() {
    const stats = {
      totalBots: this.bots.size,
      activeBots: 0,
      totalMessages: 0,
      totalGroups: 0,
      uptime: process.uptime(),
    };

    for (const [number, bot] of this.bots) {
      if (bot.status === "connected") {
        stats.activeBots++;
      }

      // Obtenir les stats de la base de données
      const dbStats = await this.db.getStats(number);
      stats.totalMessages += dbStats.messages || 0;
      stats.totalGroups += dbStats.groups || 0;
    }

    return stats;
  }

  /**
   * Arrêter tous les bots
   */
  async stopAll() {
    const promises = [];

    // Arrêter tous les bots connectés
    for (const number of this.bots.keys()) {
      promises.push(this.stopBot(number));
    }

    // Nettoyer toutes les sessions de jumelage
    await this.pairingManager.cleanupAllSessions();

    await Promise.all(promises);
    this.logger.info("🛑 Tous les bots ont été arrêtés");
  }

  /**
   * Sauvegarder toutes les sessions
   */
  async backupAllSessions() {
    const backupPath = path.join(
      __dirname,
      "..",
      "backups",
      moment().format("YYYY-MM-DD_HH-mm-ss"),
    );
    await fs.ensureDir(backupPath);

    for (const [number, bot] of this.bots) {
      try {
        const sessionPath = bot.sessionPath;
        const destPath = path.join(backupPath, number);
        await fs.copy(sessionPath, destPath);
        this.logger.info(`💾 Session sauvegardée pour ${number}`);
      } catch (error) {
        this.logger.error(
          `Erreur lors de la sauvegarde de la session pour ${number}:`,
          error,
        );
      }
    }

    return { success: true, path: backupPath };
  }

  /**
   * Restaurer toutes les sessions
   */
  async restoreAllSessions() {
    const sessionsPath = path.join(__dirname, "..", "sessions");

    if (!(await fs.pathExists(sessionsPath))) {
      return { success: false, message: "Aucune session trouvée" };
    }

    const sessions = await fs.readdir(sessionsPath);

    for (const session of sessions) {
      const sessionPath = path.join(sessionsPath, session);
      const stats = await fs.stat(sessionPath);

      if (stats.isDirectory()) {
        try {
          await this.createBot(session);
          this.logger.info(`📱 Session restaurée pour ${session}`);
        } catch (error) {
          this.logger.error(
            `Erreur lors de la restauration de la session pour ${session}:`,
            error,
          );
        }
      }
    }

    return { success: true, restored: sessions.length };
  }

  /**
   * Charger les sessions existantes
   */
  async loadExistingSessions() {
    if (!config.AUTO_RESTORE_SESSIONS) return;

    const sessionsPath = path.join(__dirname, "..", "sessions");

    if (!(await fs.pathExists(sessionsPath))) {
      await fs.ensureDir(sessionsPath);
      return;
    }

    const sessions = await fs.readdir(sessionsPath);
    this.logger.info(`📂 ${sessions.length} session(s) trouvée(s)`);
  }

  /**
   * Configurer les événements globaux
   */
  setupGlobalEvents() {
    this.on("error", (error) => {
      this.logger.error("Erreur globale:", error);
    });
  }

  /**
   * Démarrer le moniteur de statut
   */
  startStatusMonitor() {
    setInterval(async () => {
      for (const [number, bot] of this.bots) {
        if (bot.status === "connected" && bot.socket) {
          try {
            // Vérifier si le socket est toujours connecté
            const state = bot.socket.ws?.readyState;
            if (state !== 1) {
              bot.status = "disconnected";
              this.emit("status-change", { number, status: "disconnected" });
            }
          } catch (error) {
            this.logger.error(
              `Erreur lors de la vérification du statut pour ${number}:`,
              error,
            );
          }
        }
      }
    }, 30000); // Vérifier toutes les 30 secondes
  }

  /**
   * Nettoyer et formater un numéro de téléphone
   */
  sanitizeNumber(number) {
    return number.replace(/[^0-9]/g, "");
  }

  /**
   * Configurer les événements du gestionnaire de jumelage
   */
  setupPairingManagerEvents() {
    this.pairingManager.on('pairing-success', async ({ number, info, sessionData }) => {
      this.logger.info(`🎉 Jumelage réussi pour ${number}`);
      
      // Transférer la session vers le gestionnaire principal
      this.bots.set(number, {
        socket: sessionData.socket,
        state: sessionData.state,
        saveCreds: sessionData.saveCreds,
        sessionPath: sessionData.sessionPath,
        settings: sessionData.settings,
        startTime: sessionData.startTime,
        status: 'connected',
        info: info
      });

      // Créer le gestionnaire de messages
      const messageHandler = new MessageHandler(sessionData.socket, sessionData.settings);
      this.messageHandlers.set(number, messageHandler);

      this.emit('bot-connected', { number, info });
    });

    this.pairingManager.on('pairing-failed', ({ number, reason }) => {
      this.logger.error(`❌ Échec jumelage pour ${number}: ${reason}`);
      this.emit('pairing-failed', { number, reason });
    });

    this.pairingManager.on('pairing-timeout', ({ number }) => {
      this.logger.warn(`⏰ Timeout jumelage pour ${number}`);
      this.emit('pairing-timeout', { number });
    });

    this.pairingManager.on('connection-update', ({ number, connection, sessionData }) => {
      this.emit('connection-update', { number, connection, sessionData });
    });
  }

  /**
   * Créer une session de pairing persistante (nouvelle méthode)
   */
  async createPairingSession(number, settings = {}, res) {
    const sanitizedNumber = this.sanitizeNumber(number);

    try {
      // Utiliser le gestionnaire de jumelage persistant
      const result = await this.pairingManager.createPersistentPairingSession(sanitizedNumber, settings);
      
      if (res && !res.headersSent) {
        res.json(result);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Erreur session pairing ${sanitizedNumber}:`, error);
      
      if (res && !res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Créer une session de pairing simplifiée et fonctionnelle (ancienne méthode - gardée pour compatibilité)
   */
  async createPairingSessionLegacy(number, settings = {}, res) {
    const sanitizedNumber = this.sanitizeNumber(number);

    try {
      // Créer le dossier de session
      const sessionPath = path.join(__dirname, "..", "sessions", `session_${sanitizedNumber}`);
      await fs.ensureDir(sessionPath);

      // Charger ou créer l'état d'authentification
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Configuration du socket avec paramètres optimisés pour le pairing
      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: config.DEBUG ? "debug" : "silent" }),
        browser: Browsers.macOS('Safari'),
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000, // Augmenter l'intervalle keep-alive
        defaultQueryTimeoutMs: 60000, // Timeout plus long
        connectTimeoutMs: 60000, // Timeout de connexion plus long
        generateHighQualityLinkPreview: true,
        syncFullHistory: false, // Désactiver pour accélérer
        getMessage: async (key) => {
          return proto.Message.fromObject({});
        },
      });

      // Sauvegarder le socket
      this.bots.set(sanitizedNumber, {
        socket,
        state,
        saveCreds,
        sessionPath,
        settings: { ...config, ...settings },
        startTime: Date.now(),
        status: "connecting",
      });

      // Générer le code de pairing immédiatement
      if (!socket.authState.creds.registered) {
        let retries = 3;
        let code;
        
        while (retries > 0) {
          try {
            await delay(1500);
            code = await socket.requestPairingCode(sanitizedNumber);
            this.logger.info(`🔑 Code de pairing généré pour ${sanitizedNumber}: ${code}`);
            break;
          } catch (error) {
            retries--;
            this.logger.warn(`Échec génération code (${retries} restantes):`, error.message);
            if (retries > 0) await delay(2000);
          }
        }
        
        if (code && !res.headersSent) {
          res.json({ success: true, data: { code } });
        } else if (!res.headersSent) {
          throw new Error("Impossible de générer le code de pairing");
        }
      } else if (!res.headersSent) {
        res.json({ success: true, data: { connected: true } });
      }

      // Gérer les événements essentiels
      socket.ev.on('creds.update', saveCreds);

      // Maintenir la connexion active avec un keep-alive
      const keepAliveInterval = setInterval(async () => {
        try {
          if (socket.ws && socket.ws.readyState === 1) {
            await socket.sendPresenceUpdate('available');
          }
        } catch (error) {
          // Ignorer les erreurs de keep-alive
        }
      }, 30000);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        this.logger.info(`📡 Connexion update pour ${sanitizedNumber}: ${connection}`);
        
        if (connection === 'open') {
          // Arrêter les tentatives de reconnexion
          this.reconnectAttempts.delete(sanitizedNumber);
          
          const bot = this.bots.get(sanitizedNumber);
          if (bot) {
            bot.status = 'connected';
            bot.info = socket.user;
          }

          this.logger.info(`✅ Bot connecté avec succès: ${socket.user?.id || sanitizedNumber}`);
          
          // Créer le gestionnaire de messages après connexion
          const messageHandler = new MessageHandler(socket, { ...config, ...settings });
          this.messageHandlers.set(sanitizedNumber, messageHandler);

          // Message de bienvenue
          try {
            await delay(2000); // Attendre un peu avant d'envoyer
            const userJid = jidNormalizedUser(socket.user.id);
            await socket.sendMessage(userJid, {
              text: `🤖 *Heinz-md Bot v${config.BOT_VERSION}*\n\n✅ Connexion réussie!\n📱 Numéro: ${sanitizedNumber}\n📅 ${new Date().toLocaleString()}\n\n💡 Tapez *.menu* pour voir les commandes disponibles`
            });
          } catch (error) {
            this.logger.warn("Erreur envoi message bienvenue:", error.message);
          }

        } else if (connection === 'close') {
          clearInterval(keepAliveInterval);
          
          const shouldReconnect = lastDisconnect?.error instanceof Boom
            ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
            : true;

          if (shouldReconnect) {
            const attempts = this.reconnectAttempts.get(sanitizedNumber) || 0;
            if (attempts < 5) { // Augmenter le nombre de tentatives
              this.reconnectAttempts.set(sanitizedNumber, attempts + 1);
              this.logger.info(`🔄 Reconnexion ${attempts + 1}/5 pour ${sanitizedNumber}`);
              
              // Délai progressif : 5s, 10s, 15s, 20s, 25s
              const delayMs = 5000 + (attempts * 5000);
              setTimeout(() => {
                this.createPairingSession(sanitizedNumber, settings, { headersSent: true, json: () => {} });
              }, delayMs);
            } else {
              this.logger.error(`❌ Échec reconnexion après 5 tentatives pour ${sanitizedNumber}`);
              this.stopBot(sanitizedNumber);
            }
          } else {
            this.logger.info(`🔌 Déconnexion définitive pour ${sanitizedNumber}`);
            this.stopBot(sanitizedNumber);
          }
        } else if (connection === 'connecting') {
          this.logger.info(`🔄 Connexion en cours pour ${sanitizedNumber}...`);
        }
      });

    } catch (error) {
      this.logger.error(`Erreur session ${sanitizedNumber}:`, error);
      throw error;
    }
  }

  /**
   * Générer un code de pairing
   */
  async generatePairingCode(number) {
    const sanitizedNumber = this.sanitizeNumber(number);
    
    // Vérifier d'abord dans le gestionnaire de jumelage persistant
    if (this.pairingManager.hasActiveSession(sanitizedNumber)) {
      return await this.pairingManager.generatePairingCode(sanitizedNumber);
    }
    
    // Sinon vérifier dans les bots connectés
    const bot = this.bots.get(sanitizedNumber);
    if (!bot) {
      throw new Error("Aucun bot actif pour ce numéro");
    }

    try {
      const code = await bot.socket.requestPairingCode(sanitizedNumber);
      return { success: true, code };
    } catch (error) {
      throw new Error("Impossible de générer le code de pairing");
    }
  }

  /**
   * Obtenir le statut d'une session (incluant les sessions de jumelage)
   */
  getSessionStatus(number) {
    const sanitizedNumber = this.sanitizeNumber(number);
    
    // Vérifier d'abord dans le gestionnaire de jumelage
    if (this.pairingManager.hasActiveSession(sanitizedNumber)) {
      return this.pairingManager.getSessionStatus(sanitizedNumber);
    }
    
    // Sinon utiliser la méthode normale
    return this.getStatus(sanitizedNumber);
  }

  /**
   * Obtenir toutes les sessions actives (incluant les sessions de jumelage)
   */
  getAllSessionsStatus() {
    const botSessions = this.getAllStatus();
    const pairingSessions = this.pairingManager.getAllSessions();
    
    return {
      connected: botSessions,
      pairing: pairingSessions,
      total: Object.keys(botSessions).length + Object.keys(pairingSessions).length
    };
  }

  /**
   * Rejoindre automatiquement le groupe de support
   */
  async autoJoinSupportGroup(socket, settings) {
    try {
      const supportGroupLink = settings.SUPPORT_GROUP;
      if (
        !supportGroupLink ||
        !supportGroupLink.includes("chat.whatsapp.com")
      ) {
        throw new Error("Lien de groupe support invalide");
      }

      // Extraire le code d'invitation du lien
      const inviteCodeMatch = supportGroupLink.match(
        /chat\.whatsapp\.com\/([A-Za-z0-9]+)/,
      );
      if (!inviteCodeMatch) {
        throw new Error("Code d'invitation introuvable dans le lien");
      }

      const inviteCode = inviteCodeMatch[1];

      // Vérifier si on est déjà dans le groupe
      try {
        const groups = await socket.groupFetchAllParticipating();
        const isAlreadyMember = Object.values(groups).some(
          (group) =>
            group.subject && group.subject.toLowerCase().includes("support"),
        );

        if (isAlreadyMember) {
          this.logger.info(
            "🔍 Déjà membre d'un groupe support, auto-join ignoré",
          );
          return null;
        }
      } catch (error) {
        // Continuer même si on ne peut pas vérifier
        this.logger.debug("Impossible de vérifier les groupes existants");
      }

      // Accepter l'invitation au groupe
      const groupInfo = await socket.groupAcceptInvite(inviteCode);

      // Envoyer un message de bienvenue dans le groupe après un délai
      setTimeout(async () => {
        try {
          const welcomeMessage =
            `🤖 *Heinz-md Bot connecté !*\n\n` +
            `👋 Salut tout le monde !\n` +
            `🚀 Un nouveau bot Heinz-md vient de se connecter\n\n` +
            `📱 *Fonctionnalités disponibles:*\n` +
            `• 📥 Téléchargements (YouTube, TikTok...)\n` +
            `• 🔍 Recherche (Google, Images...)\n` +
            `• 🛠️ Outils utiles (Météo, QR Code...)\n` +
            `• 🎮 Commandes fun (Blagues, Jeux...)\n` +
            `• 🤖 IA intégrée (Chat intelligent)\n` +
            `• 👥 Gestion de groupes\n` +
            `• 💰 Système économique\n\n` +
            `💡 *Tapez .menu pour découvrir toutes les commandes !*\n\n` +
            `📺 *Chaîne:* ${settings.CHANNEL_LINK}\n` +
            `📱 *GitHub:* ${settings.GITHUB_REPO}\n\n` +
            `${settings.BOT_FOOTER}`;

          await socket.sendMessage(groupInfo, {
            text: welcomeMessage,
            contextInfo: {
              externalAdReply: {
                title: "🤖 Heinz-md Bot - Nouveau membre",
                body: "Bot WhatsApp avancé par Heinz boy",
                mediaType: 1,
                sourceUrl: settings.GITHUB_REPO,
                thumbnailUrl: "https://files.catbox.moe/y0ra0d.jpg",
                renderLargerThumbnail: true,
              },
            },
          });

          // Logger l'auto-join
          if (global.logger) {
            await global.logger.info("Auto-joined support group successfully", {
              groupId: groupInfo,
              inviteCode: inviteCode.substring(0, 10) + "...",
            });
          }
        } catch (error) {
          this.logger.warn("Erreur envoi message bienvenue groupe:", error);
        }
      }, 5000); // Délai de 5 secondes

      return groupInfo;
    } catch (error) {
      // Ne pas logger comme erreur si c'est juste qu'on est déjà membre
      if (error.message?.includes("already")) {
        this.logger.info("📱 Déjà membre du groupe support");
        return null;
      }

      if (global.logger) {
        await global.logger.error("Auto-join support group failed", {
          error: error.message,
          supportGroup: settings.SUPPORT_GROUP?.substring(0, 50) + "...",
        });
      }
      throw error;
    }
  }
}

module.exports = BotManager;
