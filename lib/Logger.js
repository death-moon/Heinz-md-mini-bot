const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const util = require("util");

class Logger {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || "info",
      logToFile: options.logToFile !== false,
      logToConsole: options.logToConsole !== false,
      logPath: options.logPath || path.join(__dirname, "..", "logs"),
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: options.maxLogFiles || 10,
      timezone: options.timezone || "Africa/Douala",
      dateFormat: options.dateFormat || "YYYY-MM-DD HH:mm:ss",
      colorize: options.colorize !== false,
      ...options,
    };

    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4,
    };

    this.colors = {
      debug: "\x1b[36m", // Cyan
      info: "\x1b[32m", // Green
      warn: "\x1b[33m", // Yellow
      error: "\x1b[31m", // Red
      fatal: "\x1b[35m", // Magenta
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
    };

    this.icons = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      fatal: "💀",
    };

    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.currentLogFile = null;
    this.logStream = null;

    this.initialize();
  }

  /**
   * Initialiser le logger
   */
  async initialize() {
    if (this.options.logToFile) {
      await this.ensureLogDirectory();
      await this.initializeLogFile();
      await this.startLogRotation();
    }
  }

  /**
   * Créer le dossier de logs
   */
  async ensureLogDirectory() {
    await fs.ensureDir(this.options.logPath);
  }

  /**
   * Initialiser le fichier de log
   */
  async initializeLogFile() {
    const date = moment().tz(this.options.timezone).format("YYYY-MM-DD");
    this.currentLogFile = path.join(
      this.options.logPath,
      `nice-md-${date}.log`,
    );

    // Vérifier la rotation si le fichier existe
    if (await fs.pathExists(this.currentLogFile)) {
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size >= this.options.maxLogSize) {
        await this.rotateLog();
      }
    }
  }

  /**
   * Démarrer la rotation automatique des logs
   */
  async startLogRotation() {
    // Vérifier toutes les heures
    setInterval(
      async () => {
        await this.checkLogRotation();
      },
      60 * 60 * 1000,
    );

    // Rotation quotidienne à minuit
    const now = moment().tz(this.options.timezone);
    const midnight = moment().tz(this.options.timezone).endOf("day");
    const msUntilMidnight = midnight.diff(now);

    setTimeout(async () => {
      await this.initializeLogFile();
      // Ensuite toutes les 24 heures
      setInterval(
        async () => {
          await this.initializeLogFile();
        },
        24 * 60 * 60 * 1000,
      );
    }, msUntilMidnight);
  }

  /**
   * Vérifier si une rotation est nécessaire
   */
  async checkLogRotation() {
    if (!this.currentLogFile || !(await fs.pathExists(this.currentLogFile))) {
      return;
    }

    const stats = await fs.stat(this.currentLogFile);
    if (stats.size >= this.options.maxLogSize) {
      await this.rotateLog();
    }
  }

  /**
   * Effectuer la rotation du log
   */
  async rotateLog() {
    const timestamp = moment()
      .tz(this.options.timezone)
      .format("YYYY-MM-DD_HHmmss");
    const rotatedFile = path.join(
      this.options.logPath,
      `nice-md-${timestamp}.log`,
    );

    // Renommer le fichier actuel
    if (await fs.pathExists(this.currentLogFile)) {
      await fs.move(this.currentLogFile, rotatedFile);
    }

    // Nettoyer les anciens fichiers
    await this.cleanOldLogs();

    // Réinitialiser le fichier de log
    await this.initializeLogFile();
  }

  /**
   * Nettoyer les anciens fichiers de log
   */
  async cleanOldLogs() {
    const files = await fs.readdir(this.options.logPath);
    const logFiles = files
      .filter((f) => f.startsWith("nice-md-") && f.endsWith(".log"))
      .sort()
      .reverse();

    if (logFiles.length > this.options.maxLogFiles) {
      const toDelete = logFiles.slice(this.options.maxLogFiles);
      for (const file of toDelete) {
        await fs.remove(path.join(this.options.logPath, file));
      }
    }
  }

  /**
   * Formater un message de log
   */
  formatMessage(level, message, data = {}) {
    const timestamp = moment()
      .tz(this.options.timezone)
      .format(this.options.dateFormat);
    const levelStr = level.toUpperCase().padEnd(5);

    let formattedMessage = message;
    if (typeof message === "object") {
      formattedMessage = util.inspect(message, { depth: null, colors: false });
    }

    let logLine = `[${timestamp}] [${levelStr}] ${formattedMessage}`;

    if (Object.keys(data).length > 0) {
      logLine += ` | ${JSON.stringify(data)}`;
    }

    return logLine;
  }

  /**
   * Formater pour la console avec couleurs
   */
  formatForConsole(level, message, data = {}) {
    if (!this.options.colorize) {
      return this.formatMessage(level, message, data);
    }

    const timestamp = moment()
      .tz(this.options.timezone)
      .format(this.options.dateFormat);
    const color = this.colors[level] || this.colors.reset;
    const icon = this.icons[level] || "";

    let formattedMessage = message;
    if (typeof message === "object") {
      formattedMessage = util.inspect(message, { depth: null, colors: true });
    }

    let logLine = `${this.colors.dim}[${timestamp}]${this.colors.reset} `;
    logLine += `${color}${this.colors.bold}[${level.toUpperCase()}]${this.colors.reset} `;
    logLine += `${icon} ${formattedMessage}`;

    if (Object.keys(data).length > 0) {
      logLine += ` ${this.colors.dim}|${this.colors.reset} ${JSON.stringify(data, null, 2)}`;
    }

    return logLine;
  }

  /**
   * Écrire dans le fichier de log
   */
  async writeToFile(message) {
    if (!this.options.logToFile) return;

    try {
      await fs.appendFile(this.currentLogFile, message + "\n", "utf8");
    } catch (error) {
      console.error("Erreur lors de l'écriture du log:", error);
    }
  }

  /**
   * Logger principal
   */
  async log(level, message, data = {}) {
    // Vérifier le niveau de log
    if (this.levels[level] < this.levels[this.options.logLevel]) {
      return;
    }

    // Formater le message
    const formattedMessage = this.formatMessage(level, message, data);
    const consoleMessage = this.formatForConsole(level, message, data);

    // Ajouter au buffer
    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      formatted: formattedMessage,
    });

    // Limiter la taille du buffer
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Écrire dans la console
    if (this.options.logToConsole) {
      if (level === "error" || level === "fatal") {
        console.error(consoleMessage);
      } else if (level === "warn") {
        console.warn(consoleMessage);
      } else {
        console.log(consoleMessage);
      }
    }

    // Écrire dans le fichier
    await this.writeToFile(formattedMessage);

    // Émettre un événement pour les listeners
    if (global.io) {
      global.io.emit("log", {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Méthodes de logging spécifiques
   */
  async debug(message, data = {}) {
    await this.log("debug", message, data);
  }

  async info(message, data = {}) {
    await this.log("info", message, data);
  }

  async warn(message, data = {}) {
    await this.log("warn", message, data);
  }

  async error(message, data = {}) {
    await this.log("error", message, data);
  }

  async fatal(message, data = {}) {
    await this.log("fatal", message, data);
  }

  /**
   * Logger une requête HTTP
   */
  async logRequest(req, res, duration) {
    const data = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get("user-agent"),
    };

    const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
    await this.info(message, data);
  }

  /**
   * Logger une commande
   */
  async logCommand(user, command, args, result) {
    const data = {
      user,
      command,
      args,
      success: result.success,
      duration: result.duration,
    };

    const message = `Command: ${command} by ${user}`;
    if (result.success) {
      await this.info(message, data);
    } else {
      await this.warn(message, { ...data, error: result.error });
    }
  }

  /**
   * Logger une erreur avec stack trace
   */
  async logError(error, context = {}) {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
    };

    await this.error(`${error.name}: ${error.message}`, errorData);
  }

  /**
   * Obtenir les logs récents
   */
  async getLogs(limit = 100, level = "all", search = "") {
    let logs = [...this.logBuffer];

    // Filtrer par niveau
    if (level !== "all" && this.levels[level] !== undefined) {
      logs = logs.filter((log) => this.levels[log.level] >= this.levels[level]);
    }

    // Recherche
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.data).toLowerCase().includes(searchLower),
      );
    }

    // Limiter et inverser pour avoir les plus récents en premier
    return logs.slice(-limit).reverse();
  }

  /**
   * Obtenir les logs depuis un fichier
   */
  async getLogsFromFile(date = null, lines = 100) {
    const logDate =
      date || moment().tz(this.options.timezone).format("YYYY-MM-DD");
    const logFile = path.join(this.options.logPath, `nice-md-${logDate}.log`);

    if (!(await fs.pathExists(logFile))) {
      return [];
    }

    const content = await fs.readFile(logFile, "utf8");
    const logLines = content.trim().split("\n");

    return logLines
      .slice(-lines)
      .reverse()
      .map((line) => {
        try {
          // Parser la ligne de log
          const matches = line.match(/\[([^\]]+)\] \[([^\]]+)\] (.+)/);
          if (matches) {
            return {
              timestamp: matches[1],
              level: matches[2].trim().toLowerCase(),
              message: matches[3],
              raw: line,
            };
          }
          return { raw: line };
        } catch (error) {
          return { raw: line };
        }
      });
  }

  /**
   * Obtenir les statistiques de logs
   */
  async getStats() {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {},
      recentErrors: [],
      diskUsage: 0,
    };

    // Compter par niveau
    for (const log of this.logBuffer) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    }

    // Erreurs récentes
    stats.recentErrors = this.logBuffer
      .filter((log) => log.level === "error" || log.level === "fatal")
      .slice(-10);

    // Utilisation disque
    if (this.options.logToFile) {
      const files = await fs.readdir(this.options.logPath);
      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = path.join(this.options.logPath, file);
          const stats = await fs.stat(filePath);
          stats.diskUsage += stats.size;
        }
      }
    }

    return stats;
  }

  /**
   * Nettoyer les logs
   */
  async clear() {
    this.logBuffer = [];
    await this.info("Logs cleared");
  }

  /**
   * Exporter les logs
   */
  async export(format = "json", destination = null) {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalLogs: this.logBuffer.length,
        format,
      },
      logs: this.logBuffer,
    };

    let content;
    if (format === "json") {
      content = JSON.stringify(exportData, null, 2);
    } else if (format === "csv") {
      content = "Timestamp,Level,Message,Data\n";
      for (const log of this.logBuffer) {
        content += `"${log.timestamp}","${log.level}","${log.message}","${JSON.stringify(log.data)}"\n`;
      }
    } else {
      content = this.logBuffer.map((log) => log.formatted).join("\n");
    }

    if (destination) {
      await fs.writeFile(destination, content, "utf8");
    }

    return content;
  }
}

module.exports = Logger;
