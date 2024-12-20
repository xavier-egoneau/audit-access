// Au début de app.js, modifiez les imports
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const twig = require('twig');
const multer = require('multer');
const dotenv = require('dotenv');
const Database = require('./models/database');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const fs = require('fs/promises');

// IA
const LearningService = require('./services/learningService');
const learningService = new LearningService();

// Configuration
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Ajout du middleware cookie-parser
app.use(cookieParser());
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de Twig
app.set('view engine', 'twig');
app.set('views', path.join(__dirname, 'views'));
app.set('twig options', {
  cache: false,
  debug: false
});

// Configuration de Multer pour l'upload des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId; // On utilise le projectId de l'URL
    const uploadPath = path.join(__dirname, 'public', 'uploads', projectId);
    require('fs').mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });



// Route pour afficher le formulaire de création de projet
app.get('/project/new', (req, res) => {
  res.render('audit/new-project', {
    title: 'Nouveau projet d\'audit'
  });
});

// Modification de la route principale
// Dans app.js, modifiez la route GET /audit/:projectId
app.get('/audit/:projectId', async (req, res) => {
  try {
      const projectId = req.params.projectId;
      const db = new Database(projectId);

      // Récupérer les pages du projet
      const pages = await new Promise((resolve, reject) => {
          db.db.all('SELECT * FROM pages ORDER BY created_at', [], (err, rows) => {
              if (err) {
                  reject(err);
                  return;
              }
              console.log("Pages récupérées:", rows);
              resolve(rows || []);
          });
      });

      // Récupérer les informations du projet
      const projectInfo = await new Promise((resolve, reject) => {
          db.db.get('SELECT * FROM project_info WHERE id = ?', [projectId], (err, row) => {
              if (err) reject(err);
              if (!row) {
                  reject(new Error("Projet non trouvé"));
              }
              resolve(row);
          });
      });

      // Si on arrive ici, le projet existe
      // Sauvegarder le projectId dans un cookie (expire dans 30 jours)
      res.cookie('lastProjectId', projectId, { 
          maxAge: 30 * 24 * 60 * 60 * 1000,
          httpOnly: true
      });

      // Charger les critères depuis le XML
      const criteria = await db.loadCriteria();
      console.log('Premier critère chargé:', criteria[0]);

      // Pour chaque critère, récupérer son statut et ses non-conformités
      for (const criterion of criteria) {
          if (!req.query.pageId) {
              // Pour "Tous les écrans", récupérer toutes les NC avec le nom des pages
              const ncs = await new Promise((resolve, reject) => {
                db.db.all(
                    `SELECT nc.*, GROUP_CONCAT(p.name) as page_names 
                     FROM non_conformities nc 
                     LEFT JOIN pages p ON EXISTS (
                         SELECT 1 
                         FROM json_each(nc.page_ids) 
                         WHERE value = CAST(p.id AS TEXT)
                     )
                     WHERE nc.criterion_id = ?
                     GROUP BY nc.id
                     ORDER BY nc.created_at DESC`,
                    [criterion.id],
                    (err, rows) => {
                        if (err) {
                            console.error('Erreur SQL:', err);
                            reject(err);
                            return;
                        }
                        
                        // Transformer les résultats pour inclure les page_ids comme tableau
                        const transformedRows = rows ? rows.map(row => ({
                            ...row,
                            page_ids: JSON.parse(row.page_ids || '[]'),
                            pages: row.page_names ? row.page_names.split(',') : []
                        })) : [];
                        
                        resolve(transformedRows);
                    }
                );
            });
              criterion.nonConformities = ncs;
          }
      }

      // Calculer les différents taux
      const currentRate = req.query.pageId ? await db.calculatePageRate(req.query.pageId) : 0;
      const averageRate = await db.calculateAverageRate() || 0; // Ajout du || 0
      const globalRate = await db.calculateGlobalRate() || 0;   // Ajout du || 0

      // Vérifier s'il reste des critères non testés
      const hasNT = criteria.some(c => c.status === 'NT');

      // Récupérer les statuts des critères
      const statuses = await db.getCriteriaStatuses(req.query.pageId);

      // Pour chaque critère, ajouter son statut
      for (const criterion of criteria) {
          criterion.status = statuses[criterion.id] || 'NT';
          criterion.hasDifferentStatuses = statuses[criterion.id] === 'MULTIPLE';
      }

      const totalCriteria = await db.getTotalCriteria();

      db.close();

      res.render('audit', {
        currentProject: projectInfo,
        currentProjectId: projectId,
        pages: pages || [], // Assurez-vous que pages est toujours un tableau
        criteria: criteria,
        currentPage: req.query.pageId ? pages.find(p => p.id === parseInt(req.query.pageId)) : null,
        currentRate: currentRate,
        averageRate: averageRate,
        globalRate: globalRate,
        hasNT: hasNT,
        title: `Audit - ${projectInfo.name}`,
        totalCriteria: totalCriteria
    });

  } catch (error) {
      console.error(error);
      res.status(500).render('error', { 
          message: 'Erreur lors du chargement de l\'audit',
          error: process.env.NODE_ENV === 'development' ? error : {}
      });
  }
});


// Dans app.js, ajoutez cette nouvelle route
app.get('/audit/:projectId/restitution', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const db = new Database(projectId);

        // Récupérer les informations du projet
        const projectInfo = await new Promise((resolve, reject) => {
            db.db.get('SELECT * FROM project_info WHERE id = ?', [projectId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        // Vérifier les critères non testés
        const statusStats = await new Promise((resolve, reject) => {
            db.db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM audit_results), 1) as percentage
                FROM audit_results 
                GROUP BY status
            `, [], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        // Vérifier s'il y a des critères NT
        const hasNonTestedCriteria = statusStats.some(stat => stat.status === 'NT');

        // Récupérer les pages avec leurs taux
        const pages = await new Promise((resolve, reject) => {
            db.db.all('SELECT * FROM pages', [], async (err, pages) => {
                if (err) reject(err);
                
                // Calculer le taux pour chaque page
                const pagesWithRates = await Promise.all(pages.map(async page => {
                    const rate = await db.calculatePageRate(page.id);
                    return { ...page, rate };
                }));
                
                resolve(pagesWithRates);
            });
        });

        // Identifier les Quick Wins
        const quickwins = await new Promise((resolve, reject) => {
            db.db.all(`
                WITH CriteriaStatus AS (
                    -- Statuts par critère et par page
                    SELECT 
                        ar.criterion_id,
                        p.name as page_name,
                        ar.status,
                        p.id as page_id
                    FROM audit_results ar
                    JOIN pages p ON p.id = ar.page_id
                ),
                CommonNCs AS (
                    -- Regrouper les NC communes
                    SELECT 
                        nc.criterion_id,
                        nc.impact,
                        nc.description,
                        nc.solution,
                        GROUP_CONCAT(DISTINCT p.name) as affected_pages,
                        COUNT(DISTINCT p.id) as page_count
                    FROM non_conformities nc
                    JOIN json_each(nc.page_ids) pages ON 1=1
                    JOIN pages p ON p.id = pages.value
                    GROUP BY nc.criterion_id, nc.impact, nc.description, nc.solution
                    HAVING page_count > 1
                )
                SELECT 
                    cs.criterion_id,
                    GROUP_CONCAT(DISTINCT CASE WHEN cs.status = 'C' THEN cs.page_name END) as conform_pages,
                    GROUP_CONCAT(DISTINCT CASE WHEN cs.status = 'NC' THEN cs.page_name END) as non_conform_pages,
                    cn.impact as common_impact,
                    cn.description as common_description,
                    cn.solution as common_solution,
                    cn.affected_pages
                FROM CriteriaStatus cs
                LEFT JOIN CommonNCs cn ON cs.criterion_id = cn.criterion_id
                GROUP BY cs.criterion_id
                HAVING 
                    -- Soit le critère est C sur certaines pages et NC sur d'autres
                    (conform_pages IS NOT NULL AND non_conform_pages IS NOT NULL)
                    -- Soit il y a une NC commune à plusieurs pages
                    OR cn.affected_pages IS NOT NULL
            `, [], (err, results) => {
                if (err) reject(err);
        
                const quickwins = results.map(result => ({
                    criterion: result.criterion_id,
                    conformPages: result.conform_pages ? result.conform_pages.split(',') : [],
                    nonConformPages: result.non_conform_pages ? result.non_conform_pages.split(',') : [],
                    commonImpact: result.common_impact,
                    commonDescription: result.common_description,
                    commonSolution: result.common_solution,
                    affectedPages: result.affected_pages ? result.affected_pages.split(',') : [],
                    type: result.conform_pages && result.non_conform_pages ? 'mixed' : 'common'
                }));
        
                resolve(quickwins);
            });
        });

        // Ajouter la récupération de toutes les NC
        const allNonConformities = await new Promise((resolve, reject) => {
            db.db.all(`
                SELECT 
                    nc.criterion_id,
                    nc.impact,
                    nc.description,
                    nc.solution,
                    GROUP_CONCAT(DISTINCT p.name) as affected_pages
                FROM non_conformities nc
                JOIN json_each(nc.page_ids) pages ON 1=1
                JOIN pages p ON p.id = pages.value
                GROUP BY nc.criterion_id, nc.impact, nc.description, nc.solution
                ORDER BY nc.criterion_id
            `, [], (err, results) => {
                if (err) reject(err);
                resolve(results.map(result => ({
                    ...result,
                    affected_pages: result.affected_pages.split(',')
                })));
            });
        });

        // Récupérer toutes les NC pour chaque page
        for (const page of pages) {
            page.nonConformities = await new Promise((resolve, reject) => {
                db.db.all(`
                    SELECT * FROM non_conformities 
                    WHERE json_extract(page_ids, '$') LIKE '%' || ? || '%'
                    ORDER BY criterion_id
                `, [page.id], (err, ncs) => {
                    if (err) reject(err);
                    resolve(ncs);
                });
            });
        }

        const globalRate = await db.calculateGlobalRate();

        db.close();

        // Après la récupération des autres données, ajoutez :
    

        // Modifiez le res.render pour inclure statusStats
        res.render('audit/restitution', {
            currentProject: projectInfo,
            pages: pages,
            quickwins: quickwins,
            globalRate: globalRate,
            allNonConformities: allNonConformities,
            hasNonTestedCriteria: hasNonTestedCriteria,
            statusStats: statusStats
        });

    } catch (error) {
        console.error('Erreur lors de la génération du rapport:', error);
        res.status(500).render('error', {
            message: 'Erreur lors de la génération du rapport',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Dans la route principale '/', modifiez pour gérer le paramètre error
// Dans app.js, modifiez la route racine
app.get('/', async (req, res) => {
  try {
      // Vérifier si le dossier database existe
      const dbDir = path.join(__dirname, 'database');
      try {
          await fs.access(dbDir);
      } catch {
          await fs.mkdir(dbDir, { recursive: true });
      }

      // Liste des projets
      const projects = [];
      
      try {
          const files = await fs.readdir(dbDir);
          for (const file of files) {
              if (file.endsWith('.sqlite')) {
                  const projectId = file.replace('.sqlite', '');
                  try {
                      const db = new Database(projectId);
                      const projectInfo = await new Promise((resolve, reject) => {
                          db.db.get('SELECT * FROM project_info', [], (err, row) => {
                              if (err) reject(err);
                              resolve(row);
                          });
                      });
                      if (projectInfo) {
                          projects.push(projectInfo);
                      }
                      db.close();
                  } catch (err) {
                      console.error(`Erreur lors de la lecture du projet ${projectId}:`, err);
                  }
              }
          }
      } catch (err) {
          console.warn('Aucun projet trouvé:', err);
      }

      // Rendu de la page de sélection de projet
      res.render('audit/select-project', {
          projects: projects,
          showModal: projects.length === 0 // Afficher la modal si aucun projet n'existe
      });

  } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
      res.status(500).render('error', { 
          message: 'Erreur lors du chargement des projets',
          error: process.env.NODE_ENV === 'development' ? error : {}
      });
  }
});

app.get('/nc-template', (req, res) => {
  const data = JSON.parse(req.query.data);
  res.render('partials/_nc-template', {
      nc: {
        id: data.id,  // Assurez-vous que c'est bien transmis
        impact: data.impact,
        description: data.description,
        solution: data.solution,
        screenshot_path: data.screenshot_path,
        pages: data.pages,
        allPages: data.allPages
      }
  });
});


// Dans la route GET /audit/:projectId/criterion/:criterionId/allnc

app.get('/audit/:projectId/criterion/:criterionId/allnc', async (req, res) => {
    const { projectId, criterionId } = req.params;
    const { pageId } = req.query;

    try {
        const db = new Database(projectId);
        
        // Debug
        console.log("Recherche des NC pour - critère:", criterionId, "page:", pageId);

        const query = `
            SELECT nc.*, GROUP_CONCAT(p.name) as page_names
            FROM non_conformities nc
            LEFT JOIN pages p ON JSON_VALID(nc.page_ids) AND 
                json_extract(nc.page_ids, '$') LIKE '%' || p.id || '%'
            WHERE nc.criterion_id = ?
            AND (
                ? IS NULL 
                OR JSON_VALID(nc.page_ids) 
                AND json_extract(nc.page_ids, '$') LIKE '%' || ? || '%'
            )
            GROUP BY nc.id
        `;

        
        const ncs = await new Promise((resolve, reject) => {
            db.db.all(query, [criterionId, pageId, pageId], (err, rows) => {
                if (err) {
                    console.error('Erreur SQL:', err);
                    reject(err);
                    return;
                }
                
                // Debug
                console.log("Résultats bruts:", rows);
                
                // Transformer les données
                if (rows) {
                    rows = rows.map(row => {
                        const pageIdsArray = JSON.parse(row.page_ids || '[]');
                        console.log("Page IDs pour NC", row.id, ":", pageIdsArray);
                        return {
                            id: row.id,  // Assurez-vous que l'ID est bien passé
                            criterion_id: row.criterion_id,
                            impact: row.impact,
                            description: row.description,
                            solution: row.solution,
                            screenshot_path: row.screenshot_path,
                            page_ids: JSON.parse(row.page_ids || '[]'),
                            pages: row.page_names ? row.page_names.split(',') : [],
                            allPages: !row.page_ids || JSON.parse(row.page_ids || '[]').length === 0
                        };
                    });
                }
                
                // Debug
                console.log("Résultats transformés:", rows);
                
                resolve(rows || []);
            });
        });

        db.close();
        res.json({ success: true, ncs });
    } catch (error) {
        console.error('Erreur serveur:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message
        });
    }
});

// Dans app.js
app.post('/audit/:projectId/nc/:ncId/edit', upload.single('screenshot'), async (req, res) => {
    const { projectId, ncId } = req.params;
    const { impact, description, solution } = req.body;

    try {
        const db = new Database(projectId);
        
        // Construire l'objet de mise à jour
        const updateData = {
            impact,
            description,
            solution
        };

        // Si une nouvelle image est fournie
        if (req.file) {
            updateData.screenshot_path = `/uploads/${projectId}/${req.file.filename}`;
        }

        // Mettre à jour la NC
        await new Promise((resolve, reject) => {
            const fields = Object.keys(updateData);
            const values = Object.values(updateData);
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            
            db.db.run(
                `UPDATE non_conformities 
                 SET ${setClause}
                 WHERE id = ?`,
                [...values, ncId],
                function(err) {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dans app.js, modifiez la route POST /audit/new :
app.post('/audit/new', async (req, res) => {
    try {
        console.log("Données reçues:", req.body);
        
        // Vérification du nom du projet
        if (!req.body.name || req.body.name.trim() === '') {
            throw new Error('Le nom du projet est requis');
        }
  
        const projectId = uuidv4();
        console.log("Création du projet:", projectId);
  
        const db = new Database(projectId);
  
        // Créer le projet
        await new Promise((resolve, reject) => {
            db.db.run(
                `INSERT INTO project_info (
                    id, 
                    name, 
                    url,
                    referential, 
                    referential_version,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [
                    projectId,
                    req.body.name,
                    req.body.url || '',
                    req.body.referential || 'RGAA',
                    req.body.referentialVersion || '4.1'
                ],
                function(err) {
                    if (err) reject(err);
                    console.log("Projet créé dans la base");
                    resolve();
                }
            );
        });
  
        // Créer les pages
        if (req.body.screens && Array.isArray(req.body.screens)) {
            await Promise.all(req.body.screens.map(screen => {
                return new Promise((resolve, reject) => {
                    db.db.run(
                        'INSERT INTO pages (name, created_at) VALUES (?, datetime("now"))',
                        [screen],
                        (err) => {
                            if (err) reject(err);
                            resolve();
                        }
                    );
                });
            }));
        }
  
        db.close();
        res.json({ 
            success: true, 
            projectId
        });
    } catch (error) {
        console.error("Erreur lors de la création du projet:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Erreur lors de la création du projet'
        });
    }
  });

// Route pour mettre à jour le statut d'un critère
app.post('/audit/:projectId/criterion/:criterionId', async (req, res) => {
  const { projectId, criterionId } = req.params;
  const { status, pageId, allPages } = req.body;

  try {
    const db = new Database(projectId);
    
    if (allPages) {
      // Récupérer toutes les pages
      const pages = await new Promise((resolve, reject) => {
        db.db.all('SELECT id FROM pages', [], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });

      // Utiliser une transaction pour s'assurer de l'atomicité des opérations
      await new Promise((resolve, reject) => {
        db.db.run('BEGIN TRANSACTION', async (err) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            // D'abord supprimer les anciens résultats pour ce critère
            await new Promise((resolve, reject) => {
              db.db.run(
                'DELETE FROM audit_results WHERE criterion_id = ?',
                [criterionId],
                (err) => {
                  if (err) reject(err);
                  resolve();
                }
              );
            });

            // Ensuite insérer les nouveaux résultats
            for (const page of pages) {
              await new Promise((resolve, reject) => {
                db.db.run(
                  `INSERT INTO audit_results (page_id, criterion_id, status) 
                   VALUES (?, ?, ?)`,
                  [page.id, criterionId, status],
                  (err) => {
                    if (err) reject(err);
                    resolve();
                  }
                );
              });
            }

            db.db.run('COMMIT', (err) => {
              if (err) reject(err);
              resolve();
            });
          } catch (error) {
            db.db.run('ROLLBACK');
            reject(error);
          }
        });
      });
    } else {
      // Mise à jour pour une seule page
      await new Promise((resolve, reject) => {
        db.db.run(
          `INSERT OR REPLACE INTO audit_results (page_id, criterion_id, status) 
           VALUES (?, ?, ?)`,
          [pageId, criterionId, status],
          function(err) {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }

    // Recalculer les taux
    const currentRate = pageId ? await db.calculatePageRate(pageId) : 0;
    const averageRate = await db.calculateAverageRate();
    const globalRate = await db.calculateGlobalRate();

    db.close();

    res.json({
      success: true,
      rates: {
        currentRate,
        averageRate,
        globalRate
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modification partielle - Route pour ajouter une non-conformité

app.post('/audit/:projectId/nc', upload.single('screenshot'), async (req, res) => {
    const { projectId } = req.params;
    const { criterionId, pageId, impact, description, solution, allPages } = req.body;

    try {
        const db = new Database(projectId);
        let pageIds = [];

        // Apprentissage IA à partir de la nouvelle NC
        // Apprentissage avec contexte
        await learningService.learnFromNC({
            criterionId,
            impact,
            description,
            solution,
            projectId: req.params.projectId
        }, {
            currentPage: req.body.pageId,
            timestamp: new Date(),
            // Autres informations contextuelles pertinentes
        });

        if (allPages === 'true') {
            // Récupérer toutes les pages
            const pages = await new Promise((resolve, reject) => {
                db.db.all('SELECT id FROM pages', [], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            });
            pageIds = pages.map(page => page.id);
        } else {
            pageIds = [pageId];
        }

        const screenshotPath = req.file ? `/uploads/${projectId}/${req.file.filename}` : null;

        // Insérer une seule NC avec le tableau des page_ids
        const newNcId = await new Promise((resolve, reject) => {
            db.db.run(
                `INSERT INTO non_conformities 
                 (criterion_id, impact, description, screenshot_path, solution, page_ids) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    criterionId,
                    impact,
                    description,
                    screenshotPath,
                    solution,
                    JSON.stringify(pageIds)
                ],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });

        // Récupérer les noms des pages pour l'affichage
        const pageNames = await new Promise((resolve, reject) => {
            db.db.all(
                'SELECT id, name FROM pages WHERE id IN (' + pageIds.join(',') + ')',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        db.close();

        res.json({ 
            success: true,
            ncId: newNcId,    // Assurez-vous que cet ID est bien envoyé
            id: newNcId,      // Ajoutez également l'ID sous cette forme
            impact,
            description,
            solution,
            screenshot_path: screenshotPath,
            pages: pageNames,
            allPages: allPages === 'true'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

//IA
// Routes pour tester l'apprentissage
// Routes pour l'apprentissage
app.get('/api/learning/suggestions/:criterionId', async (req, res) => {
    const { criterionId } = req.params;
    const context = req.query.context ? JSON.parse(req.query.context) : {};

    try {
        const suggestions = await learningService.getSuggestions(criterionId, context);
        res.json({
            success: true,
            suggestions: suggestions || []
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des suggestions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/learning/metrics/:criterionId?', async (req, res) => {
    try {
        const metrics = await learningService.getMetrics(req.params.criterionId);
        res.json({
            success: true,
            metrics: metrics || []
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des métriques:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { suggestionId, isHelpful, comment, criterionId } = req.body;
    
    try {
        await learningService.recordFeedback(suggestionId, {
            isHelpful,
            comment,
            projectId: req.params.projectId,
            criterionId,
            userContext: {
                timestamp: new Date(),
                projectId: req.params.projectId
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du feedback:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

//iA
app.get('/api/suggestions/:criterionId', async (req, res) => {
    try {
        const suggestions = await learningService.suggestFromContext(
            req.params.criterionId,
            req.query.context
        );
        res.json({ success: true, suggestions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route pour créer un nouveau projet
app.post('/audit/new', async (req, res) => {
    try {
        console.log("Données reçues:", req.body);
        
        // Vérification du nom du projet
        if (!req.body.name || req.body.name.trim() === '') {
            throw new Error('Le nom du projet est requis');
        }
  
        const projectId = uuidv4();
        console.log("Création du projet:", projectId);
  
        const db = new Database(projectId);

        // Créer le projet avec tous les champs requis
        await new Promise((resolve, reject) => {
            db.db.run(
                `INSERT INTO project_info (
                    id, 
                    name, 
                    url,
                    referential, 
                    referential_version,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [
                    projectId,
                    req.body.name,
                    req.body.url || '',  // URL optionnelle
                    'RGAA',              // Valeur par défaut
                    '4.1',               // Version par défaut
                ],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Créer les pages
        if (req.body.screens && req.body.screens.length > 0) {
            await Promise.all(req.body.screens.map(screen => {
                return new Promise((resolve, reject) => {
                    db.db.run(
                        'INSERT INTO pages (name, created_at) VALUES (?, datetime("now"))',
                        [screen],
                        (err) => {
                            if (err) reject(err);
                            resolve();
                        }
                    );
                });
            }));
        }

        db.close();
            res.json({ 
                success: true, 
                projectId,  // Ajouter le projectId dans la réponse
                message: 'Projet créé avec succès'
            });
        } catch (error) {
            console.error("Erreur lors de la création du projet:", error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Erreur lors de la création du projet'
            });
        }
    });
// Route pour créer une nouvelle page
app.post('/project/:id/page/new', async (req, res) => {
  try {
    const projectId = req.params.id;
    const db = new Database(projectId);

    // Insérer la nouvelle page
    await new Promise((resolve, reject) => {
      db.db.run(
        'INSERT INTO pages (name, url) VALUES (?, ?)',
        [req.body.name, req.body.url],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    db.close();
    res.redirect(`/project/${projectId}`);
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: 'Erreur lors de la création de la page' });
  }
});


// Modification partielle - Route d'édition

app.post('/audit/:projectId/edit', async (req, res) => {
    console.log('Headers reçus:', req.headers);
    console.log('Body brut:', req.body);
    
    try {
        const projectId = req.params.projectId;
        
        // Validation des données reçues
        const { name, url, referential, referentialVersion, screens } = req.body;
        
        if (!name || name.trim() === '') {
            console.log('Nom manquant dans:', req.body);
            return res.status(400).json({
                success: false,
                message: 'Le nom du projet est requis'
            });
        }

        const db = new Database(projectId);

        try {
            await db.db.run('BEGIN TRANSACTION');

            // Mise à jour des informations du projet
            await new Promise((resolve, reject) => {
                const query = `UPDATE project_info 
                             SET name = ?, url = ?, referential = ?, referential_version = ?
                             WHERE id = ?`;
                
                const params = [
                    name.trim(),
                    url || '',
                    referential || 'RGAA',
                    referentialVersion || '4.1',
                    projectId
                ];

                console.log('Exécution de la requête:', query, params);
                
                db.db.run(query, params, function(err) {
                    if (err) {
                        console.error('Erreur SQL:', err);
                        reject(err);
                        return;
                    }
                    console.log('Projet mis à jour, changes:', this.changes);
                    resolve();
                });
            });

            // Gestion des pages
            if (Array.isArray(screens)) {
                // Supprimer toutes les anciennes pages
                await new Promise((resolve, reject) => {
                    db.db.run('DELETE FROM pages', [], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });

                // Ajouter les nouvelles pages
                for (const screenName of screens) {
                    await new Promise((resolve, reject) => {
                        db.db.run(
                            'INSERT INTO pages (name, created_at) VALUES (?, datetime("now"))',
                            [screenName],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });
                }
            }

            await db.db.run('COMMIT');
            
            res.json({
                success: true,
                message: "Projet mis à jour avec succès"
            });

        } catch (error) {
            console.error('Erreur lors de la transaction:', error);
            await db.db.run('ROLLBACK');
            throw error;
        } finally {
            db.close();
        }

    } catch (error) {
        console.error('Erreur complète:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur lors de la mise à jour du projet'
        });
    }
});

// Route pour supprimer une non-conformité
app.delete('/audit/:projectId/nc/:ncId', async (req, res) => {
  const { projectId, ncId } = req.params;

  try {
      const db = new Database(projectId);

      // Récupérer le chemin de l'image avant la suppression
      const nc = await new Promise((resolve, reject) => {
          db.db.get('SELECT screenshot_path FROM non_conformities WHERE id = ?', [ncId], (err, row) => {
              if (err) reject(err);
              resolve(row);
          });
      });

      // Supprimer l'entrée de la base de données
      await new Promise((resolve, reject) => {
          db.db.run('DELETE FROM non_conformities WHERE id = ?', [ncId], (err) => {
              if (err) reject(err);
              resolve();
          });
      });

      // Si une image était associée, la supprimer
      if (nc && nc.screenshot_path) {
          const imagePath = path.join(__dirname, 'public', nc.screenshot_path);
          try {
              await fs.unlink(imagePath);
          } catch (error) {
              console.warn('Erreur lors de la suppression de l\'image:', error);
              // On continue même si la suppression de l'image échoue
          }
      }

      db.close();

      res.json({
          success: true,
          message: 'Non-conformité supprimée avec succès'
      });
  } catch (error) {
      console.error('Erreur lors de la suppression de la NC:', error);
      res.status(500).json({
          success: false,
          message: 'Erreur lors de la suppression de la non-conformité'
      });
  }
});



// Route pour supprimer un projet
// Dans app.js, dans la route DELETE /audit/:projectId
// Dans app.js, modifiez la route DELETE /audit/:projectId
app.delete('/audit/:projectId', async (req, res) => {
  try {
      const projectId = req.params.projectId;
      
      // Vérifier si le projet existe avant la suppression
      const exists = await Database.projectExists(projectId);
      if (!exists) {
          return res.status(404).json({
              success: false,
              message: 'Projet non trouvé'
          });
      }

      // Créer une nouvelle instance de Database
      let db = new Database(projectId);
      
      try {
          await db.deleteProject();
          
          // Supprimer le cookie si c'était le dernier projet consulté
          if (req.cookies.lastProjectId === projectId) {
              res.clearCookie('lastProjectId');
          }

          res.json({
              success: true,
              message: 'Projet supprimé avec succès'
          });
      } catch (error) {
          console.error('Première tentative de suppression échouée:', error);
          // Attendre un peu et réessayer une fois
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
              db = new Database(projectId);
              await db.deleteProject();
              res.json({
                  success: true,
                  message: 'Projet supprimé avec succès'
              });
          } catch (retryError) {
              throw retryError;
          }
      }

  } catch (error) {
      console.error('Erreur lors de la suppression du projet:', error);
      res.status(500).json({
          success: false,
          message: 'Erreur lors de la suppression du projet: ' + error.message
      });
  }
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Une erreur est survenue',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Démarrage du serveur
app.listen(port, async () => {
    console.log(`Application démarrée sur http://localhost:${port}`);
});

module.exports = app;