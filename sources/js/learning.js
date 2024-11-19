class LearningUI {
    constructor() {
        this.currentCriterionId = null;
        this.setupEventListeners();
        this.setupFormListeners();
    }
    
    setupFormListeners() {
        // Écouter les ouvertures de modal d'ajout de NC
        document.addEventListener('shown.bs.modal', async (event) => {
            const modal = event.target;
            if (!modal.id.startsWith('addnc-')) return;

            const criterionId = modal.id.replace('addnc-', '').replace('-', '.');
            const form = modal.querySelector('form');
            
            // Charger les suggestions au chargement de la modal
            await this.loadSuggestionsForForm(criterionId, form);
        });
    }



    async loadSuggestionsForForm(criterionId, form) {
        try {
            const response = await fetch(`/api/learning/suggestions/${criterionId}`);
            const data = await response.json();

            if (!data.success || !data.suggestions?.length) {
                return;
            }

            // Afficher les suggestions dans le formulaire
            const containers = form.querySelectorAll('.suggestions-container');
            containers.forEach(container => {
                const suggestionsList = container.querySelector('.suggestions-list');
                const textArea = container.nextElementSibling;
                const fieldType = textArea.name; // impact, description ou solution

                const relevantSuggestions = data.suggestions
                    .filter(s => s.confidence > 0.3) // Ne montrer que les suggestions pertinentes
                    .map(s => s[fieldType])
                    .filter(Boolean);

                if (relevantSuggestions.length > 0) {
                    container.classList.remove('d-none');
                    suggestionsList.innerHTML = relevantSuggestions.map(suggestion => `
                        <div class="suggestion-item">
                            <button type="button" class="btn btn-link btn-sm use-suggestion" 
                                    data-suggestion="${this.escapeHtml(suggestion)}">
                                Utiliser cette suggestion
                            </button>
                            <div class="text-muted small">${this.escapeHtml(suggestion)}</div>
                        </div>
                    `).join('');

                    // Ajouter les gestionnaires de clic
                    suggestionsList.querySelectorAll('.use-suggestion').forEach(btn => {
                        btn.onclick = () => {
                            textArea.value = btn.dataset.suggestion;
                            container.classList.add('d-none');
                        };
                    });
                }
            });

        } catch (error) {
            console.error('Erreur lors du chargement des suggestions:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    async analyzeContext(criterionId, currentContext) {
        // 1. Patterns techniques
        const technicalPatterns = {
            images: ['alt', 'aria-label', 'role="img"'],
            forms: ['label', 'aria-labelledby', 'required'],
            structure: ['heading', 'nav', 'main', 'aria-hidden'],
            // etc.
        };
    
        // 2. Contexte de la page
        const pageContext = {
            type: 'formulaire|navigation|contenu|...',
            importance: 'critique|importante|secondaire',
            composants: ['images', 'formulaires', 'tableaux']
        };
    
        // 3. Historique des NC
        const previousNCs = await this.getPreviousNCs(criterionId);
    
        return {
            technicalContext: this.matchTechnicalPatterns(currentContext),
            pageContext: this.analyzePageContext(currentContext),
            historicalContext: this.analyzeHistory(previousNCs),
            similarityScore: this.calculateContextSimilarity(currentContext, previousNCs)
        };
    }

    setupEventListeners() {
        // Ajouter un bouton "Suggestions IA" à côté de chaque critère
        document.querySelectorAll('.criterion-status').forEach(select => {
            const container = select.closest('.d-flex');
            const criterionId = select.dataset.criterion;
            
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-info btn-sm ms-2';
            btn.innerHTML = '<i class="fas fa-robot"></i>';
            btn.title = 'Voir les suggestions IA';
            btn.onclick = () => this.showSuggestions(criterionId);
            
            container.appendChild(btn);
        });

        // Gestionnaire du filtre de pertinence
        document.getElementById('learning-filter')?.addEventListener('change', e => {
            if (this.currentCriterionId) {
                this.showSuggestions(this.currentCriterionId);
            }
        });
    }

    async showSuggestions(criterionId) {
        this.currentCriterionId = criterionId;
        const modal = new bootstrap.Modal(document.getElementById('learningModal'));
        modal.show();

        try {
            // Charger les métriques
            const metricsResponse = await fetch(`/api/learning/metrics/${criterionId}`);
            const metricsData = await metricsResponse.json();
            
            if (metricsData.success) {
                this.updateMetrics(metricsData.metrics[0] || {});
            }

            // Charger les suggestions
            const minConfidence = document.getElementById('learning-filter').value;
            const suggestionsResponse = await fetch(
                `/api/learning/suggestions/${criterionId}?context=${encodeURIComponent(
                    JSON.stringify({minConfidence})
                )}`
            );
            const suggestionsData = await suggestionsResponse.json();
            
            if (suggestionsData.success) {
                this.updateSuggestions(suggestionsData.suggestions);
            }

        } catch (error) {
            console.error('Erreur lors du chargement des suggestions:', error);
        }
    }

    updateMetrics(metrics) {
        const container = document.getElementById('learning-metrics');
        if (!container) return;

        container.innerHTML = `
            <div>Nombre de suggestions : ${metrics.suggestion_count || 0}</div>
            <div>Taux de succès : ${Math.round((metrics.success_rate || 0) * 100)}%</div>
            <div>Utilisations totales : ${metrics.usage_count || 0}</div>
        `;
    }

    updateSuggestions(suggestions) {
        const container = document.getElementById('learning-suggestions');
        if (!container) return;

        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    Aucune suggestion disponible pour ce critère.
                </div>
            `;
            return;
        }

        container.innerHTML = suggestions.map(suggestion => `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        Confiance : ${Math.round((suggestion.confidence || 0) * 100)}%
                        <span class="badge bg-secondary ms-2">
                            ${suggestion.projects_count || 0} projet(s)
                        </span>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-success use-suggestion" 
                                data-suggestion='${JSON.stringify(suggestion)}'>
                            Utiliser
                        </button>
                        <button class="btn btn-sm btn-outline-secondary rate-suggestion" 
                                data-suggestion-id="${suggestion.id}"
                                data-helpful="true">
                            👍
                        </button>
                        <button class="btn btn-sm btn-outline-secondary rate-suggestion" 
                                data-suggestion-id="${suggestion.id}"
                                data-helpful="false">
                            👎
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <h6>Impact :</h6>
                    <p>${suggestion.impact}</p>
                    <h6>Description :</h6>
                    <p>${suggestion.description}</p>
                    <h6>Solution proposée :</h6>
                    <p>${suggestion.solution}</p>
                </div>
            </div>
        `).join('');

        // Ajouter les écouteurs d'événements
        container.querySelectorAll('.use-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const suggestion = JSON.parse(btn.dataset.suggestion);
                this.useSuggestion(suggestion);
            });
        });

        container.querySelectorAll('.rate-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const suggestionId = btn.dataset.suggestionId;
                const isHelpful = btn.dataset.helpful === 'true';
                this.rateSuggestion(suggestionId, isHelpful);
            });
        });
    }

    async useSuggestion(suggestion) {
        // Remplir automatiquement le formulaire d'ajout de NC
        const form = document.querySelector(`#ncForm-${this.currentCriterionId.replace('.', '-')}`);
        if (!form) return;

        form.querySelector('[name="impact"]').value = suggestion.impact;
        form.querySelector('[name="description"]').value = suggestion.description;
        form.querySelector('[name="solution"]').value = suggestion.solution;

        // Fermer la modale des suggestions
        bootstrap.Modal.getInstance(document.getElementById('learningModal')).hide();
        
        // Ouvrir la modale d'ajout de NC
        const ncModal = new bootstrap.Modal(document.getElementById(`addnc-${this.currentCriterionId.replace('.', '-')}`));
        ncModal.show();
    }

    async rateSuggestion(suggestionId, isHelpful) {
        try {
            // Fermer la modale avant d'envoyer le feedback
            const learningModal = bootstrap.Modal.getInstance(document.getElementById('learningModal'));
            learningModal?.hide();
    
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    suggestionId,
                    isHelpful,
                    criterionId: this.currentCriterionId,
                    projectId: currentProjectId
                })
            });
    
            if (!response.ok) {
                throw new Error('Erreur lors de l\'envoi du feedback');
            }
    
            // Feedback visuel
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = `alert alert-${isHelpful ? 'success' : 'info'} position-fixed top-0 start-50 translate-middle-x mt-3`;
            feedbackDiv.style.zIndex = '9999';
            feedbackDiv.textContent = isHelpful ? 'Merci pour votre retour positif !' : 'Merci pour votre retour';
            document.body.appendChild(feedbackDiv);
            setTimeout(() => feedbackDiv.remove(), 2000);
    
            // Attendre que la modale soit fermée avant de recharger les suggestions
            setTimeout(async () => {
                // Nettoyer les événements de la modale précédente
                const oldModal = document.getElementById('learningModal');
                const newModal = oldModal.cloneNode(true);
                oldModal.parentNode.replaceChild(newModal, oldModal);
                
                // Recharger les suggestions avec la nouvelle modale
                await this.showSuggestions(this.currentCriterionId);
            }, 500);
    
        } catch (error) {
            console.error('Erreur lors de l\'envoi du feedback:', error);
            // Feedback visuel d'erreur
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
            errorDiv.style.zIndex = '9999';
            errorDiv.textContent = 'Erreur lors de l\'enregistrement du retour';
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.learningUI = new LearningUI();
});