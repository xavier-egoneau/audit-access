// tests/integration/routes.test.js
const request = require('supertest');
const app = require('../../app');

describe('API Routes', () => {
    // Plus besoin de gérer le serveur manuellement car supertest le fait pour nous
    describe('POST /audit/new', () => {
        it('should create a new audit project', async () => {
            const response = await request(app)  // utiliser app directement
                .post('/audit/new')
                .send({
                    name: 'Test Project',
                    url: 'http://test.com',
                    referential: 'RGAA',
                    screens: ['Home', 'Contact']
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject invalid project data', async () => {
            const response = await request(app)
                .post('/audit/new')
                .send({
                    name: '',
                    referential: 'INVALID'
                });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /audit/:projectId', () => {
        it('should return 404 for non-existent project', async () => {
            await request(app)
                .get('/audit/non-existent-id')
                .expect(404);
        });
    });
});