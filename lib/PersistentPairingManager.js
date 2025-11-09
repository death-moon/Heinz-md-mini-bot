const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const EventEmitter = require("events");
const config = require("../config");

/**
 * Gestionnaire de jumelage persistant qui maintient la connexion active
 * pendant que l'utilisateur entre le code dans WhatsApp
 */
class PersistentPairingManager extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.pairingCodes = new Map();
    this.keepAliveIntervals = new Map();
    this.connectionTimeouts = new Map();
    this.reconnectAttempts = new Map();
    
    // Configuration pour maintenir les connexions
    this.PAIRING_TIMEOUT = 300000; // 5 minutes pour entrer le code
    this.KEEP_ALIVE_INTERVAL = 15000; // 15 secondes
    this.RECONNECT_DELAY = 5000; // 5 secondes
    this.MAX_RECONNECT_ATTEMPTS = 10; // Plus de tentatives
  }

  /**
   * Créer une session de jumelage persistante
   */
  async createPersistentPairingSession(number, settings = {}) {
    const sanitizedNumber = this.sanitizeNumber(number);
    
    // Nettoyer toute session existante
    await this.cleanupSession(sanitizedNumber);

    try {
      console.log(`🔄 Création session persistante pour ${sanitizedNumber}`);
      
      // Créer le dossier de session
      const sessionPath = path.join(__dirname, "..", "sessions", `session_${sanitizedNumber}`);
      await fs.ensureDir(sessionPath);

      // Charger ou créer l'état d'authentification
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Configuration optimisée pour le jumelage persistant
      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS('Safari'),
        markOnlineOnConnect: true,
        keepAliveIntervalMs: this.KEEP_ALIVE_INTERVAL,
        defaultQueryTimeoutMs: 0, // Pas de timeout par défaut
        connectTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        emitOwnEvents: false,
        getMessage: async () => ({ message: {} }),
      });

      // Sauvegarder la session
      const sessionData = {
        socket,
        state,
        saveCreds,
        sessionPath,
        settings: { ...config, ...settings },
        startTime: Date.now(),
        status: "initializing",
        number: sanitizedNumber
      };

      this.activeSessions.set(sanitizedNumber, sessionData);

      // Configurer les événements
      this.setupSocketEvents(socket, sanitizedNumber);

      // Démarrer le keep-alive immédiatement
      this.startKeepAlive(sanitizedNumber);

      // Configurer le timeout de jumelage
      this.setupPairingTimeout(sanitizedNumber);

      // Générer le code de jumelage
      const result = await this.generatePairingCode(sanitizedNumber);
      
      return result;

    } catch (error) {
      console.error(`❌ Erreur création session ${sanitizedNumber}:`, error);
      await this.cleanupSession(sanitizedNumber);
      throw error;
    }
  }

  /**
   * Générer le code de jumelage avec retry automatique
   */
  async generatePairingCode(number) {
    const sessionData = this.activeSessions.get(number);
    if (!sessionData) {
      throw new Error("Session non trouvée");
    }

    const { socket } = sessionData;

    // Vérifier si déjà connecté
    if (socket.authState.creds.registered) {
      return {
        success: true,
        connected: true,
        message: "Appareil déjà connecté"
      };
    }

    let retries = 5;
    let code = null;

    while (retries > 0 && !code) {
      try {
        console.log(`🔑 Tentative génération code pour ${number} (${6-retries}/5)`);
        
        // Attendre un peu avant chaque tentative
        if (retries < 5) await delay(2000);
        
        code = await socket.requestPairingCode(number);
        
        if (code) {
          console.log(`✅ Code généré pour ${number}: ${code}`);
          
          // Sauvegarder le code
          this.pairingCodes.set(number, {
            code,
            timestamp: Date.now(),
            attempts: 6 - retries
          });

          // Mettre à jour le statut
          sessionData.status = "waiting_for_pairing";
          sessionData.pairingCode = code;

          return {
            success: true,
            code: code,
            message: `Code généré avec succès. Entrez ${code} dans WhatsApp.`,
            expiresIn: this.PAIRING_TIMEOUT
          };
        }
      } catch (error) {
        retries--;
        console.warn(`⚠️ Échec génération code ${number}: ${error.message} (${retries} restantes)`);
        
        if (retries === 0) {
          throw new Error(`Impossible de générer le code après 5 tentatives: ${error.message}`);
        }
      }
    }

    throw new Error("Échec génération du code de jumelage");
  }

  /**
   * Configurer les événements du socket avec gestion persistante
   */
  setupSocketEvents(socket, number) {
    // Mise à jour des credentials
    socket.ev.on('creds.update', async () => {
      const sessionData = this.activeSessions.get(number);
      if (sessionData) {
        try {
          await sessionData.saveCreds();
          console.log(`💾 Credentials sauvegardés pour ${number}`);
        } catch (error) {
          console.error(`❌ Erreur sauvegarde credentials ${number}:`, error);
        }
      }
    });

    // Mise à jour de la connexion
    socket.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(number, update);
    });

    // Messages (pour détecter la connexion réussie)
    socket.ev.on('messages.upsert', async ({ messages }) => {
      const sessionData = this.activeSessions.get(number);
      if (sessionData && sessionData.status === 'connected') {
        // La connexion est établie, on peut traiter les messages
        console.log(`📨 Messages reçus pour ${number}: ${messages.length}`);
      }
    });
  }

  /**
   * Gérer les mises à jour de connexion avec persistance
   */
  async handleConnectionUpdate(number, update) {
    const { connection, lastDisconnect, qr } = update;
    const sessionData = this.activeSessions.get(number);

    if (!sessionData) return;

    console.log(`📡 Update connexion ${number}: ${connection}`);

    // Mettre à jour le statut
    sessionData.status = connection || "unknown";

    if (connection === 'open') {
      // Connexion réussie !
      console.log(`🎉 Connexion réussie pour ${number}!`);
      
      // Nettoyer les tentatives de reconnexion
      this.reconnectAttempts.delete(number);
      
      // Mettre à jour les informations
      sessionData.status = 'connected';
      sessionData.info = socket.user;
      sessionData.connectedAt = Date.now();

      // Arrêter le timeout de jumelage
      this.clearPairingTimeout(number);

      // Envoyer un message de confirmation
      try {
        await delay(2000);
        const userJid = jidNormalizedUser(socket.user.id);
        await socket.sendMessage(userJid, {
          text: `🤖 *Heinz-md Bot v${config.BOT_VERSION}*\n\n` +
                `✅ Jumelage réussi!\n` +
                `📱 Numéro: ${number}\n` +
                `🕐 ${new Date().toLocaleString()}\n\n` +
                `💡 Tapez *.menu* pour voir les commandes disponibles\n\n` +
                `> Développé par heinz boy`
        });
      } catch (error) {
        console.warn(`⚠️ Erreur envoi message bienvenue ${number}:`, error.message);
      }

      // Émettre l'événement de succès
      this.emit('pairing-success', {
        number,
        info: socket.user,
        sessionData
      });

    } else if (connection === 'close') {
      console.log(`🔌 Connexion fermée pour ${number}`);
      
      const shouldReconnect = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true;

      if (shouldReconnect && sessionData.status !== 'connected') {
        // Seulement reconnecter si pas encore connecté
        await this.handleReconnection(number);
      } else if (sessionData.status === 'connected') {
        // Si c'était connecté, c'est une déconnexion normale
        console.log(`✅ Session ${number} terminée normalement`);
        await this.cleanupSession(number);
      } else {
        console.log(`❌ Déconnexion définitive pour ${number}`);
        await this.cleanupSession(number);
        this.emit('pairing-failed', {
          number,
          reason: 'Déconnexion définitive'
        });
      }

    } else if (connection === 'connecting') {
      console.log(`🔄 Connexion en cours pour ${number}...`);
      sessionData.status = 'connecting';
    }

    // Émettre l'événement de mise à jour
    this.emit('connection-update', {
      number,
      connection,
      sessionData
    });
  }

  /**
   * Gérer la reconnexion automatique
   */
  async handleReconnection(number) {
    const attempts = this.reconnectAttempts.get(number) || 0;
    
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Échec reconnexion après ${this.MAX_RECONNECT_ATTEMPTS} tentatives pour ${number}`);
      await this.cleanupSession(number);
      this.emit('pairing-failed', {
        number,
        reason: `Échec après ${this.MAX_RECONNECT_ATTEMPTS} tentatives`
      });
      return;
    }

    this.reconnectAttempts.set(number, attempts + 1);
    
    // Délai progressif mais pas trop long
    const delay = Math.min(this.RECONNECT_DELAY * (attempts + 1), 30000);
    
    console.log(`🔄 Reconnexion ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS} pour ${number} dans ${delay}ms`);

    setTimeout(async () => {
      try {
        const sessionData = this.activeSessions.get(number);
        if (sessionData) {
          // Recréer le socket avec les mêmes paramètres
          await this.recreateSocket(number);
        }
      } catch (error) {
        console.error(`❌ Erreur reconnexion ${number}:`, error);
        await this.handleReconnection(number); // Retry
      }
    }, delay);
  }

  /**
   * Recréer le socket pour une session existante
   */
  async recreateSocket(number) {
    const sessionData = this.activeSessions.get(number);
    if (!sessionData) return;

    try {
      // Fermer l'ancien socket
      if (sessionData.socket) {
        try {
          sessionData.socket.end();
        } catch (error) {
          // Ignorer les erreurs de fermeture
        }
      }

      // Créer un nouveau socket
      const { state, saveCreds } = await useMultiFileAuthState(sessionData.sessionPath);
      
      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS('Safari'),
        markOnlineOnConnect: true,
        keepAliveIntervalMs: this.KEEP_ALIVE_INTERVAL,
        defaultQueryTimeoutMs: 0,
        connectTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        emitOwnEvents: false,
        getMessage: async () => ({ message: {} }),
      });

      // Mettre à jour la session
      sessionData.socket = socket;
      sessionData.state = state;
      sessionData.saveCreds = saveCreds;
      sessionData.status = 'reconnecting';

      // Reconfigurer les événements
      this.setupSocketEvents(socket, number);

      console.log(`🔄 Socket recréé pour ${number}`);

    } catch (error) {
      console.error(`❌ Erreur recréation socket ${number}:`, error);
      throw error;
    }
  }

  /**
   * Démarrer le keep-alive pour maintenir la connexion
   */
  startKeepAlive(number) {
    // Nettoyer tout interval existant
    this.stopKeepAlive(number);

    const interval = setInterval(async () => {
      const sessionData = this.activeSessions.get(number);
      if (!sessionData) {
        clearInterval(interval);
        return;
      }

      try {
        const { socket } = sessionData;
        
        // Vérifier l'état de la connexion WebSocket
        if (socket.ws && socket.ws.readyState === 1) {
          // Envoyer une présence pour maintenir la connexion
          await socket.sendPresenceUpdate('available');
          
          // Log périodique pour le debug
          if (Date.now() % 60000 < this.KEEP_ALIVE_INTERVAL) {
            console.log(`💓 Keep-alive ${number} - Status: ${sessionData.status}`);
          }
        } else {
          console.warn(`⚠️ WebSocket fermé pour ${number}, statut: ${socket.ws?.readyState}`);
        }
      } catch (error) {
        // Ignorer les erreurs de keep-alive, elles sont normales
        if (error.message.includes('Connection Closed') || error.message.includes('not open')) {
          console.log(`🔌 Connexion fermée détectée pour ${number}`);
        }
      }
    }, this.KEEP_ALIVE_INTERVAL);

    this.keepAliveIntervals.set(number, interval);
    console.log(`💓 Keep-alive démarré pour ${number}`);
  }

  /**
   * Arrêter le keep-alive
   */
  stopKeepAlive(number) {
    const interval = this.keepAliveIntervals.get(number);
    if (interval) {
      clearInterval(interval);
      this.keepAliveIntervals.delete(number);
      console.log(`💓 Keep-alive arrêté pour ${number}`);
    }
  }

  /**
   * Configurer le timeout de jumelage
   */
  setupPairingTimeout(number) {
    this.clearPairingTimeout(number);

    const timeout = setTimeout(async () => {
      const sessionData = this.activeSessions.get(number);
      if (sessionData && sessionData.status !== 'connected') {
        console.log(`⏰ Timeout jumelage pour ${number}`);
        await this.cleanupSession(number);
        this.emit('pairing-timeout', { number });
      }
    }, this.PAIRING_TIMEOUT);

    this.connectionTimeouts.set(number, timeout);
  }

  /**
   * Nettoyer le timeout de jumelage
   */
  clearPairingTimeout(number) {
    const timeout = this.connectionTimeouts.get(number);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(number);
    }
  }

  /**
   * Obtenir le statut d'une session
   */
  getSessionStatus(number) {
    const sessionData = this.activeSessions.get(number);
    if (!sessionData) {
      return { active: false, status: 'not_found' };
    }

    const pairingData = this.pairingCodes.get(number);
    
    return {
      active: true,
      status: sessionData.status,
      pairingCode: sessionData.pairingCode,
      startTime: sessionData.startTime,
      connectedAt: sessionData.connectedAt,
      uptime: sessionData.connectedAt ? Date.now() - sessionData.connectedAt : null,
      info: sessionData.info,
      reconnectAttempts: this.reconnectAttempts.get(number) || 0,
      pairingData
    };
  }

  /**
   * Obtenir toutes les sessions actives
   */
  getAllSessions() {
    const sessions = {};
    for (const [number, sessionData] of this.activeSessions) {
      sessions[number] = this.getSessionStatus(number);
    }
    return sessions;
  }

  /**
   * Nettoyer une session
   */
  async cleanupSession(number) {
    console.log(`🧹 Nettoyage session ${number}`);

    // Arrêter le keep-alive
    this.stopKeepAlive(number);

    // Nettoyer les timeouts
    this.clearPairingTimeout(number);

    // Fermer le socket
    const sessionData = this.activeSessions.get(number);
    if (sessionData && sessionData.socket) {
      try {
        sessionData.socket.end();
      } catch (error) {
        // Ignorer les erreurs de fermeture
      }
    }

    // Nettoyer les maps
    this.activeSessions.delete(number);
    this.pairingCodes.delete(number);
    this.reconnectAttempts.delete(number);

    console.log(`✅ Session ${number} nettoyée`);
  }

  /**
   * Nettoyer toutes les sessions
   */
  async cleanupAllSessions() {
    const numbers = Array.from(this.activeSessions.keys());
    for (const number of numbers) {
      await this.cleanupSession(number);
    }
    console.log("🧹 Toutes les sessions nettoyées");
  }

  /**
   * Nettoyer et formater un numéro
   */
  sanitizeNumber(number) {
    return number.replace(/[^0-9]/g, "");
  }

  /**
   * Vérifier si une session est active
   */
  hasActiveSession(number) {
    return this.activeSessions.has(this.sanitizeNumber(number));
  }

  /**
   * Obtenir une session
   */
  getSession(number) {
    return this.activeSessions.get(this.sanitizeNumber(number));
  }
}

module.exports = PersistentPairingManager;