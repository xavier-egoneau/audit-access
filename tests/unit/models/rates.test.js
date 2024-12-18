const Database = require('../../../models/database');
const path = require('path');
const { cleanTestDatabases } = require('../../utils');

describe('Rates Calculations', () => {
    let db;
    const testProjectId = 'test-rates-123';

    beforeAll(async () => {
        await cleanTestDatabases();
    });

    beforeEach(async () => {
        db = new Database(testProjectId);
        // Création d'un projet test
        await new Promise((resolve) => {
            db.db.run(
                `INSERT INTO project_info (id, name, url, referential) 
                 VALUES (?, ?, ?, ?)`,
                [testProjectId, 'Test Rates Project', 'http://test.com', 'RGAA'],
                resolve
            );
        });

        // Créer deux pages de test
        await new Promise((resolve) => {
            db.db.run(
                'INSERT INTO pages (id, name) VALUES (?, ?), (?, ?)',
                [1, 'Page 1', 2, 'Page 2'],
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

    describe('Page Rate Calculations', () => {
        it('should return 100% when all applicable criteria are conformant', async () => {
            // Insérer 5 critères conformes
            for (let i = 1; i <= 5; i++) {
                await new Promise((resolve) => {
                    db.db.run(
                        'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?)',
                        [1, `${i}.1.1`, 'C'],
                        resolve
                    );
                });
            }

            const rate = await db.calculatePageRate(1);
            expect(rate).toBe(100);
        });

        it('should return 0% when all applicable criteria are non-conformant', async () => {
            // Insérer 5 critères non conformes
            for (let i = 1; i <= 5; i++) {
                await new Promise((resolve) => {
                    db.db.run(
                        'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?)',
                        [1, `${i}.1.1`, 'NC'],
                        resolve
                    );
                });
            }

            const rate = await db.calculatePageRate(1);
            expect(rate).toBe(0);
        });

        it('should calculate correct rate with mix of NA and C criteria', async () => {
            // 2 conformes et 3 non applicables sur 5 critères
            const statuses = ['C', 'C', 'NA', 'NA', 'NA'];
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => {
                    db.db.run(
                        'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?)',
                        [1, `${i+1}.1.1`, statuses[i]],
                        resolve
                    );
                });
            }

            const rate = await db.calculatePageRate(1);
            // Sur 5 critères : 2 C et 3 NA
            // Taux = (2 conformes / (5 total - 3 NA)) * 100 = 100%
            expect(rate).toBe(100);
        });

        it('should return 0% when no criteria are tested', async () => {
            const rate = await db.calculatePageRate(1);
            expect(rate).toBe(0);
        });
    });

    describe('Average Rate Calculations', () => {
        it('should calculate correct average when pages have different rates', async () => {
            // Page 1: 100% (2 C sur 2)
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?), (?, ?, ?)',
                    [1, '1.1.1', 'C', 1, '1.1.2', 'C'],
                    resolve
                );
            });

            // Page 2: 50% (1 C, 1 NC)
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?), (?, ?, ?)',
                    [2, '1.1.1', 'C', 2, '1.1.2', 'NC'],
                    resolve
                );
            });

            const averageRate = await db.calculateAverageRate();
            expect(averageRate).toBe(75); // (100 + 50) / 2 = 75
        });
    });

    describe('Global Rate Calculations', () => {
        it('should calculate correct global rate with criteria applied across pages', async () => {
            // Page 1: Critère 1 = C, Critère 2 = NC
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?), (?, ?, ?)',
                    [1, '1.1.1', 'C', 1, '1.1.2', 'NC'],
                    resolve
                );
            });

            // Page 2: Critère 1 = C, Critère 2 = C
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?), (?, ?, ?)',
                    [2, '1.1.1', 'C', 2, '1.1.2', 'C'],
                    resolve
                );
            });

            const globalRate = await db.calculateGlobalRate();
            // Critère 1.1.1 est conforme sur toutes les pages (C)
            // Critère 1.1.2 est non conforme sur au moins une page (NC)
            // Taux global = 50% (1 critère sur 2 est globalement conforme)
            expect(globalRate).toBe(50);
        });

        it('should handle all NA criteria correctly', async () => {
            // Tous les critères sont NA sur toutes les pages
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?), (?, ?, ?)',
                    [1, '1.1.1', 'NA', 1, '1.1.2', 'NA'],
                    resolve
                );
            });
            await new Promise((resolve) => {
                db.db.run(
                    'INSERT INTO audit_results (page_id, criterion_id, status) VALUES (?, ?, ?), (?, ?, ?)',
                    [2, '1.1.1', 'NA', 2, '1.1.2', 'NA'],
                    resolve
                );
            });

            const globalRate = await db.calculateGlobalRate();
            expect(globalRate).toBe(0); // Pas de critères applicables
        });
    });
});