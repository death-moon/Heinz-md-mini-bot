const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const config = require('./config');
const BotManager = require('./lib/BotManager');
const Database = require('./lib/Database');
const Logger = require('./lib/Logger');
// const { initializeRoutes } = require('./routes');

// Initialisation des variables globales
global.__basedir = __dirname;
global.config = config;
global.logger = new Logger();
global.db = new Database();
global.botManager = new BotManager();

// Configuration d'Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  points: 100, // Nombre de requêtes
  duration: 60, // Par 60 secondes
});

// Middleware de rate limiting
const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      success: false,
      message: 'Trop de requêtes. Veuillez réessayer plus tard.'
    });
  }
};

// Configuration des middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.socket.io"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(compression());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
if (config.DEBUG) {
  app.use(morgan('dev'));
}

// Servir les fichiers statiques
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Créer les dossiers nécessaires
const requiredDirs = [
  'sessions',
  'temp',
  'downloads',
  'logs',
  'backups',
  'public',
  'assets',
  'assets/images',
  'assets/audio',
  'assets/video',
  'assets/stickers'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`📁 Dossier créé: ${dir}`);
  }
});

// WebSocket connection handler
io.on('connection', (socket) => {
  logger.info(`🔌 Nouvelle connexion WebSocket: ${socket.id}`);

  socket.on('init', async (data) => {
    socket.emit('connected', {
      message: 'Connexion établie avec Heinz-md',
      version: config.BOT_VERSION
    });
  });

  socket.on('get-pairing-code', async (data) => {
    try {
      const { number, settings } = data;
      const result = await botManager.createPairingSession(number, settings || {});
      socket.emit('pairing-code', result);
      
      // Écouter les événements de cette session
      const sessionListener = (eventData) => {
        if (eventData.number === botManager.sanitizeNumber(number)) {
          socket.emit('pairing-update', eventData);
        }
      };
      
      botManager.on('connection-update', sessionListener);
      botManager.on('pairing-success', sessionListener);
      botManager.on('pairing-failed', sessionListener);
      botManager.on('pairing-timeout', sessionListener);
      
      // Nettoyer les listeners quand le socket se déconnecte
      socket.on('disconnect', () => {
        botManager.removeListener('connection-update', sessionListener);
        botManager.removeListener('pairing-success', sessionListener);
        botManager.removeListener('pairing-failed', sessionListener);
        botManager.removeListener('pairing-timeout', sessionListener);
      });
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('get-session-status', async (number) => {
    try {
      const status = await botManager.getSessionStatus(number);
      socket.emit('session-status', status);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('get-status', async (number) => {
    try {
      const status = await botManager.getStatus(number);
      socket.emit('status', status);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('start-bot', async (data) => {
    try {
      const result = await botManager.startBot(data);
      socket.emit('bot-started', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('stop-bot', async (number) => {
    try {
      const result = await botManager.stopBot(number);
      socket.emit('bot-stopped', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`🔌 Déconnexion WebSocket: ${socket.id}`);
  });
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route pour le dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Route pour la configuration
app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'settings.html'));
});

// Route de pairing
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'pair.html'));
});

// Route de pairing persistant
app.get('/persistent-pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'persistent-pair.html'));
});

// API Routes
app.use('/api', rateLimiterMiddleware);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    name: config.BOT_NAME,
    version: config.BOT_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Test endpoint pour le pairing (GET comme MINI-INCONNU)
app.get('/code', async (req, res) => {
  try {
    const { number, settings } = req.query;
    
    if (!number) {
      return res.status(400).json({ error: 'Number is required' });
    }

    console.log(`Test pairing pour le numéro: ${number}`);
    
    // Utiliser la méthode directe
    await botManager.createPairingSession(number, {}, res);

  } catch (error) {
    console.error('Erreur de pairing:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// API pour obtenir le code de pairing (style MINI-INCONNU)
app.post('/api/pair', async (req, res) => {
  try {
    const { number, settings } = req.body;

    if (!number) {
      return res.status(400).json({
        success: false,
        message: 'Le numéro est requis'
      });
    }

    // Utiliser la méthode directe comme MINI-INCONNU
    await botManager.createPairingSession(number, settings, res);

  } catch (error) {
    logger.error('Erreur de pairing:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
});

// API pour obtenir le statut des bots actifs
app.get('/api/status', async (req, res) => {
  try {
    const status = await botManager.getAllStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API pour obtenir les statistiques
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await botManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API pour obtenir la configuration
app.get('/api/config', (req, res) => {
  const publicConfig = {
    BOT_NAME: config.BOT_NAME,
    BOT_VERSION: config.BOT_VERSION,
    BOT_DEVELOPER: config.BOT_DEVELOPER,
    PREFIX: config.PREFIX,
    THEME: config.THEME,
    EMOJI: config.EMOJI,
    MENU_CATEGORIES: config.MENU_CATEGORIES,
    GITHUB_REPO: config.GITHUB_REPO,
    SUPPORT_GROUP: config.SUPPORT_GROUP
  };

  res.json({
    success: true,
    data: publicConfig
  });
});

// API pour mettre à jour la configuration
app.post('/api/config', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({
        success: false,
        message: 'Les paramètres sont requis'
      });
    }

    // Mise à jour de la configuration
    Object.keys(settings).forEach(key => {
      if (config.hasOwnProperty(key) && !['GITHUB_TOKEN', 'OPENAI_API_KEY'].includes(key)) {
        config[key] = settings[key];
      }
    });

    // Sauvegarder la configuration
    await db.saveConfig(config);

    res.json({
      success: true,
      message: 'Configuration mise à jour avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API pour télécharger un fichier
app.post('/api/upload', async (req, res) => {
  try {
    // Gérer l'upload de fichier
    res.json({
      success: true,
      message: 'Fichier uploadé avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API pour redémarrer un bot
app.post('/api/restart/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const result = await botManager.restartBot(number);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API pour arrêter un bot
app.post('/api/stop/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const result = await botManager.stopBot(number);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API pour obtenir les logs
app.get('/api/logs', async (req, res) => {
  try {
    const { limit = 100, level = 'all' } = req.query;
    const logs = await logger.getLogs(limit, level);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Gestion globale des erreurs
app.use((error, req, res, next) => {
  logger.error('Erreur serveur:', error);
  res.status(500).json({
    success: false,
    message: config.DEBUG ? error.message : 'Erreur interne du serveur'
  });
});

// Fonction de démarrage du serveur
async function startServer() {
  try {
    // Initialiser la base de données
    await db.initialize();
    logger.info('✅ Base de données initialisée');

    // Initialiser le gestionnaire de bots
    await botManager.initialize();
    logger.info('✅ Gestionnaire de bots initialisé');

    // Démarrer le serveur
    server.listen(PORT, () => {
      console.log(`
╭─「 *ʜᴇɪɴᴢ ᴍᴅ* 」
│◉ *ᴠᴇʀsɪᴏɴ →1.0.0*
│◉ *ᴅᴇᴠ →ʜᴇɪɴᴢ ʙᴏʏ*
│◉ *ʙᴏᴛ ɴᴀᴍᴇ →ʜᴇɪɴᴢ ᴍᴅ*
╰───────────────𖠇
> *ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇ́ ᴘᴀʀ ʜᴇɪɴᴢ ʙᴏʏ*
      `);

      logger.info(`🚀 Serveur Heinz-md démarré sur le port ${PORT}`);
    });

    // Auto-restauration des sessions
    if (config.AUTO_RESTORE_SESSIONS) {
      await botManager.restoreAllSessions();
    }

    // Configuration du backup automatique
    if (config.AUTO_BACKUP) {
      setInterval(async () => {
        await botManager.backupAllSessions();
        logger.info('💾 Sauvegarde automatique effectuée');
      }, config.BACKUP_INTERVAL);
    }

    // Gestion des signaux système
    process.on('SIGINT', async () => {
      logger.info('⏹️ Arrêt du serveur...');
      await botManager.stopAll();
      await db.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('⏹️ Arrêt du serveur...');
      await botManager.stopAll();
      await db.close();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Erreur non capturée:', error);
      if (config.DEBUG) {
        console.error(error);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promesse rejetée non gérée:', reason);
      if (config.DEBUG) {
        console.error('Promesse rejetée:', promise);
      }
    });

  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Export des modules
module.exports = {
  app,
  server,
  io,
  startServer
};

// Démarrer le serveur si exécuté directement
if (require.main === module) {
  startServer();
}
