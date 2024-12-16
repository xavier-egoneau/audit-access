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




    async analyzeXMLError(xmlData, errorLine, errorColumn, context = 50) {
        console.log('\n=== Analyse détaillée de l\'erreur XML ===');
        
        // Diviser le XML en lignes
        const lines = xmlData.split('\n');
        
        // Afficher les lignes autour de l'erreur
        console.log('\nContexte de l\'erreur :');
        for (let i = Math.max(0, errorLine - 3); i <= Math.min(lines.length - 1, errorLine + 1); i++) {
            const lineNum = i + 1;
            const line = lines[i];
            
            if (lineNum === errorLine) {
                console.log(`>>> ${lineNum}: ${line}`);
                // Marquer la position exacte de l'erreur
                const marker = ' '.repeat(errorColumn + 4) + '^';
                console.log(marker);
                
                // Analyser la structure des balises dans cette ligne
                const tags = line.match(/<\/?[^>]+>/g) || [];
                console.log('\nBalises trouvées dans la ligne d\'erreur :');
                tags.forEach((tag, index) => {
                    console.log(`  ${index + 1}: ${tag}`);
                });
    
                // Vérifier les balises ouvrantes/fermantes
                const stack = [];
                let col = 0;
                for (const tag of tags) {
                    col = line.indexOf(tag, col);
                    if (tag.startsWith('</')) {
                        // Balise fermante
                        const tagName = tag.match(/<\/([^>]+)>/)[1];
                        const lastOpen = stack.pop();
                        if (!lastOpen) {
                            console.log(`\n⚠️ ERREUR: Balise fermante ${tagName} sans balise ouvrante correspondante à la colonne ${col}`);
                        } else if (lastOpen !== tagName) {
                            console.log(`\n⚠️ ERREUR: Balise fermante ${tagName} ne correspond pas à la dernière balise ouverte ${lastOpen} à la colonne ${col}`);
                        }
                    } else if (!tag.endsWith('/>')) {
                        // Balise ouvrante
                        const tagName = tag.match(/<([^>\s]+)/)[1];
                        stack.push(tagName);
                    }
                    col += tag.length;
                }
                
                if (stack.length > 0) {
                    console.log(`\n⚠️ Balises non fermées : ${stack.join(', ')}`);
                }
            } else {
                console.log(`   ${lineNum}: ${line}`);
            }
        }
        
        console.log('\n=== Fin de l\'analyse détaillée ===\n');
    }

    // Méthode pour charger les critères depuis le XML
    // Dans database.js, remplacer la méthode loadCriteria par celle-ci :
    async loadCriteria(referentialPath) {
        try {
            console.log('Début du chargement des critères');
            
            // Déterminer le bon fichier XML selon le référentiel
            const projectInfo = await new Promise((resolve, reject) => {
                this.db.get('SELECT referential FROM project_info WHERE id = ?', [this.projectId], (err, row) => {
                    if (err) {
                        console.error('Erreur lors de la récupération du référentiel:', err);
                        reject(err);
                    }
                    if (!row) {
                        console.error('Aucune information de projet trouvée pour l\'ID:', this.projectId);
                        reject(new Error('Projet non trouvé'));
                    }
                    console.log('Référentiel trouvé:', row.referential);
                    resolve(row);
                });
            });

            // Choisir le fichier XML approprié
            const xmlFile = projectInfo.referential === 'WCAG' ? 'criteres_wcag.xml' : 
                        projectInfo.referential === 'RAAM' ? 'criteres_raam.xml' : 
                        'criteres_rgaa.xml';
            const xmlPath = path.join(__dirname, '..', xmlFile);
            console.log('Chemin du fichier XML:', xmlPath);

            // Vérifier l'existence du fichier
            try {
                await fsPromises.access(xmlPath);
                console.log('Fichier XML trouvé');
            } catch (error) {
                console.error('Fichier XML non trouvé:', error);
                throw new Error(`Fichier ${xmlFile} non trouvé`);
            }

            const xmlData = await fsPromises.readFile(xmlPath, 'utf8');
            console.log('Fichier XML lu, taille:', xmlData.length, 'caractères');
            console.log('Début du fichier XML:', xmlData.substring(0, 200)); // Afficher le début du XML
            
            // validation XML détaillée
       
            //await this.analyzeXMLError(xmlData, 3679, 8);

            const parser = new xml2js.Parser();
            console.log('Parser XML créé');

            const result = await new Promise((resolve, reject) => {
                parser.parseString(xmlData, (err, result) => {
                    if (err) {
                        console.error('Erreur lors du parsing XML:', err);
                        reject(err);
                    } else {
                        console.log('Structure du résultat:', Object.keys(result));
                        if (!result.AUDIT) {
                            console.error('Structure XML invalide - pas de nœud AUDIT');
                            reject(new Error('Structure XML invalide'));
                        }
                        resolve(result);
                    }
                });
            });

            // Récupérer la version
            const version = result.AUDIT.$.version;
            console.log('Version du référentiel:', version);
            
            let criteres = [];

            // Format unifié pour tous les référentiels
            try {
                result.AUDIT.section.forEach((section, sIndex) => {
                    console.log(`Traitement de la section ${sIndex + 1}/${result.AUDIT.section.length}`);
                    
                    section.sousSection.forEach((sousSection, ssIndex) => {
                        console.log(`  Traitement de la sous-section ${ssIndex + 1}/${section.sousSection.length}`);
                        
                        sousSection.Critere.forEach((critere, cIndex) => {
                            console.log(`    Traitement du critère ${critere.$.id}`);
                            try {
                                criteres.push({
                                    id: critere.$.id,
                                    titre: this.encodeHtml(critere.titre[0]),
                                    niveauWCAG: critere.NiveauWCAG[0],
                                    methodologie: critere.Methodologie[0].Etape.map(e => this.encodeHtml(e)),
                                    notes: critere.Notes ? this.encodeHtml(critere.Notes[0]) : '',
                                    casParticuliers: critere.CasParticuliers ? this.encodeHtml(critere.CasParticuliers[0]) : ''
                                });
                            } catch (error) {
                                console.error(`Erreur lors du traitement du critère ${critere.$.id}:`, error);
                                console.log('Structure du critère problématique:', JSON.stringify(critere, null, 2));
                            }
                        });
                    });
                });
            } catch (error) {
                console.error('Erreur lors du traitement des sections:', error);
                throw error;
            }

            console.log(`Nombre total de critères chargés: ${criteres.length}`);

            // Mettre à jour la version dans la base de données
            await this.updateReferentialVersion(version);

            return criteres;

        } catch (error) {
            console.error('Erreur lors du chargement des critères:', error);
            console.error('Stack trace:', error.stack);
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
                        const allCriteria = await this.loadCriteria(path.join(__dirname, '..', 'criteres_raam.xml'));
                        
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
                this.loadCriteria(path.join(__dirname, '..', 'criteres_raam.xml')),
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
            const allCriteria = await this.loadCriteria(path.join(__dirname, '..', 'criteres_raam.xml'));
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