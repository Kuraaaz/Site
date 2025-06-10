# Déploiement du Bot Discord sur Oracle Cloud

Ce document explique comment configurer et déployer le bot Discord sur un serveur Oracle Cloud pour qu'il communique avec votre site web.

## Prérequis

- Un serveur Oracle Cloud Infrastructure (OCI) avec une instance compute
- Node.js v16 ou supérieur installé sur le serveur
- PM2 installé globalement (`npm install -g pm2`)
- Un token bot Discord valide
- ID utilisateur Discord à suivre

## Structure des fichiers

Voici les fichiers nécessaires au déploiement sur Oracle :

- `oracle-bot.js` : Le serveur principal qui s'exécute sur Oracle
- `oracle-bot-config.js` : Configuration PM2 pour gérer le bot
- `.env` : Variables d'environnement (à créer)

## Configuration

### 1. Configurer les variables d'environnement

Créer un fichier `.env` sur votre serveur Oracle avec les variables suivantes :

```
DISCORD_BOT_TOKEN=votre_token_discord_ici
USER_ID=id_utilisateur_discord_à_suivre
PORT=3030
NODE_ENV=production
```

### 2. Transfert des fichiers vers Oracle

Transférer les fichiers suivants vers votre serveur Oracle :

- `oracle-bot.js`
- `oracle-bot-config.js`
- `package.json` (assurez-vous qu'il contient les dépendances nécessaires)

Vous pouvez utiliser SCP, SFTP, ou un outil similaire :

```bash
scp oracle-bot.js oracle-bot-config.js package.json user@your-oracle-server:/path/to/bot/
```

### 3. Installation des dépendances

Se connecter au serveur Oracle et installer les dépendances :

```bash
ssh user@your-oracle-server
cd /path/to/bot/
npm install
```

### 4. Démarrer le bot avec PM2

Utiliser PM2 pour gérer le processus du bot :

```bash
pm2 start oracle-bot-config.js
```

Pour s'assurer que le bot redémarre après un redémarrage du serveur :

```bash
pm2 save
pm2 startup
```

Suivre les instructions fournies par la commande `pm2 startup`.

## Configuration côté site web

### 1. Variable d'environnement sur votre hébergeur Vercel

Ajouter la variable d'environnement suivante dans la configuration de votre projet Vercel :

```
ORACLE_BOT_URL=https://your-oracle-server-ip:3030
```

Ou si vous utilisez un nom de domaine :

```
ORACLE_BOT_URL=https://bot.votredomaine.com
```

### 2. Configuration CORS

Si votre serveur Oracle est accessible via HTTPS, assurez-vous de modifier le fichier `oracle-bot.js` pour mettre à jour les origines autorisées dans la configuration CORS :

```javascript
app.use(cors({
  origin: ['http://localhost:3001', 'https://votre-site-production.vercel.app'],
  methods: ['GET', 'OPTIONS'],
  credentials: true
}));
```

## Fonctionnement

1. Lorsqu'un utilisateur accède à la page `welcome.html`, le script `welcome.js` est chargé
2. Ce script initialise `OracleBotClient` qui tente de se connecter au serveur Oracle
3. Le serveur Oracle renvoie les données du bot Discord (statut, activités)
4. Ces données peuvent être utilisées pour mettre à jour l'interface utilisateur

## Dépannage

### Vérifier les logs du bot

```bash
pm2 logs oracle-discord-bot
```

### Vérifier l'état du bot

```bash
pm2 show oracle-discord-bot
```

### Redémarrer le bot

```bash
pm2 restart oracle-discord-bot
```

### Le site n'arrive pas à se connecter au serveur Oracle

1. Vérifiez que le port 3030 est ouvert dans le pare-feu Oracle
2. Vérifiez les règles CORS dans `oracle-bot.js`
3. Assurez-vous que l'URL dans `ORACLE_BOT_URL` est correcte et accessible

## Sécurisation (Recommandé)

Pour une production réelle, il est fortement recommandé de :

1. Configurer HTTPS sur votre serveur Oracle
2. Mettre en place une authentification pour les API
3. Limiter les requêtes (rate limiting)
4. Mettre en place un proxy nginx devant votre application Node.js 