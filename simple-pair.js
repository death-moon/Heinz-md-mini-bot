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
const config = require("./config");

/**
 * Système de jumelage simplifié pour NICE-MD
 * Maintient la connexion active pendant que l'utilisateur entre le code
 */

const activeSessions = new Map();
const keepAliveIntervals = new Map();
const reconnectAttempts = new Map();

// Configuration
const PAIRING_TIMEOUT = 300000; // 5 minutes
const KEEP_ALIVE_INTERVAL = 15000; // 15 secondes
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Créer une session de jumelage persistante
 */
async function createPairingSession(number, settings = {}) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  
  // Nettoyer toute session existante
  await cleanupSession(sanitizedNumber);

  try {
    console.log(`🔄 Création session pour ${sanitizedNumber}`);
    
    // Créer le dossier de session
    const sessionPath = path.join(__dirname, "sessions", `session_${sanitizedNumber}`);
    await fs.ensureDir(sessionPath);

    // Charger ou créer l'état d'authentification
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    // Configuration optimisée pour le jumelage
    const socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS('Safari'),
      markOnlineOnConnect: true,
      keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
      defaultQueryTimeoutMs: 0,
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

    activeSessions.set(sanitizedNumber, sessionData);

    // Configurer les événements
    setupSocketEvents(socket, sanitizedNumber);

    // Démarrer le keep-alive
    startKeepAlive(sanitizedNumber);

    // Générer le code de jumelage
    const result = await generatePairingCode(sanitizedNumber);
    
    return result;

  } catch (error) {
    console.error(`❌ Erreur session ${sanitizedNumber}:`, error);
    await cleanupSession(sanitizedNumber);
    throw error;
  }
}

/**
 * Générer le code de jumelage
 */
async function generatePairingCode(number) {
  const sessionData = activeSessions.get(number);
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
      console.log(`🔑 Génération code pour ${number} (${6-retries}/5)`);
      
      if (retries < 5) await delay(2000);
      
      code = await socket.requestPairingCode(number);
      
      if (code) {
        console.log(`✅ Code généré: ${code}`);
        
        sessionData.status = "waiting_for_pairing";
        sessionData.pairingCode = code;

        return {
          success: true,
          code: code,
          message: `Code généré: ${code}`,
          expiresIn: PAIRING_TIMEOUT
        };
      }
    } catch (error) {
      retries--;
      console.warn(`⚠️ Échec génération: ${error.message} (${retries} restantes)`);
      
      if (retries === 0) {
        throw new Error(`Impossible de générer le code: ${error.message}`);
      }
    }
  }

  throw new Error("Échec génération du code");
}

/**
 * Configurer les événements du socket
 */
function setupSocketEvents(socket, number) {
  // Mise à jour des credentials
  socket.ev.on('creds.update', async () => {
    const sessionData = activeSessions.get(number);
    if (sessionData) {
      try {
        await sessionData.saveCreds();
        console.log(`💾 Credentials sauvegardés pour ${number}`);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde ${number}:`, error);
      }
    }
  });

  // Mise à jour de la connexion
  socket.ev.on('connection.update', async (update) => {
    await handleConnectionUpdate(number, update);
  });
}

/**
 * Gérer les mises à jour de connexion
 */
async function handleConnectionUpdate(number, update) {
  const { connection, lastDisconnect } = update;
  const sessionData = activeSessions.get(number);

  if (!sessionData) return;

  console.log(`📡 Update ${number}: ${connection}`);
  sessionData.status = connection || "unknown";

  if (connection === 'open') {
    console.log(`🎉 Connexion réussie pour ${number}!`);
    
    reconnectAttempts.delete(number);
    sessionData.status = 'connected';
    sessionData.info = socket.user;
    sessionData.connectedAt = Date.now();

    // Message de bienvenue
    try {
      await delay(2000);
      const userJid = jidNormalizedUser(socket.user.id);
      await socket.sendMessage(userJid, {
        text: `🤖 *Heinz-md Bot v${config.BOT_VERSION}*\n\n` +
              `✅ Jumelage réussi!\n` +
              `📱 Numéro: ${number}\n` +
              `🕐 ${new Date().toLocaleString()}\n\n` +
              `💡 Tapez *.menu* pour voir les commandes\n\n` +
              `> Développé par Heinz boy`
      });
    } catch (error) {
      console.warn(`⚠️ Erreur message bienvenue:`, error.message);
    }

  } else if (connection === 'close') {
    console.log(`🔌 Connexion fermée pour ${number}`);
    
    const shouldReconnect = lastDisconnect?.error instanceof Boom
      ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
      : true;

    if (shouldReconnect && sessionData.status !== 'connected') {
      await handleReconnection(number);
    } else {
      console.log(`✅ Session ${number} terminée`);
      await cleanupSession(number);
    }

  } else if (connection === 'connecting') {
    console.log(`🔄 Connexion en cours pour ${number}...`);
    sessionData.status = 'connecting';
  }
}

/**
 * Gérer la reconnexion
 */
async function handleReconnection(number) {
  const attempts = reconnectAttempts.get(number) || 0;
  
  if (attempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Échec après ${MAX_RECONNECT_ATTEMPTS} tentatives pour ${number}`);
    await cleanupSession(number);
    return;
  }

  reconnectAttempts.set(number, attempts + 1);
  
  const delayMs = Math.min(5000 * (attempts + 1), 30000);
  console.log(`🔄 Reconnexion ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS} pour ${number} dans ${delayMs}ms`);

  setTimeout(async () => {
    try {
      const sessionData = activeSessions.get(number);
      if (sessionData) {
        await recreateSocket(number);
      }
    } catch (error) {
      console.error(`❌ Erreur reconnexion ${number}:`, error);
      await handleReconnection(number);
    }
  }, delayMs);
}

/**
 * Recréer le socket
 */
async function recreateSocket(number) {
  const sessionData = activeSessions.get(number);
  if (!sessionData) return;

  try {
    // Fermer l'ancien socket
    if (sessionData.socket) {
      try {
        sessionData.socket.end();
      } catch (error) {
        // Ignorer
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
      keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
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
    setupSocketEvents(socket, number);

    console.log(`🔄 Socket recréé pour ${number}`);

  } catch (error) {
    console.error(`❌ Erreur recréation socket ${number}:`, error);
    throw error;
  }
}

/**
 * Démarrer le keep-alive
 */
function startKeepAlive(number) {
  stopKeepAlive(number);

  const interval = setInterval(async () => {
    const sessionData = activeSessions.get(number);
    if (!sessionData) {
      clearInterval(interval);
      return;
    }

    try {
      const { socket } = sessionData;
      
      if (socket.ws && socket.ws.readyState === 1) {
        await socket.sendPresenceUpdate('available');
        
        // Log périodique
        if (Date.now() % 60000 < KEEP_ALIVE_INTERVAL) {
          console.log(`💓 Keep-alive ${number} - Status: ${sessionData.status}`);
        }
      } else {
        console.warn(`⚠️ WebSocket fermé pour ${number}`);
      }
    } catch (error) {
      // Ignorer les erreurs de keep-alive
    }
  }, KEEP_ALIVE_INTERVAL);

  keepAliveIntervals.set(number, interval);
  console.log(`💓 Keep-alive démarré pour ${number}`);
}

/**
 * Arrêter le keep-alive
 */
function stopKeepAlive(number) {
  const interval = keepAliveIntervals.get(number);
  if (interval) {
    clearInterval(interval);
    keepAliveIntervals.delete(number);
    console.log(`💓 Keep-alive arrêté pour ${number}`);
  }
}

/**
 * Obtenir le statut d'une session
 */
function getSessionStatus(number) {
  const sessionData = activeSessions.get(number);
  if (!sessionData) {
    return { active: false, status: 'not_found' };
  }

  return {
    active: true,
    status: sessionData.status,
    pairingCode: sessionData.pairingCode,
    startTime: sessionData.startTime,
    connectedAt: sessionData.connectedAt,
    uptime: sessionData.connectedAt ? Date.now() - sessionData.connectedAt : null,
    info: sessionData.info,
    reconnectAttempts: reconnectAttempts.get(number) || 0
  };
}

/**
 * Nettoyer une session
 */
async function cleanupSession(number) {
  console.log(`🧹 Nettoyage session ${number}`);

  stopKeepAlive(number);

  const sessionData = activeSessions.get(number);
  if (sessionData && sessionData.socket) {
    try {
      sessionData.socket.end();
    } catch (error) {
      // Ignorer
    }
  }

  activeSessions.delete(number);
  reconnectAttempts.delete(number);

  console.log(`✅ Session ${number} nettoyée`);
}

/**
 * Nettoyer toutes les sessions
 */
async function cleanupAllSessions() {
  const numbers = Array.from(activeSessions.keys());
  for (const number of numbers) {
    await cleanupSession(number);
  }
  console.log("🧹 Toutes les sessions nettoyées");
}

/**
 * Vérifier si une session est active
 */
function hasActiveSession(number) {
  return activeSessions.has(number.replace(/[^0-9]/g, ''));
}

/**
 * Obtenir une session
 */
function getSession(number) {
  return activeSessions.get(number.replace(/[^0-9]/g, ''));
}

// Nettoyage automatique au démarrage
process.on('SIGINT', async () => {
  console.log('⏹️ Arrêt du processus...');
  await cleanupAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('⏹️ Arrêt du processus...');
  await cleanupAllSessions();
  process.exit(0);
});

// Export des fonctions
module.exports = {
  createPairingSession,
  generatePairingCode,
  getSessionStatus,
  cleanupSession,
  cleanupAllSessions,
  hasActiveSession,
  getSession,
  activeSessions
};

// Si exécuté directement, démarrer un serveur simple
if (require.main === module) {
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(express.json());

  // Route pour créer une session de jumelage
  app.post('/pair', async (req, res) => {
    try {
      const { number, settings } = req.body;
      
      if (!number) {
        return res.status(400).json({ error: 'Numéro requis' });
      }

      const result = await createPairingSession(number, settings);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Route pour obtenir le statut
  app.get('/status/:number', (req, res) => {
    try {
      const { number } = req.params;
      const status = getSessionStatus(number);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Route pour nettoyer une session
  app.delete('/session/:number', async (req, res) => {
    try {
      const { number } = req.params;
      await cleanupSession(number);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 Serveur de jumelage simple démarré sur le port ${PORT}`);
  });
}
