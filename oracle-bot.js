require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration du système de logs
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'oracle-bot.log');

// Créer le répertoire logs s'il n'existe pas
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Fonction de log avancée
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Construire le message de log complet
  let fullLogMessage = logMessage;
  if (data) {
    try {
      if (typeof data === 'object') {
        fullLogMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        fullLogMessage += `\n${data}`;
      }
    } catch (error) {
      fullLogMessage += `\n[Erreur de sérialisation: ${error.message}]`;
    }
  }
  
  // Afficher dans la console
  switch (level.toLowerCase()) {
    case 'error':
      console.error(fullLogMessage);
      break;
    case 'warn':
      console.warn(fullLogMessage);
      break;
    case 'info':
      console.info(fullLogMessage);
      break;
    default:
      console.log(fullLogMessage);
  }
  
  // Écrire dans le fichier de log
  try {
    fs.appendFileSync(LOG_FILE, fullLogMessage + '\n');
  } catch (err) {
    console.error(`Erreur d'écriture du log: ${err.message}`);
  }
  
  return logMessage;
}

// Configuration du serveur Express
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3030;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'https://kuraz.vercel.app', 'http://144.24.207.208:3030', '*'],
  methods: ['GET', 'OPTIONS'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware de logging pour toutes les requêtes
app.use((req, res, next) => {
  const startTime = Date.now();
  
  log('info', `Requête entrante: ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  });
  
  // Intercepter la fin de la requête pour logger le résultat
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    log(level, `Requête terminée: ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`, {
      ip: req.ip,
      statusCode: res.statusCode,
      duration: duration
    });
  });
  
  next();
});

// Variable pour stocker l'activité et le statut de l'utilisateur
let userData = {
  id: process.env.USER_ID || "1046834138583412856",
  username: '!" Kura',
  avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
  status: 'offline',
  activities: []
};

let isConnected = false;
let connectionError = null;
let lastInteractionTime = Date.now();
let interactionCount = {
  total: 0,
  statusRequests: 0,
  dataRequests: 0
};

// Configurer le client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
});

// Gérer l'événement de connexion réussie
client.on('ready', () => {
  log('info', `Bot Discord connecté en tant que ${client.user.tag}`, {
    username: client.user.tag,
    id: client.user.id
  });
  isConnected = true;
  connectionError = null;
  
  // Mettre à jour les données initiales
  updateUserData();
});

// Gérer les mises à jour de présence
client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (newPresence && newPresence.userId === process.env.USER_ID) {
    // Récupérer les activités avec les assets (images)
    const oldActivities = userData.activities || [];
    userData.activities = newPresence.activities.map(activity => ({
      name: activity.name,
      type: activity.type,
      state: activity.state || null,
      details: activity.details || null,
      assets: activity.assets || null,
      application_id: activity.applicationId || null,
      start_timestamp: activity.timestamps?.start ? Number(activity.timestamps.start) : null
    }));
    userData.status = newPresence.status;
    
    // Comparer l'ancienne et la nouvelle activité pour loguer les changements
    const activityChanged = JSON.stringify(oldActivities) !== JSON.stringify(userData.activities);
    const statusChanged = oldPresence?.status !== newPresence.status;
    
    if (activityChanged || statusChanged) {
      log('info', 'Mise à jour de la présence utilisateur', {
        userId: newPresence.userId,
        oldStatus: oldPresence?.status || 'inconnu',
        newStatus: newPresence.status,
        activitiesUpdated: activityChanged,
        activityNames: userData.activities.map(a => a.name)
      });
    }
  }
});

// Gérer les erreurs
client.on('error', (error) => {
  log('error', 'Erreur Discord bot', {
    message: error.message,
    stack: error.stack
  });
  connectionError = error;
  isConnected = false;
});

// Fonction pour mettre à jour les données utilisateur
async function updateUserData() {
  try {
    if (!client.isReady()) return;
    
    const user = await client.users.fetch(process.env.USER_ID);
    if (!user) {
      log('warn', 'Utilisateur Discord non trouvé');
      return;
    }
    
    userData.username = '!" Kura';
    userData.avatar = user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    // Chercher l'utilisateur dans les serveurs
    const guild = client.guilds.cache.find(g => g.members.cache.has(process.env.USER_ID));
    if (!guild) {
      log('warn', 'Utilisateur non trouvé dans les serveurs disponibles');
      return;
    }
    
    const presence = guild.presences.resolve(process.env.USER_ID);
    if (presence) {
      userData.status = presence.status;
      userData.activities = presence.activities ? presence.activities.map(activity => ({
        name: activity.name,
        type: activity.type,
        details: activity.details || null,
        state: activity.state || null,
        assets: activity.assets || null,
        application_id: activity.applicationId || null,
        start_timestamp: activity.timestamps?.start ? Number(activity.timestamps.start) : null
      })) : [];
      
      log('info', 'Données utilisateur mises à jour', {
        userId: process.env.USER_ID,
        status: userData.status,
        activitiesCount: userData.activities.length
      });
    }
  } catch (error) {
    log('error', 'Erreur lors de la mise à jour des données utilisateur', {
      message: error.message,
      stack: error.stack
    });
  }
}

// API Route pour récupérer les données utilisateur
app.get('/api/discord/discord-data', (req, res) => {
  interactionCount.total++;
  interactionCount.dataRequests++;
  lastInteractionTime = Date.now();
  
  log('info', 'Requête de données Discord', {
    origin: req.get('Origin') || 'Origine inconnue',
    count: interactionCount.dataRequests
  });
  
  res.json(userData);
});

// API Route pour vérifier le statut de connexion
app.get('/api/discord/status', (req, res) => {
  interactionCount.total++;
  interactionCount.statusRequests++;
  lastInteractionTime = Date.now();
  
  const status = {
    isConnected,
    error: connectionError ? connectionError.message : null
  };
  
  log('info', 'Requête de statut Discord', {
    origin: req.get('Origin') || 'Origine inconnue',
    status: status,
    count: interactionCount.statusRequests
  });
  
  res.status(isConnected ? 200 : 503).json(status);
});

// API pour obtenir des statistiques sur les interactions
app.get('/api/stats', (req, res) => {
  const stats = {
    uptime: process.uptime(),
    interactionCount,
    lastInteractionTime,
    timeSinceLastInteraction: Date.now() - lastInteractionTime,
    isConnected,
    memoryUsage: process.memoryUsage()
  };
  
  log('info', 'Requête de statistiques', { origin: req.get('Origin') });
  
  res.json(stats);
});

// Démarrer le serveur
server.listen(PORT, () => {
  log('info', `Serveur Oracle démarré sur le port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  
  // Se connecter au bot Discord
  if (process.env.DISCORD_BOT_TOKEN) {
    log('info', 'Tentative de connexion au bot Discord...');
    client.login(process.env.DISCORD_BOT_TOKEN)
      .then(() => {
        log('info', 'Connexion au bot Discord réussie');
      })
      .catch(error => {
        log('error', 'Erreur de connexion Discord', {
          message: error.message,
          stack: error.stack
        });
        connectionError = error;
        isConnected = false;
      });
  } else {
    log('warn', 'Token Discord non disponible. Les fonctionnalités Discord seront désactivées.');
  }
});

// Configuration pour garder le serveur actif
setInterval(() => {
  if (isConnected && client.isReady()) {
    log('debug', 'Ping de maintien en activité');
    updateUserData();
  }
  
  // Générer des logs de statistiques toutes les heures
  if (process.uptime() % 3600 < 10) { // Environ toutes les heures
    log('info', 'Statistiques d\'interaction', {
      uptime: process.uptime(),
      interactionCount,
      timeSinceLastInteraction: Date.now() - lastInteractionTime,
      memoryUsage: process.memoryUsage()
    });
  }
}, 5 * 60 * 1000); // 5 minutes 