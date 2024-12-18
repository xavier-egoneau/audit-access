// server.js
const app = require('./app');
const port = process.env.PORT || 3001; // Changé de 3000 à 3001

const server = app.listen(port, () => {
    console.log(`Application démarrée sur http://localhost:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Le port ${port} est déjà utilisé. Veuillez arrêter le processus qui l'utilise ou choisir un autre port.`);
    } else {
        console.error('Erreur lors du démarrage du serveur:', err);
    }
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('SIGTERM signal reçu: fermeture du serveur HTTP');
    server.close(() => {
        console.log('Serveur HTTP fermé');
    });
});

module.exports = server;