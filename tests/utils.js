// tests/utils.js
const path = require('path');
const fs = require('fs').promises;

const cleanTestDatabases = async () => {
    const testDbDir = path.join(__dirname, '..', 'database');
    try {
        const files = await fs.readdir(testDbDir);
        for (const file of files) {
            if (file.startsWith('test-') && file.endsWith('.sqlite')) {
                await fs.unlink(path.join(testDbDir, file));
            }
        }
    } catch (error) {
        console.error('Error cleaning test databases:', error);
    }
};

module.exports = {
    cleanTestDatabases
};