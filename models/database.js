const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const xml2js = require('xml2js');
const fs = require('fs');
const fsPromises = require('fs').promises;

class Database {
    constructor(projectId) {
        this.projectId = projectId;
        const dbPath = path.join(__dirname, '..', 'database', `${projectId}.sqlite`);
        
        // S'assurer que le dossier database existe
        const dbDir = path.join(__dirname, '..', 'database');
        if (!fs.existsSync(dbDir)){
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.initDatabase();
    }

    static async projectExists(projectId) {
        const dbPath = path.join(__dirname, '..', 'database', `${projectId}.sqlite`);
        try {
            await fsPromises.access(dbPath);
            const db = new sqlite3.Database(dbPath);
            return new Promise((resolve, reject) => {
                db.get('SELECT * FROM project_info LIMIT 1', (err, row) => {
                    db.close();
                    if (err) {
                        resolve(false);
                    }
                    resolve(!!row);
                });
            });
        } catch {
            return false;
        }
    }

    initDatabase() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Table des informations du projet
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS project_info (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        url TEXT,
                        referential TEXT NOT NULL,
                        referential_version TEXT, -- Modification ici : utiliser -- pour les commentaires SQL
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Table des pages auditées
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS pages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        url TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Table des résultats de l'audit
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS audit_results (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        page_id INTEGER,
                        criterion_id TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(page_id, criterion_id)
                    )
                `);

                // Table des non-conformités
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS non_conformities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        criterion_id TEXT NOT NULL,
                        impact TEXT,
                        description TEXT,
                        screenshot_path TEXT,
                        solution TEXT,
                        page_ids TEXT, /* Stockage JSON des IDs des pages concernées */
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, err => {
                    if (err) reject(err);
                    
                    // Mettre à jour la table si elle existe déjà pour ajouter la colonne page_ids
                    this.db.run(`
                        PRAGMA table_info(non_conformities)
                    `, (err, rows) => {
                        if (err) reject(err);
                        
                        // Vérifier si la colonne page_ids existe
                        this.db.get(`
                            SELECT COUNT(*) as count 
                            FROM pragma_table_info('non_conformities') 
                            WHERE name = 'page_ids'
                        `, (err, row) => {
                            if (err) reject(err);
                            
                            if (row.count === 0) {
                                // Ajouter la colonne page_ids si elle n'existe pas
                                this.db.run(`
                                    ALTER TABLE non_conformities 
                                    ADD COLUMN page_ids TEXT
                                `, err => {
                                    if (err) reject(err);
                                    resolve();
                                });
                            } else {
                                resolve();
                            }
                        });
                    });
                });
            });
        });
    }
    // Dans database.js, ajouter la méthode suivante après calculateGlobalRate()
    async getCriteriaStatuses(pageId = null) {
        return new Promise((resolve, reject) => {
            let query;
            const params = [];

            if (pageId) {
                // Si on demande une page spécifique
                query = `SELECT criterion_id, status FROM audit_results WHERE page_id = ?`;
                params.push(pageId);
            } else {
                // Si on est sur "Toutes les pages", on vérifie si les statuts sont cohérents
                query = `
                    SELECT 
                        criterion_id,
                        CASE 
                            WHEN COUNT(DISTINCT status) > 1 THEN 'MULTIPLE'
                            ELSE MAX(status)
                        END as status
                    FROM audit_results 
                    GROUP BY criterion_id
                `;
            }

            this.db.all(query, params, (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const statuses = {};
                results.forEach(result => {
                    statuses[result.criterion_id] = result.status;
                });
                
                resolve(statuses);
            });
        });
    }


    // Méthode pour charger les critères depuis le XML
    async loadCriteria(referentialPath) {
        try {
            // Déterminer le bon fichier XML selon le référentiel
            const projectInfo = await new Promise((resolve, reject) => {
                this.db.get('SELECT referential FROM project_info WHERE id = ?', [this.projectId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
    
            // Choisir le fichier XML approprié
            const xmlFile = projectInfo.referential === 'WCAG' ? 'criteres_wcag.xml' : 
                           projectInfo.referential === 'RAAM' ? 'criteres_raam.xml' : 
                           'criteres_rgaa.xml';
            const xmlPath = path.join(__dirname, '..', xmlFile);
    
            const xmlData = await fsPromises.readFile(xmlPath, 'utf8');
            const parser = new xml2js.Parser();
            
            const result = await new Promise((resolve, reject) => {
                parser.parseString(xmlData, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
    
            // Récupérer la version depuis le XML
            const version = result.CRITERES.$.version;
            
            // Mettre à jour la version dans la base de données
            await this.updateReferentialVersion(version);
            
            return result.CRITERES.Critere.map(critere => {
                return {
                    id: critere.$.id,
                    titre: this.encodeHtml(critere.Titre[0]),
                    niveauWCAG: critere.NiveauWCAG[0],
                    tests: critere.Tests[0].Test.map(test => ({
                        id: test.$.id,
                        description: this.encodeHtml(test.Description[0]),
                        methodologie: Array.isArray(test.Methodologie[0].Etape) 
                            ? test.Methodologie[0].Etape.map(e => this.encodeHtml(e))
                            : []
                    }))
                };
            });
            
        } catch (error) {
            console.error('Erreur lors du chargement des critères:', error);
            throw error;
        }
    }

    async updateReferentialVersion(version) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE project_info SET referential_version = ? WHERE id = ?',
                [version, this.projectId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
    }

    // Ajouter cette méthode à la classe Database
    encodeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Calculer le taux de conformité d'une page
    async calculatePageRate(pageId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT criterion_id, status FROM audit_results WHERE page_id = ?`,
                [pageId],
                async (err, results) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    try {
                        // Nombre total de critères
                        const allCriteria = await this.loadCriteria(path.join(__dirname, '..', 'criteres_rgaa.xml'));
                        
                        // Nombre de critères NA (Non Applicables)
                        const naCount = results.filter(r => r.status === 'NA').length;
                        
                        // Nombre de critères conformes
                        const validResults = results.filter(r => r.status === 'C').length;
                        
                        // Application de la formule
                        const applicableCriteria = allCriteria.length - naCount;
                        const rate = Math.round((100 / applicableCriteria) * validResults);
                        
                        console.log('--- Calcul du taux pour la page ---');
                        console.log('Page ID:', pageId);
                        console.log('Nombre total de critères:', allCriteria.length);
                        console.log('Nombre de NA:', naCount);
                        console.log('Critères applicables:', applicableCriteria);
                        console.log('Nombre de conformes:', validResults);
                        console.log('Taux calculé:', rate);
                        console.log('--------------------------------');

                        resolve(rate);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    // Calculer le taux global
    // Modification de la méthode calculateGlobalRate dans database.js
    
    
    async calculateAverageRate() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT id FROM pages`, async (err, pages) => {
                if (err) {
                    reject(err);
                    return;
                }

                try {
                    if (!pages || pages.length === 0) {
                        resolve(0); // Retourne 0 s'il n'y a pas de pages
                        return;
                    }

                    const rates = await Promise.all(pages.map(page => this.calculatePageRate(page.id)));
                    const validRates = rates.filter(rate => !isNaN(rate)); // Filtre les valeurs NaN
                    
                    if (validRates.length === 0) {
                        resolve(0); // Retourne 0 si aucun taux valide
                        return;
                    }

                    const average = Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length);
                    
                    console.log('--- Calcul du taux moyen ---');
                    console.log('Nombre de pages:', pages.length);
                    console.log('Taux par page:', rates);
                    console.log('Taux moyen calculé:', average);
                    console.log('--------------------------------');
                    
                    resolve(average);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async calculateGlobalRate() {
        return new Promise((resolve, reject) => {
            Promise.all([
                this.loadCriteria(path.join(__dirname, '..', 'criteres_rgaa.xml')),
                new Promise((resolve, reject) => {
                    this.db.all('SELECT id FROM pages', (err, pages) => {
                        if (err) reject(err);
                        resolve(pages);
                    });
                })
            ]).then(async ([allCriteria, pages]) => {
                try {
                    if (!pages || pages.length === 0) {
                        resolve(0); // Retourne 0 s'il n'y a pas de pages
                        return;
                    }

                    const globalStatuses = await Promise.all(
                        allCriteria.map(async (criterion) => {
                            const results = await new Promise((resolve, reject) => {
                                this.db.all(
                                    `SELECT status FROM audit_results 
                                    WHERE criterion_id = ?`,
                                    [criterion.id],
                                    (err, results) => {
                                        if (err) reject(err);
                                        resolve(results);
                                    }
                                );
                            });

                            if (results.length === pages.length && 
                                results.every(r => r.status === 'NA')) {
                                return 'NA';
                            }
                            
                            if (results.length === pages.length && 
                                results.every(r => r.status === 'C')) {
                                return 'C';
                            }

                            return 'NC';
                        })
                    );

                    const naCount = globalStatuses.filter(status => status === 'NA').length;
                    const conformCount = globalStatuses.filter(status => status === 'C').length;

                    const applicableCriteria = allCriteria.length - naCount;
                    
                    // Si aucun critère applicable, retourner 0
                    if (applicableCriteria === 0) {
                        resolve(0);
                        return;
                    }

                    const rate = Math.round((100 / applicableCriteria) * conformCount);
                    
                    console.log('--- Calcul du taux global ---');
                    console.log('Nombre total de critères:', allCriteria.length);
                    console.log('Nombre de NA global:', naCount);
                    console.log('Critères applicables:', applicableCriteria);
                    console.log('Nombre de conformes global:', conformCount);
                    console.log('Taux global calculé:', rate);
                    console.log('--------------------------------');

                    resolve(rate);
                } catch (error) {
                    reject(error);
                }
            }).catch(reject);
        });
    }

    // calculer le nombre de critères
    async getTotalCriteria() {
        try {
            const allCriteria = await this.loadCriteria(path.join(__dirname, '..', 'criteres_rgaa.xml'));
            return allCriteria.length;
        } catch (error) {
            console.error("Erreur lors du comptage des critères:", error);
            throw error;
        }
    }

    // Dans database.js, modifions la méthode deleteProject
    // Dans database.js, modifier la méthode deleteProject
    async deleteProject() {
        try {
            // 1. Supprimer les fichiers d'uploads
            const uploadPath = path.join(__dirname, '..', 'public', 'uploads', this.projectId);
            try {
                await fsPromises.rm(uploadPath, { recursive: true, force: true });
                console.log(`Dossier d'uploads supprimé: ${uploadPath}`);
            } catch (error) {
                console.warn(`Erreur lors de la suppression du dossier d'uploads: ${error.message}`);
            }

            // 2. Sauvegarder le chemin de la base de données
            const dbPath = path.join(__dirname, '..', 'database', `${this.projectId}.sqlite`);

            // 3. Fermer proprement la base de données
            await new Promise((resolve, reject) => {
                this.db.serialize(() => {
                    this.db.run('PRAGMA optimize');
                    this.db.run('VACUUM');
                    this.db.close((err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            });

            // 4. Créer un fichier temporaire
            const tempPath = dbPath + '.temp';
            try {
                await fsPromises.rename(dbPath, tempPath);
                await fsPromises.unlink(tempPath);
            } catch (error) {
                await fsPromises.unlink(dbPath);
            }

            return true;
        } catch (error) {
            console.error('Erreur lors de la suppression du projet:', error);
            throw error;
        }
    }

    // Helper pour vérifier si un projet existe


    // Fermeture de la connexion
    close() {
        this.db.close();
    }
}

module.exports = Database;