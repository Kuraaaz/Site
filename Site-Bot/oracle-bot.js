require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// Configuration du serveur Express
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3030;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'https://votre-site-production.vercel.app'],
  methods: ['GET', 'OPTIONS'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
  console.log(`Bot Discord connecté en tant que ${client.user.tag}`);
  isConnected = true;
  connectionError = null;
  
  // Mettre à jour les données initiales
  updateUserData();
});

// Gérer les mises à jour de présence
client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (newPresence && newPresence.userId === process.env.USER_ID) {
    // Récupérer les activités avec les assets (images)
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
    console.log('Nouvelle activité:', userData.activities.map(a => `${a.type}: ${a.name}`).join(', '));
  }
});

// Gérer les erreurs
client.on('error', (error) => {
  console.error('Erreur Discord bot:', error);
  connectionError = error;
  isConnected = false;
});

// Fonction pour mettre à jour les données utilisateur
async function updateUserData() {
  try {
    if (!client.isReady()) return;
    
    const user = await client.users.fetch(process.env.USER_ID);
    if (!user) return;
    
    userData.username = '!" Kura';
    userData.avatar = user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    // Chercher l'utilisateur dans les serveurs
    const guild = client.guilds.cache.find(g => g.members.cache.has(process.env.USER_ID));
    if (!guild) return;
    
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
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des données:', error);
  }
}

// API Route pour récupérer les données utilisateur
app.get('/api/discord/discord-data', (req, res) => {
  res.json(userData);
});

// API Route pour vérifier le statut de connexion
app.get('/api/discord/status', (req, res) => {
  const status = {
    isConnected,
    error: connectionError ? connectionError.message : null
  };
  
  res.status(isConnected ? 200 : 503).json(status);
});

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`Serveur Oracle démarré sur le port ${PORT}`);
  
  // Se connecter au bot Discord
  if (process.env.DISCORD_BOT_TOKEN) {
    console.log('Tentative de connexion au bot Discord...');
    client.login(process.env.DISCORD_BOT_TOKEN)
      .then(() => {
        console.log('Promesse de connexion résolue');
      })
      .catch(error => {
        console.error('Erreur de connexion Discord:', error);
        connectionError = error;
        isConnected = false;
      });
  } else {
    console.warn('Token Discord non disponible. Les fonctionnalités Discord seront désactivées.');
  }
});

// Configuration pour garder le serveur actif
setInterval(() => {
  if (isConnected && client.isReady()) {
    console.log('Ping de maintien en activité');
    updateUserData();
  }
}, 5 * 60 * 1000); // 5 minutes 