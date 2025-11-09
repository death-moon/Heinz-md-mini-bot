const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const moment = require('moment-timezone');

class Database {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data');
        this.dbType = global.config?.DB_TYPE || 'json';
        this.cache = new Map();
        this.saveQueue = [];
        this.saving = false;
        this.initPromise = null;
    }

    /**
     * Initialiser la base de données
     */
    async initialize() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                // Créer les dossiers nécessaires
                await this.ensureDirectories();

                // Charger les données en cache
                await this.loadCache();

                // Démarrer la sauvegarde automatique
                this.startAutoSave();

                console.log('✅ Base de données initialisée');
                return { success: true };
            } catch (error) {
                console.error('Erreur lors de l\'initialisation de la base de données:', error);
                throw error;
            }
        })();

        return this.initPromise;
    }

    /**
     * Créer les dossiers nécessaires
     */
    async ensureDirectories() {
        const directories = [
            this.dataPath,
            path.join(this.dataPath, 'users'),
            path.join(this.dataPath, 'groups'),
            path.join(this.dataPath, 'messages'),
            path.join(this.dataPath, 'sessions'),
            path.join(this.dataPath, 'stats'),
            path.join(this.dataPath, 'backups'),
            path.join(this.dataPath, 'plugins'),
            path.join(this.dataPath, 'temp')
        ];

        for (const dir of directories) {
            await fs.ensureDir(dir);
        }
    }

    /**
     * Charger les données en cache
     */
    async loadCache() {
        try {
            // Charger la configuration
            const configPath = path.join(this.dataPath, 'config.json');
            if (await fs.pathExists(configPath)) {
                const config = await fs.readJson(configPath);
                this.cache.set('config', config);
            }

            // Charger les utilisateurs
            const usersPath = path.join(this.dataPath, 'users');
            const userFiles = await fs.readdir(usersPath);
            for (const file of userFiles) {
                if (file.endsWith('.json')) {
                    const userId = file.replace('.json', '');
                    const userData = await fs.readJson(path.join(usersPath, file));
                    this.cache.set(`user_${userId}`, userData);
                }
            }

            // Charger les groupes
            const groupsPath = path.join(this.dataPath, 'groups');
            const groupFiles = await fs.readdir(groupsPath);
            for (const file of groupFiles) {
                if (file.endsWith('.json')) {
                    const groupId = file.replace('.json', '');
                    const groupData = await fs.readJson(path.join(groupsPath, file));
                    this.cache.set(`group_${groupId}`, groupData);
                }
            }

            console.log(`📊 ${this.cache.size} entrées chargées en cache`);
        } catch (error) {
            console.error('Erreur lors du chargement du cache:', error);
        }
    }

    /**
     * Démarrer la sauvegarde automatique
     */
    startAutoSave() {
        setInterval(async () => {
            await this.processSaveQueue();
        }, 5000); // Sauvegarder toutes les 5 secondes
    }

    /**
     * Traiter la file de sauvegarde
     */
    async processSaveQueue() {
        if (this.saving || this.saveQueue.length === 0) return;

        this.saving = true;
        const queue = [...this.saveQueue];
        this.saveQueue = [];

        for (const task of queue) {
            try {
                await this.executeSaveTask(task);
            } catch (error) {
                console.error('Erreur lors de la sauvegarde:', error);
            }
        }

        this.saving = false;
    }

    /**
     * Exécuter une tâche de sauvegarde
     */
    async executeSaveTask(task) {
        const { type, id, data } = task;
        let filePath;

        switch (type) {
            case 'user':
                filePath = path.join(this.dataPath, 'users', `${id}.json`);
                break;
            case 'group':
                filePath = path.join(this.dataPath, 'groups', `${id}.json`);
                break;
            case 'message':
                const date = moment().format('YYYY-MM-DD');
                filePath = path.join(this.dataPath, 'messages', date, `${id}.json`);
                await fs.ensureDir(path.dirname(filePath));
                break;
            case 'config':
                filePath = path.join(this.dataPath, 'config.json');
                break;
            case 'stats':
                filePath = path.join(this.dataPath, 'stats', `${id}.json`);
                break;
            default:
                filePath = path.join(this.dataPath, 'temp', `${id}.json`);
        }

        await fs.writeJson(filePath, data, { spaces: 2 });
    }

    /**
     * Sauvegarder un utilisateur
     */
    async saveUser(userId, userData) {
        const id = this.sanitizeId(userId);
        const existingData = this.cache.get(`user_${id}`) || {};

        const data = {
            ...existingData,
            ...userData,
            id,
            updatedAt: new Date().toISOString()
        };

        if (!data.createdAt) {
            data.createdAt = new Date().toISOString();
        }

        this.cache.set(`user_${id}`, data);
        this.saveQueue.push({ type: 'user', id, data });

        return data;
    }

    /**
     * Obtenir un utilisateur
     */
    async getUser(userId) {
        const id = this.sanitizeId(userId);
        let userData = this.cache.get(`user_${id}`);

        if (!userData) {
            const filePath = path.join(this.dataPath, 'users', `${id}.json`);
            if (await fs.pathExists(filePath)) {
                userData = await fs.readJson(filePath);
                this.cache.set(`user_${id}`, userData);
            } else {
                userData = {
                    id,
                    createdAt: new Date().toISOString(),
                    level: 1,
                    exp: 0,
                    coins: 100,
                    premium: false,
                    banned: false,
                    warnings: 0,
                    commands: {},
                    settings: {}
                };
                await this.saveUser(id, userData);
            }
        }

        return userData;
    }

    /**
     * Mettre à jour l'expérience d'un utilisateur
     */
    async addUserExp(userId, exp) {
        const userData = await this.getUser(userId);
        userData.exp = (userData.exp || 0) + exp;

        // Calculer le niveau
        const requiredExp = userData.level * 100;
        if (userData.exp >= requiredExp) {
            userData.level++;
            userData.exp -= requiredExp;
            userData.coins = (userData.coins || 0) + 50; // Bonus de niveau
        }

        await this.saveUser(userId, userData);
        return userData;
    }

    /**
     * Sauvegarder un groupe
     */
    async saveGroup(groupId, groupData) {
        const id = this.sanitizeId(groupId);
        const existingData = this.cache.get(`group_${id}`) || {};

        const data = {
            ...existingData,
            ...groupData,
            id,
            updatedAt: new Date().toISOString()
        };

        if (!data.createdAt) {
            data.createdAt = new Date().toISOString();
        }

        this.cache.set(`group_${id}`, data);
        this.saveQueue.push({ type: 'group', id, data });

        return data;
    }

    /**
     * Obtenir un groupe
     */
    async getGroup(groupId) {
        const id = this.sanitizeId(groupId);
        let groupData = this.cache.get(`group_${id}`);

        if (!groupData) {
            const filePath = path.join(this.dataPath, 'groups', `${id}.json`);
            if (await fs.pathExists(filePath)) {
                groupData = await fs.readJson(filePath);
                this.cache.set(`group_${id}`, groupData);
            } else {
                groupData = {
                    id,
                    createdAt: new Date().toISOString(),
                    settings: {
                        welcome: true,
                        goodbye: true,
                        antilink: false,
                        antispam: false,
                        antitoxic: false,
                        mute: false
                    },
                    warnings: {},
                    banned: [],
                    muted: []
                };
                await this.saveGroup(id, groupData);
            }
        }

        return groupData;
    }

    /**
     * Sauvegarder un message
     */
    async saveMessage(number, message) {
        try {
            const messageId = message.key.id;
            const chatId = message.key.remoteJid;
            const timestamp = message.messageTimestamp || Date.now() / 1000;

            const messageData = {
                id: messageId,
                chatId,
                from: message.key.fromMe ? number : message.key.participant || message.key.remoteJid,
                timestamp,
                type: Object.keys(message.message || {})[0],
                message: message.message,
                status: message.status
            };

            // Sauvegarder dans les stats
            await this.incrementStats(number, 'messages');

            // Sauvegarder le message
            const date = moment.unix(timestamp).format('YYYY-MM-DD');
            const id = `${chatId}_${messageId}`;
            this.saveQueue.push({ type: 'message', id, data: messageData });

            return messageData;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du message:', error);
        }
    }

    /**
     * Sauvegarder la configuration
     */
    async saveConfig(config) {
        this.cache.set('config', config);
        this.saveQueue.push({ type: 'config', id: 'config', data: config });
        return config;
    }

    /**
     * Obtenir la configuration
     */
    async getConfig() {
        let config = this.cache.get('config');

        if (!config) {
            const filePath = path.join(this.dataPath, 'config.json');
            if (await fs.pathExists(filePath)) {
                config = await fs.readJson(filePath);
                this.cache.set('config', config);
            } else {
                config = global.config || {};
                await this.saveConfig(config);
            }
        }

        return config;
    }

    /**
     * Incrémenter les statistiques
     */
    async incrementStats(number, type) {
        const statsId = `stats_${number}`;
        let stats = this.cache.get(statsId) || {};

        if (!stats[type]) {
            stats[type] = 0;
        }
        stats[type]++;
        stats.lastUpdate = new Date().toISOString();

        this.cache.set(statsId, stats);
        this.saveQueue.push({ type: 'stats', id: number, data: stats });

        return stats;
    }

    /**
     * Obtenir les statistiques
     */
    async getStats(number) {
        const statsId = `stats_${number}`;
        let stats = this.cache.get(statsId);

        if (!stats) {
            const filePath = path.join(this.dataPath, 'stats', `${number}.json`);
            if (await fs.pathExists(filePath)) {
                stats = await fs.readJson(filePath);
                this.cache.set(statsId, stats);
            } else {
                stats = {
                    messages: 0,
                    commands: 0,
                    groups: 0,
                    users: 0,
                    errors: 0,
                    startTime: new Date().toISOString()
                };
            }
        }

        return stats;
    }

    /**
     * Sauvegarder les données de session
     */
    async saveSession(number, sessionData) {
        const id = this.sanitizeId(number);
        const filePath = path.join(this.dataPath, 'sessions', `${id}.json`);
        await fs.writeJson(filePath, sessionData, { spaces: 2 });
        return sessionData;
    }

    /**
     * Obtenir les données de session
     */
    async getSession(number) {
        const id = this.sanitizeId(number);
        const filePath = path.join(this.dataPath, 'sessions', `${id}.json`);

        if (await fs.pathExists(filePath)) {
            return await fs.readJson(filePath);
        }

        return null;
    }

    /**
     * Supprimer une session
     */
    async deleteSession(number) {
        const id = this.sanitizeId(number);
        const filePath = path.join(this.dataPath, 'sessions', `${id}.json`);

        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            return true;
        }

        return false;
    }

    /**
     * Ajouter un avertissement à un utilisateur dans un groupe
     */
    async addWarning(groupId, userId, reason) {
        const groupData = await this.getGroup(groupId);

        if (!groupData.warnings[userId]) {
            groupData.warnings[userId] = [];
        }

        groupData.warnings[userId].push({
            reason,
            date: new Date().toISOString(),
            by: 'system'
        });

        await this.saveGroup(groupId, groupData);
        return groupData.warnings[userId].length;
    }

    /**
     * Bannir un utilisateur d'un groupe
     */
    async banUser(groupId, userId, reason) {
        const groupData = await this.getGroup(groupId);

        if (!groupData.banned.includes(userId)) {
            groupData.banned.push(userId);
        }

        groupData.banReasons = groupData.banReasons || {};
        groupData.banReasons[userId] = {
            reason,
            date: new Date().toISOString()
        };

        await this.saveGroup(groupId, groupData);
        return true;
    }

    /**
     * Débannir un utilisateur d'un groupe
     */
    async unbanUser(groupId, userId) {
        const groupData = await this.getGroup(groupId);

        groupData.banned = groupData.banned.filter(id => id !== userId);
        delete groupData.banReasons?.[userId];

        await this.saveGroup(groupId, groupData);
        return true;
    }

    /**
     * Vérifier si un utilisateur est banni
     */
    async isUserBanned(groupId, userId) {
        const groupData = await this.getGroup(groupId);
        return groupData.banned.includes(userId);
    }

    /**
     * Sauvegarder des données personnalisées
     */
    async saveCustomData(key, data) {
        const id = this.sanitizeId(key);
        this.cache.set(`custom_${id}`, data);

        const filePath = path.join(this.dataPath, 'temp', `${id}.json`);
        await fs.writeJson(filePath, data, { spaces: 2 });

        return data;
    }

    /**
     * Obtenir des données personnalisées
     */
    async getCustomData(key) {
        const id = this.sanitizeId(key);
        let data = this.cache.get(`custom_${id}`);

        if (!data) {
            const filePath = path.join(this.dataPath, 'temp', `${id}.json`);
            if (await fs.pathExists(filePath)) {
                data = await fs.readJson(filePath);
                this.cache.set(`custom_${id}`, data);
            }
        }

        return data;
    }

    /**
     * Créer une sauvegarde
     */
    async createBackup() {
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const backupPath = path.join(this.dataPath, 'backups', timestamp);

        await fs.ensureDir(backupPath);
        await fs.copy(this.dataPath, backupPath, {
            filter: (src) => !src.includes('backups')
        });

        return {
            success: true,
            path: backupPath,
            timestamp
        };
    }

    /**
     * Restaurer une sauvegarde
     */
    async restoreBackup(timestamp) {
        const backupPath = path.join(this.dataPath, 'backups', timestamp);

        if (!await fs.pathExists(backupPath)) {
            throw new Error('Sauvegarde non trouvée');
        }

        // Créer une sauvegarde de sécurité
        await this.createBackup();

        // Restaurer
        await fs.copy(backupPath, this.dataPath, {
            overwrite: true,
            filter: (src) => !src.includes('backups')
        });

        // Recharger le cache
        await this.loadCache();

        return { success: true };
    }

    /**
     * Nettoyer les données anciennes
     */
    async cleanOldData(days = 30) {
        const cutoffDate = moment().subtract(days, 'days');
        let cleaned = 0;

        // Nettoyer les messages
        const messagesPath = path.join(this.dataPath, 'messages');
        const messageDirs = await fs.readdir(messagesPath);

        for (const dir of messageDirs) {
            const dirDate = moment(dir, 'YYYY-MM-DD');
            if (dirDate.isBefore(cutoffDate)) {
                await fs.remove(path.join(messagesPath, dir));
                cleaned++;
            }
        }

        // Nettoyer les fichiers temporaires
        const tempPath = path.join(this.dataPath, 'temp');
        const tempFiles = await fs.readdir(tempPath);

        for (const file of tempFiles) {
            const filePath = path.join(tempPath, file);
            const stats = await fs.stat(filePath);
            const fileDate = moment(stats.mtime);

            if (fileDate.isBefore(cutoffDate)) {
                await fs.remove(filePath);
                cleaned++;
            }
        }

        return { success: true, cleaned };
    }

    /**
     * Obtenir la taille de la base de données
     */
    async getDatabaseSize() {
        const getSize = async (dir) => {
            let size = 0;
            const files = await fs.readdir(dir, { withFileTypes: true });

            for (const file of files) {
                const filePath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    size += await getSize(filePath);
                } else {
                    const stats = await fs.stat(filePath);
                    size += stats.size;
                }
            }

            return size;
        };

        const size = await getSize(this.dataPath);
        return {
            bytes: size,
            mb: (size / (1024 * 1024)).toFixed(2),
            gb: (size / (1024 * 1024 * 1024)).toFixed(2)
        };
    }

    /**
     * Fermer la base de données
     */
    async close() {
        // Sauvegarder toutes les données en attente
        await this.processSaveQueue();

        // Vider le cache
        this.cache.clear();

        console.log('🔒 Base de données fermée');
        return { success: true };
    }

    /**
     * Nettoyer et formater un ID
     */
    sanitizeId(id) {
        return id.toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    /**
     * Générer un ID unique
     */
    generateId() {
        return crypto.randomBytes(16).toString('hex');
    }
}

module.exports = Database;
