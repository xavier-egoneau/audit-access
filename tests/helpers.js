// tests/helpers.js
const Database = require('../models/database');

async function setupTestDatabase(projectId) {
    const db = new Database(projectId);
    await new Promise((resolve) => {
        db.db.run(
            `INSERT INTO project_info (id, name, url, referential) 
             VALUES (?, ?, ?, ?)`,
            [projectId, 'Test Project', 'http://test.com', 'RGAA'],
            resolve
        );
    });
    return db;
}

module.exports = {
    setupTestDatabase
};