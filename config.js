const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // Informations du Bot
  BOT_NAME: process.env.BOT_NAME || 'ʜᴇɪɴᴢ-ᴍᴅ',
  BOT_VERSION: '1.0.0',
  BOT_DEVELOPER: 'ʜᴇɪɴᴢ ʙᴏʏ',
  BOT_FOOTER: '*© 2025 ʜᴇɪɴᴇ-ᴍᴅ ʙᴏᴛ - ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇ́ ᴘᴀʀ ʜᴇɪɴᴢ ʙᴏʏ*',

  // Configuration du propriétaire
  OWNER_NUMBER: process.env.OWNER_NUMBER || '529711221986',
  OWNER_NAME: process.env.OWNER_NAME || 'ʜᴇɪɴᴢ ʙᴏʏ',

  // Paramètres de base
  PREFIX: process.env.PREFIX || '.',
  SESSION_ID: process.env.SESSION_ID || '',

  // URLs et liens
  GITHUB_REPO: 'https://github.com/death-moon/Heinz-md-mini-bot',
  SUPPORT_GROUP: process.env.SUPPORT_GROUP || 'https://chat.whatsapp.com/DOhxrd2BKt18tENNW13je1',
  CHANNEL_LINK: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029VbBpzSEFi8xhGCrsAv2h',

  // Paramètres de connexion
  MAX_RETRIES: 3,
  RECONNECT_DELAY: 5000,
  MAX_RECONNECT_ATTEMPTS: 3,
  KEEP_ALIVE_INTERVAL: 15000,
  CONNECTION_TIMEOUT: 30000,

  // Fonctionnalités automatiques
  AUTO_READ_MESSAGES: process.env.AUTO_READ === 'true' || false,
  AUTO_TYPING: process.env.AUTO_TYPING === 'true' || false,
  AUTO_RECORDING: process.env.AUTO_RECORDING === 'true' || false,
  AUTO_PRESENCE: process.env.AUTO_PRESENCE === 'true' || true,
  AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS === 'true' || false,
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS === 'true' || false,
  AUTO_LIKE_EMOJI: process.env.AUTO_LIKE_EMOJI || '🦄',
  AUTO_JOIN_GROUP: process.env.AUTO_JOIN_GROUP === 'true' || false,
  AUTO_REACT: process.env.AUTO_REACT === 'true' || true,
  AUTO_DOWNLOAD_STATUS: process.env.AUTO_DOWNLOAD_STATUS === 'true' || false,
  AUTO_BLOCK_SPAM: process.env.AUTO_BLOCK_SPAM === 'true' || true,

  // Paramètres de présence
  PRESENCE_UPDATE: process.env.PRESENCE_UPDATE || 'available', // available, composing, recording, paused
  PRESENCE_MESSAGE: process.env.PRESENCE_MESSAGE || 'ʜᴇɪɴᴢ-ᴍᴅ ʙᴏᴛ ᴇsᴛ ᴇɴ ʟɪɢɴᴇ 🤖',

  // Paramètres de bienvenue
  WELCOME_ENABLED: process.env.WELCOME_ENABLED === 'true' || true,
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || 'Bienvenue {user} dans {group}! 🎉',
  GOODBYE_ENABLED: process.env.GOODBYE_ENABLED === 'true' || true,
  GOODBYE_MESSAGE: process.env.GOODBYE_MESSAGE || 'Au revoir {user}! 👋',

  // Limites et restrictions
  MAX_UPLOAD_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_DOWNLOAD_SIZE: 300 * 1024 * 1024, // 300MB
  RATE_LIMIT_TIME: 60000, // 1 minute
  RATE_LIMIT_COUNT: 10, // 10 commandes par minute
  SPAM_THRESHOLD: 5, // Messages avant détection de spam

  // API Keys (à configurer dans .env)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
  NEWS_API_KEY: process.env.NEWS_API_KEY || '',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  REMOVE_BG_KEY: process.env.REMOVE_BG_KEY || '',

  // Base de données
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_TYPE: process.env.DB_TYPE || 'json', // json, mongodb, postgresql

  // Paramètres de stockage
  USE_CLOUD_STORAGE: process.env.USE_CLOUD_STORAGE === 'true' || false,
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local', // local, aws, cloudinary

  // Paramètres de sécurité
  ENABLE_ANTI_SPAM: true,
  ENABLE_ANTI_LINK: false,
  ENABLE_ANTI_TOXIC: false,
  BLOCKED_WORDS: [],
  ALLOWED_GROUPS: [],
  BLOCKED_USERS: [],

  // Paramètres de langue
  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'fr',
  AVAILABLE_LANGUAGES: ['fr', 'en', 'es', 'ar', 'pt'],

  // Paramètres de thème
  THEME: {
    PRIMARY_COLOR: '#FF6B6B',
    SECONDARY_COLOR: '#4ECDC4',
    ACCENT_COLOR: '#45B7D1',
    DARK_COLOR: '#2C3E50',
    LIGHT_COLOR: '#ECF0F1',
    SUCCESS_COLOR: '#27AE60',
    ERROR_COLOR: '#E74C3C',
    WARNING_COLOR: '#F39C12',
    INFO_COLOR: '#3498DB'
  },

  // Emojis du bot
  EMOJI: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOADING: '⏳',
    DONE: '✨',
    ROBOT: '🤖',
    USER: '👤',
    GROUP: '👥',
    ADMIN: '👑',
    OWNER: '💎',
    PREMIUM: '⭐',
    MENU: '📚',
    HELP: '❓',
    SETTINGS: '⚙️',
    DOWNLOAD: '📥',
    UPLOAD: '📤',
    MUSIC: '🎵',
    VIDEO: '🎥',
    IMAGE: '🖼️',
    DOCUMENT: '📄',
    LOCATION: '📍',
    CONTACT: '👤',
    STICKER: '🏷️',
    GAME: '🎮',
    MONEY: '💰',
    HEART: '❤️',
    STAR: '⭐',
    FIRE: '🔥',
    ROCKET: '🚀'
  },

  // Messages système
  MESSAGES: {
    ONLY_OWNER: '*⛔ ᴄᴇᴛᴛᴇ ᴄᴏᴍᴍᴀɴᴅᴇ ᴇsᴛ ʀᴇ́sᴇʀᴠᴇ́ᴇ ᴀᴜ ᴘʀᴏᴘʀɪᴇ́ᴛᴀɪʀᴇ ᴅᴜ ʙᴏᴛ!*',
    ONLY_ADMIN: '*⛔ ᴄᴇᴛᴛᴇ ᴄᴏᴍᴍᴀɴᴅᴇ ᴇsᴛ ʀᴇ́sᴇʀᴠᴇ́ᴇ ᴀᴜx ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴇᴜʀs!*',
    ONLY_GROUP: '*⛔ ᴄᴇᴛᴛᴇ ᴄᴏᴍᴍᴀɴᴅᴇ ɴᴇ ᴘᴇᴜᴛ ᴇ̂ᴛʀᴇ ᴜᴛɪʟɪsᴇ́ᴇ ǫᴜᴇ ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ!*',
    ONLY_PRIVATE: '*⛔ ᴄᴇᴛᴛᴇ ᴄᴏᴍᴍᴀɴᴅᴇ ɴᴇ ᴘᴇᴜᴛ ᴇ̂ᴛʀᴇ ᴜᴛɪʟɪsᴇ́ᴇ ǫᴜ\'ᴇɴ ᴘʀɪᴠᴇ́!*',
    WAIT: '*⏳ ᴛʀᴀɪᴛᴇᴍᴇɴᴛ ᴇɴ ᴄᴏᴜʀs, ᴠᴇᴜɪʟʟᴇᴢ ᴘᴀᴛɪᴇɴᴛᴇʀ...*',
    SUCCESS: '*✅ ᴏᴘᴇ́ʀᴀᴛɪᴏɴ ʀᴇ́ᴜssɪᴇ!*',
    ERROR: '*❌ ᴜɴᴇ ᴇʀʀᴇᴜʀ s\'ᴇsᴛ ᴘʀᴏᴅᴜɪᴛᴇ!*',
    INVALID_FORMAT: '*⚠️ ғᴏʀᴍᴀᴛ ɪɴᴠᴀʟɪᴅᴇ! ᴜᴛɪʟɪsᴇᴢ:* ',
    NO_PERMISSION: '*🚫 ᴠᴏᴜs ɴ\'ᴀᴠᴇᴢ ᴘᴀs ʟᴀ ᴘᴇʀᴍɪssɪᴏɴ ᴅ\'ᴜᴛɪʟɪsᴇʀ ᴄᴇᴛᴛᴇ ᴄᴏᴍᴍᴀɴᴅᴇ!*',
    RATE_LIMIT: '*⏱️ ᴛʀᴏᴘ ᴅᴇ ʀᴇǫᴜᴇ̂ᴛᴇs! ᴠᴇᴜɪʟʟᴇᴢ ᴀᴛᴛᴇɴᴅʀᴇ ᴀᴠᴀɴᴛ ᴅᴇ ʀᴇ́ᴇssᴀʏᴇʀ.*',
    MAINTENANCE: '*🔧 ʟᴇ ʙᴏᴛ ᴇsᴛ ᴇɴ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ. ᴠᴇᴜɪʟʟᴇᴢ ʀᴇ́ᴇssᴀʏᴇʀ ᴘʟᴜs ᴛᴀʀᴅ.*',
    NOT_FOUND: '*❌ ᴀᴜᴄᴜɴ ʀᴇ́sᴜʟᴛᴀᴛ ᴛʀᴏᴜᴠᴇ́!*',
    DOWNLOADING: '*📥 ᴛᴇ́ʟᴇ́ᴄʜᴀʀɢᴇᴍᴇɴᴛ ᴇɴ ᴄᴏᴜʀs...*',
    UPLOADING: '*📤 ᴇɴᴠᴏɪ ᴇɴ ᴄᴏᴜʀs...*',
    PROCESSING: '*⚙️ ᴛʀᴀɪᴛᴇᴍᴇɴᴛ ᴅᴇ ᴠᴏᴛʀᴇ ᴅᴇᴍᴀɴᴅᴇ...*'
  },

  // Paramètres de menu
  MENU_STYLE: 'buttons', // simple, buttons, cards, interactive
  SHOW_MENU_HEADER: true,
  SHOW_MENU_FOOTER: true,
  MENU_CATEGORIES: {
    general: { name: 'Général', emoji: '🌟', enabled: true },
    owner: { name: 'Propriétaire', emoji: '👑', enabled: true },
    admin: { name: 'Administration', emoji: '⚙️', enabled: true },
    group: { name: 'Groupe', emoji: '👥', enabled: true },
    download: { name: 'Téléchargement', emoji: '📥', enabled: true },
    search: { name: 'Recherche', emoji: '🔍', enabled: true },
    tools: { name: 'Outils', emoji: '🛠️', enabled: true },
    fun: { name: 'Fun', emoji: '🎮', enabled: true },
    ai: { name: 'IA', emoji: '🤖', enabled: true },
    conversion: { name: 'Conversion', emoji: '🔄', enabled: true },
    economy: { name: 'Économie', emoji: '💰', enabled: true },
    level: { name: 'Niveau', emoji: '📊', enabled: true },
    nsfw: { name: 'NSFW', emoji: '🔞', enabled: false }
  },

  // Paramètres de logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_TO_FILE: true,
  LOG_FILE_PATH: './logs/',

  // Paramètres avancés
  USE_PAIRING_CODE: true,
  BROWSER_NAME: 'ʜᴇɪɴᴢ-ᴍᴅ',
  BROWSER_VERSION: '1.0.0',
  PLATFORM: 'Web',

  // Paramètres de performance
  CACHE_ENABLED: true,
  CACHE_TTL: 3600, // 1 heure
  MAX_CACHE_SIZE: 100, // MB

  // Webhooks
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  WEBHOOK_EVENTS: ['connection', 'message', 'error'],

  // Paramètres de sauvegarde
  AUTO_BACKUP: true,
  BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 heures
  BACKUP_PATH: './backups/',

  // Fonctionnalités expérimentales
  EXPERIMENTAL_FEATURES: {
    VOICE_COMMANDS: false,
    AUTO_TRANSLATE: false,
    AI_CHAT: false,
    VOICE_CLONE: false,
    IMAGE_GENERATION: false
  },

  // Statistiques
  ENABLE_STATS: true,
  STATS_INTERVAL: 60000, // 1 minute

  // Mode debug
  DEBUG: process.env.DEBUG === 'true' || false,
  VERBOSE: process.env.VERBOSE === 'true' || false
};
