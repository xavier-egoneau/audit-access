// tests/unit/models/database.test.js
const Database = require('../../../models/database');
const path = require('path');
const { cleanTestDatabases } = require('../../utils');

describe('Database', () => {
    let db;
    const testProjectId = 'test-project-123';

    beforeAll(async () => {
        await cleanTestDatabases();
    });

    beforeEach(async () => {
        db = new Database(testProjectId);
        // Création d'un projet test avec les informations nécessaires
        await new Promise((resolve) => {
            db.db.run(
                `INSERT INTO project_info (id, name, url, referential) 
                 VALUES (?, ?, ?, ?)`,
                [testProjectId, 'Test Project', 'http://test.com', 'RGAA'],
                resolve
            );
        });
    });

    afterEach(async () => {
        await db.close();
    });

    afterAll(async () => {
        await cleanTestDatabases();
    });

    describe('Initialization', () => {
        it('should create all required tables', async () => {
            const tables = ['project_info', 'pages', 'audit_results', 'non_conformities'];
            
            for (const table of tables) {
                const result = await new Promise((resolve) => {
                    db.db.get(
                        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                        [table],
                        (err, row) => resolve(row)
                    );
                });
                expect(result).toBeTruthy();
                expect(result.name).toBe(table);
            }
        });
    });

    describe('Pages Management', () => {
        it('should create and retrieve pages', async () => {
            // Création d'une page
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO pages (name, url) VALUES (?, ?)',
                    ['HomePage', 'http://test.com/home'],
                    resolve
                );
            });

            // Récupération de la page
            const page = await new Promise((resolve) => {
                db.db.get('SELECT * FROM pages WHERE name = ?', ['HomePage'], (err, row) => resolve(row));
            });

            expect(page).toBeTruthy();
            expect(page.name).toBe('HomePage');
            expect(page.url).toBe('http://test.com/home');
        });

        it('should delete pages', async () => {
            // Création puis suppression d'une page
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO pages (name) VALUES (?)',
                    ['PageToDelete'],
                    resolve
                );
            });

            await new Promise((resolve) => {
                db.db.run('DELETE FROM pages WHERE name = ?', ['PageToDelete'], resolve);
            });

            const page = await new Promise((resolve) => {
                db.db.get('SELECT * FROM pages WHERE name = ?', ['PageToDelete'], (err, row) => resolve(row));
            });

            expect(page).toBeUndefined();
        });
    });

    // tests/unit/models/database.test.js
    describe('Audit Results', () => {
        beforeEach(async () => {
            // Créer une page de test
            await new Promise((resolve) => {
                db.db.run('INSERT INTO pages (id, name) VALUES (?, ?)', [1, 'TestPage'], resolve);
            });

            // Créer un enregistrement dans project_info avec le référentiel
            await new Promise((resolve) => {
                db.db.run(
                    `INSERT OR REPLACE INTO project_info (id, name, url, referential) 
                    VALUES (?, ?, ?, ?)`,
                    [testProjectId, 'Test Project', 'http://test.com', 'RGAA'],
                    resolve
                );
            });
        });

        it('should calculate page rate correctly', async () => {
            const pageId = 1;
            const criteria = ['1.1.1', '1.1.2', '1.1.3', '1.1.4'];
            
            // Insérer des résultats mélangés
            await Promise.all(criteria.map(criterionId => {
                return new Promise((resolve) => {
                    db.db.run(
                        'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?)',
                        [pageId, criterionId, criterionId === '1.1.1' ? 'C' : 'NA'],
                        resolve
                    );
                });
            }));

            // Ajouter un critère 'NC' pour avoir un mix de statuts
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?)',
                    [pageId, '1.1.5', 'NC'],
                    resolve
                );
            });

            const rate = await db.calculatePageRate(pageId);
            // Sur 5 critères : 1 C, 3 NA, 1 NC
            // Taux = (1 conforme / (5 total - 3 NA)) * 100 = 50%
            expect(rate).toBe(50);
        });
    });

    describe('Non-Conformities', () => {
        let pageId;
        const criterionId = '1.1.1';

        beforeEach(async () => {
            // Créer une page pour les tests
            await new Promise((resolve) => {
                db.db.run('INSERT INTO pages (name) VALUES (?)', ['TestPage'], function(err) {
                    pageId = this.lastID;
                    resolve();
                });
            });
        });

        it('should create and retrieve non-conformities', async () => {
            const ncData = {
                impact: 'Majeur',
                description: 'Test NC',
                solution: 'Test solution',
                page_ids: JSON.stringify([pageId])
            };

            // Créer une NC
            const ncId = await new Promise((resolve) => {
                db.db.run(
                    `INSERT INTO non_conformities 
                     (criterion_id, impact, description, solution, page_ids) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [criterionId, ncData.impact, ncData.description, ncData.solution, ncData.page_ids],
                    function(err) {
                        resolve(this.lastID);
                    }
                );
            });

            // Récupérer la NC
            const nc = await new Promise((resolve) => {
                db.db.get('SELECT * FROM non_conformities WHERE id = ?', [ncId], (err, row) => resolve(row));
            });

            expect(nc).toBeTruthy();
            expect(nc.impact).toBe(ncData.impact);
            expect(nc.description).toBe(ncData.description);
            expect(nc.solution).toBe(ncData.solution);
            expect(JSON.parse(nc.page_ids)).toContain(pageId);
        });

        it('should delete non-conformities', async () => {
            // Créer puis supprimer une NC
            const ncId = await new Promise((resolve) => {
                db.db.run(
                    `INSERT INTO non_conformities (criterion_id, description) 
                     VALUES (?, ?)`,
                    [criterionId, 'To Delete'],
                    function(err) {
                        resolve(this.lastID);
                    }
                );
            });

            await new Promise((resolve) => {
                db.db.run('DELETE FROM non_conformities WHERE id = ?', [ncId], resolve);
            });

            const nc = await new Promise((resolve) => {
                db.db.get('SELECT * FROM non_conformities WHERE id = ?', [ncId], (err, row) => resolve(row));
            });

            expect(nc).toBeUndefined();
        });
    });
});