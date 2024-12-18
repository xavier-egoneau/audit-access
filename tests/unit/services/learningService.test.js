// tests/unit/services/learningService.test.js
const LearningService = require('../../../services/learningService');

describe('LearningService', () => {
    let service;

    beforeEach(() => {
        service = new LearningService();
    });

    describe('extractPatterns', () => {
        it('should extract impact patterns', () => {
            const description = 'Navigation impossible, blocage total';
            const patterns = service.extractPatterns(description);
            
            // Vérifions que les patterns contiennent au moins un des impacts attendus
            expect(patterns.some(p => 
                ['impact:navigation', 'impact:blocage'].includes(p)
            )).toBeTruthy();
        });

        it('should extract technical patterns', () => {
            const description = 'L\'image n\'a pas d\'attribut alt';
            const patterns = service.extractPatterns(description);
            expect(patterns).toContain('images:alt');
        });
    });
});