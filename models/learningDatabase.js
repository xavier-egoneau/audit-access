const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class LearningDatabase {
    constructor() {
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)){
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const dbPath = path.join(dataDir, 'learning.sqlite');
        this.db = new sqlite3.Database(dbPath);
        this.initDatabase();
    }

    initDatabase() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Table des patterns d'apprentissage globaux
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS learning_patterns (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        criterion_id TEXT NOT NULL,
                        pattern TEXT NOT NULL,
                        frequency INTEGER DEFAULT 1,
                        confidence_score FLOAT DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(criterion_id, pattern)
                    )
                `);

                // Table des suggestions globales
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS learning_suggestions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        criterion_id TEXT NOT NULL,
                        context TEXT,
                        impact TEXT,
                        description TEXT,
                        solution TEXT,
                        used_count INTEGER DEFAULT 0,
                        success_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(criterion_id, description)
                    )
                `);

                // Table de feedback global
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS learning_feedback (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        suggestion_id INTEGER,
                        is_helpful BOOLEAN,
                        comment TEXT,
                        project_id TEXT,
                        user_context TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(suggestion_id) REFERENCES learning_suggestions(id)
                    )
                `);

                // Table des métriques globales
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS learning_metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        criterion_id TEXT NOT NULL,
                        suggestion_count INTEGER DEFAULT 0,
                        success_rate FLOAT DEFAULT 0,
                        usage_count INTEGER DEFAULT 0,
                        last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(criterion_id)
                    )
                `);

                // Création des index
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_patterns_criterion ON learning_patterns(criterion_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_suggestions_criterion ON learning_suggestions(criterion_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_suggestion ON learning_feedback(suggestion_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_criterion ON learning_metrics(criterion_id)`);

                resolve();
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Méthodes utilitaires pour les transactions
    beginTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    commit() {
        return new Promise((resolve, reject) => {
            this.db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    rollback() {
        return new Promise((resolve, reject) => {
            this.db.run('ROLLBACK', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Méthode pour obtenir une instance unique
    static getInstance() {
        if (!LearningDatabase.instance) {
            LearningDatabase.instance = new LearningDatabase();
        }
        return LearningDatabase.instance;
    }
}

module.exports = LearningDatabase;