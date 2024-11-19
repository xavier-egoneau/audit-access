const LearningDatabase = require('../models/learningDatabase');

class LearningService {
    constructor() {
        this.db = LearningDatabase.getInstance();
        
        // Patterns techniques par catégorie
        this.technicalPatterns = {
            images: ['alt', 'aria-label', 'role="img"', 'figure', 'figcaption'],
            forms: ['label', 'input', 'aria-required', 'required', 'aria-invalid'],
            structure: ['header', 'nav', 'main', 'heading', 'aria-hidden'],
            interactive: ['button', 'link', 'aria-expanded', 'aria-controls'],
            multimedia: ['video', 'audio', 'track', 'captions']
        };

        // Patterns d'impact par catégorie
        this.impactPatterns = {
            navigation: ['impossible de naviguer', 'blocage', 'impasse'],
            comprehension: ['incompréhensible', 'confusion', 'ambigu'],
            interaction: ['impossible de cliquer', 'non activable', 'bloqué']
        };

        console.log('Service d\'apprentissage initialisé');
    }

    // Méthode principale pour apprendre d'une nouvelle NC
    async learnFromNC(nonConformity) {
        const { criterionId, impact, description, solution, projectId } = nonConformity;
        
        try {
            await this.db.beginTransaction();

            // 1. Analyser et stocker les patterns
            const patterns = this.extractPatterns(description);
            await this.updatePatterns(criterionId, patterns);

            // 2. Créer ou mettre à jour la suggestion
            const suggestionId = await this.createOrUpdateSuggestion(criterionId, {
                impact,
                description,
                solution,
                patterns
            });

            // 3. Mettre à jour les métriques
            await this.updateMetrics(criterionId);

            await this.db.commit();
            return suggestionId;

        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    // Extraction des patterns depuis une description
    extractPatterns(text) {
        const patterns = new Set();
        const lowercaseText = text.toLowerCase();

        // 1. Patterns techniques
        Object.entries(this.technicalPatterns).forEach(([category, categoryPatterns]) => {
            categoryPatterns.forEach(pattern => {
                if (lowercaseText.includes(pattern.toLowerCase())) {
                    patterns.add(`${category}:${pattern}`);
                }
            });
        });

        // 2. Patterns d'impact
        Object.entries(this.impactPatterns).forEach(([category, impactPatterns]) => {
            impactPatterns.forEach(pattern => {
                if (lowercaseText.includes(pattern)) {
                    patterns.add(`impact:${category}`);
                }
            });
        });

        // 3. Expressions régulières pour les patterns techniques courants
        const regexPatterns = [
            /attribut ["'](\w+)["']/g,
            /balise ["'](\w+)["']/g,
            /role="(\w+)"/g,
            /aria-\w+/g
        ];

        regexPatterns.forEach(regex => {
            const matches = text.matchAll(regex);
            for (const match of matches) {
                patterns.add(`technique:${match[0]}`);
            }
        });

        return Array.from(patterns);
    }

    // Mise à jour des patterns en base
    async updatePatterns(criterionId, patterns) {
        for (const pattern of patterns) {
            await new Promise((resolve, reject) => {
                this.db.db.run(`
                    INSERT INTO learning_patterns (criterion_id, pattern, frequency)
                    VALUES (?, ?, 1)
                    ON CONFLICT (criterion_id, pattern) 
                    DO UPDATE SET 
                        frequency = frequency + 1,
                        updated_at = CURRENT_TIMESTAMP
                `, [criterionId, pattern], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }
    }

    // Création ou mise à jour d'une suggestion
    async createOrUpdateSuggestion(criterionId, { impact, description, solution, patterns }) {
        return new Promise((resolve, reject) => {
            this.db.db.get(`
                SELECT id, used_count, success_count 
                FROM learning_suggestions
                WHERE criterion_id = ? AND description = ?
            `, [criterionId, description], (err, existing) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (existing) {
                    // Mise à jour si la suggestion existe
                    this.db.db.run(`
                        UPDATE learning_suggestions
                        SET impact = CASE 
                                WHEN used_count > 10 AND success_count/used_count > 0.8
                                THEN impact 
                                ELSE ? 
                            END,
                            solution = CASE 
                                WHEN used_count > 10 AND success_count/used_count > 0.8
                                THEN solution 
                                ELSE ? 
                            END,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [impact, solution, existing.id], (err) => {
                        if (err) reject(err);
                        else resolve(existing.id);
                    });
                } else {
                    // Création d'une nouvelle suggestion
                    this.db.db.run(`
                        INSERT INTO learning_suggestions 
                        (criterion_id, impact, description, solution)
                        VALUES (?, ?, ?, ?)
                    `, [criterionId, impact, description, solution], function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    });
                }
            });
        });
    }

    // Récupération des suggestions
    async getSuggestions(criterionId, context = {}) {
        try {
            const suggestions = await new Promise((resolve, reject) => {
                this.db.db.all(`
                    SELECT 
                        s.*, 
                        (s.success_count * 1.0 / NULLIF(s.used_count, 0)) as confidence,
                        COUNT(DISTINCT f.project_id) as projects_count,
                        GROUP_CONCAT(DISTINCT p.pattern) as patterns
                    FROM learning_suggestions s
                    LEFT JOIN learning_feedback f ON f.suggestion_id = s.id
                    LEFT JOIN learning_patterns p ON p.criterion_id = s.criterion_id
                    WHERE s.criterion_id = ?
                    GROUP BY s.id
                    HAVING confidence IS NULL OR confidence > 0.3
                    ORDER BY 
                        confidence DESC NULLS LAST,
                        projects_count DESC,
                        s.used_count DESC
                    LIMIT 5
                `, [criterionId], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows || []);
                });
            });

            // Calcul des scores de pertinence
            return suggestions.map(suggestion => ({
                ...suggestion,
                patterns: suggestion.patterns ? suggestion.patterns.split(',') : [],
                relevanceScore: this.calculateRelevanceScore(suggestion, context)
            })).sort((a, b) => b.relevanceScore - a.relevanceScore);

        } catch (error) {
            console.error('Erreur lors de la récupération des suggestions:', error);
            return [];
        }
    }

    // Calcul du score de pertinence d'une suggestion
    calculateRelevanceScore(suggestion, context) {
        let score = suggestion.confidence || 0;

        // Bonus pour l'utilisation fréquente
        score += Math.min(suggestion.projects_count || 0, 5) / 10;

        // Bonus pour les patterns correspondants
        if (context.patterns && suggestion.patterns) {
            const matchingPatterns = suggestion.patterns.filter(p => 
                context.patterns.includes(p)
            ).length;
            score += matchingPatterns * 0.1;
        }

        // Pénalité pour l'ancienneté
        const ageInDays = (new Date() - new Date(suggestion.created_at)) / (1000 * 60 * 60 * 24);
        score *= Math.exp(-ageInDays / 365); // Décroissance exponentielle sur un an

        return Math.min(1, score); // Normalisation entre 0 et 1
    }

    // Enregistrement du feedback
    async recordFeedback(suggestionId, feedback) {
        const { isHelpful, comment, projectId, userContext } = feedback;

        try {
            await this.db.beginTransaction();

            await new Promise((resolve, reject) => {
                this.db.db.run(`
                    INSERT INTO learning_feedback 
                    (suggestion_id, is_helpful, comment, project_id, user_context)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    suggestionId, 
                    isHelpful, 
                    comment, 
                    projectId, 
                    JSON.stringify(userContext)
                ], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });

            await this.updateSuggestionStats(suggestionId, isHelpful);
            
            await this.db.commit();

        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    // Mise à jour des statistiques d'une suggestion
    async updateSuggestionStats(suggestionId, isHelpful) {
        return new Promise((resolve, reject) => {
            this.db.db.run(`
                UPDATE learning_suggestions
                SET 
                    used_count = used_count + 1,
                    success_count = success_count + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [isHelpful ? 1 : 0, suggestionId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    // Mise à jour des métriques globales
    async updateMetrics(criterionId) {
        return new Promise((resolve, reject) => {
            this.db.db.run(`
                INSERT OR REPLACE INTO learning_metrics 
                (criterion_id, suggestion_count, success_rate, usage_count, last_calculated)
                SELECT 
                    criterion_id,
                    COUNT(DISTINCT id) as suggestion_count,
                    AVG(CASE 
                        WHEN used_count > 0 THEN (success_count * 1.0 / used_count)
                        ELSE 0 
                    END) as success_rate,
                    SUM(used_count) as usage_count,
                    CURRENT_TIMESTAMP
                FROM learning_suggestions
                WHERE criterion_id = ?
                GROUP BY criterion_id
            `, [criterionId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    // Récupération des métriques
    async getMetrics(criterionId = null) {
        return new Promise((resolve, reject) => {
            const query = criterionId ? 
                `SELECT * FROM learning_metrics WHERE criterion_id = ?` :
                `SELECT * FROM learning_metrics`;

            const params = criterionId ? [criterionId] : [];

            this.db.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    }
}

module.exports = LearningService;