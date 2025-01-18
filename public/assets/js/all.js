// formHandler.js
class FormHandler {
    constructor(formElement) {
        if (formElement.dataset.initialized) {
            return;
        }
        
        this.form = formElement;
        this.form.dataset.initialized = 'true';
        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.spinner = this.submitButton?.querySelector('.spinner-border');
        this.url = this.form.getAttribute('action') || `/audit/${currentProjectId}/nc`;
        this.method = this.form.getAttribute('method')?.toUpperCase() || 'POST';
        this.filePreviewContainer = null;
        this.isSubmitting = false;
        this.screens = new Set();
        
        this.setupEventListeners();
    }

    static initDeleteHandlers() {
        const deleteButtons = document.querySelectorAll('.delete-nc');
        const ncForm = document.querySelector('form.nc-form');
        if (deleteButtons.length > 0 && ncForm) {
            const formHandler = new FormHandler(ncForm);
            deleteButtons.forEach(button => {
                if (!button.dataset.handlerAttached) {
                    formHandler.setupDeleteHandler(button);
                }
            });
        }
    }

    setupEventListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.isSubmitting) return;
            this.isSubmitting = true;
            await this.handleSubmit();
            this.isSubmitting = false;
        });

        // Gestion du fichier si présent
        const fileInput = this.form.querySelector('input[type="file"]');
        if (fileInput) {
            this.setupFilePreview(fileInput);
        }

        // Gestion des écrans pour les formulaires de projet
        if (this.form.id === 'newProjectForm' || this.form.id === 'editProjectForm') {
            const addScreenBtn = this.form.querySelector('#addScreen');
            const screenInput = this.form.querySelector('#screenInput');
            
            if (addScreenBtn && screenInput) {
                addScreenBtn.addEventListener('click', () => this.addScreen(screenInput));
                screenInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.addScreen(screenInput);
                    }
                });
            }
        }
    }

    addScreen(input) {
        const screenName = input.value.trim();
        if (screenName && !this.screens.has(screenName)) {
            this.screens.add(screenName);
            
            const screensList = this.form.querySelector('#screensList');
            const badge = document.createElement('div');
            badge.className = 'badge bg-primary me-2 mb-2';
            badge.innerHTML = `
                ${screenName}
                <button type="button" class="btn-close btn-close-white ms-2" aria-label="Supprimer"></button>
            `;
            
            badge.querySelector('.btn-close').addEventListener('click', () => {
                this.screens.delete(screenName);
                badge.remove();
                // Mettre à jour data-custom après la suppression
                this.updateFormDataCustom();
            });
            
            screensList.appendChild(badge);
            input.value = '';
            
            // Mettre à jour data-custom après l'ajout
            this.updateFormDataCustom();
        }
    }
    updateFormDataCustom() {
        if (this.form.id === 'newProjectForm') {
            this.form.setAttribute('data-custom', JSON.stringify({
                screens: Array.from(this.screens)
            }));
        }
    }

    setupFilePreview(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!this.validateFile(file)) {
                fileInput.value = '';
                return;
            }

            this.showFilePreview(file, fileInput);
        });
    }

    validateFile(file) {
        if (!file.type.startsWith('image/jpeg')) {
            alert('Seules les images JPG sont acceptées');
            return false;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('L\'image ne doit pas dépasser 5MB');
            return false;
        }

        return true;
    }

    showFilePreview(file, fileInput) {
        const previewId = `preview-${fileInput.id}`;
        this.filePreviewContainer = this.form.querySelector(`#${previewId}`);
        
        if (!this.filePreviewContainer) {
            this.filePreviewContainer = document.createElement('div');
            this.filePreviewContainer.id = previewId;
            this.filePreviewContainer.className = 'mt-2 image-preview';
            fileInput.parentNode.appendChild(this.filePreviewContainer);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.filePreviewContainer.innerHTML = `
                <img src="${e.target.result}" class="img-fluid mb-2" style="max-height: 200px" alt="Aperçu">
                <button type="button" class="btn btn-sm btn-danger d-block w-100">Supprimer l'image</button>
            `;
            
            this.filePreviewContainer.querySelector('button').onclick = () => {
                fileInput.value = '';
                this.filePreviewContainer.remove();
                this.filePreviewContainer = null;
            };
        };
        reader.readAsDataURL(file);
    }

    getFormData() {
        if (this.form.id === 'newProjectForm') {
            const formData = new FormData(this.form);
            
            // Validation du nom du projet
            const name = formData.get('name');
            if (!name || name.trim() === '') {
                throw new Error('Le nom du projet est requis');
            }
    
            const pageNames = document.querySelectorAll('.page-name');
            const pageUrls = document.querySelectorAll('.page-url');
            
            // Créer le tableau des screens en combinant les noms et URLs
            const screens = Array.from(pageNames).map((nameInput, index) => ({
                name: nameInput.value.trim(),
                url: pageUrls[index] ? pageUrls[index].value.trim() : ''
            })).filter(screen => screen.name !== ''); // Filtrer les pages sans nom
    
            const data = {
                name: name.trim(),
                url: formData.get('url') || '',
                referential: formData.get('referential'),
                screens: screens
            };
            
            return data;
        }
        return new FormData(this.form);
    }

    startLoading() {
        if (this.submitButton) {
            this.submitButton.disabled = true;
        }
        if (this.spinner) {
            this.spinner.classList.remove('d-none');
        }
    }

    stopLoading() {
        if (this.submitButton) {
            this.submitButton.disabled = false;
        }
        if (this.spinner) {
            this.spinner.classList.add('d-none');
        }
    }

    showError(message) {
        let errorContainer = this.form.querySelector('.alert-danger');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'alert alert-danger mt-3';
            this.form.prepend(errorContainer);
        }
        errorContainer.textContent = message;
    }

    // Dans formHandler.js, modifier la méthode setupDeleteHandler :

    setupDeleteHandler(button) {
        // Ne rien faire car la suppression est gérée dans audit.js
        return;
    }


    async handleSuccess(response) {
        if (!response.success) {
            throw new Error(response.message || 'Une erreur est survenue');
        }
    
        // Si c'est un formulaire de non-conformité
        if (this.form.classList.contains('nc-form')) {
            if (response.ncId) {
                const isEditing = this.form.action.includes('/edit');
                const criterionId = this.form.querySelector('[name="criterionId"]').value;
                const pageIdInput = this.form.querySelector('[name="pageId"]');
                const allPagesCheckbox = this.form.querySelector('[name="allPages"]');
                const wrapperId = `wrapper-${criterionId.replace(/\./g, '-')}`;
                const wrapper = document.querySelector(`#${wrapperId}`);
    
                // Mettre le critère en NC
                try {
                    const statusResponse = await fetch(`/audit/${currentProjectId}/criterion/${criterionId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            status: 'NC',
                            pageId: pageIdInput?.value || undefined,
                            allPages: allPagesCheckbox?.checked || !pageIdInput?.value
                        })
                    });
    
                    const statusResult = await statusResponse.json();
                    if (statusResult.success && statusResult.rates) {
                        if (statusResult.rates.currentRate !== undefined) {
                            document.getElementById('taux_conform_pa').textContent = `${statusResult.rates.currentRate}%`;
                        }
                        if (statusResult.rates.averageRate !== undefined) {
                            document.getElementById('taux_moyen').textContent = `${statusResult.rates.averageRate}%`;
                        }
                        if (statusResult.rates.globalRate !== undefined) {
                            document.getElementById('taux_conform').textContent = `${statusResult.rates.globalRate}%`;
                        }
                    }
    
                    // Mettre à jour le select du critère
                    const criterionSelect = document.querySelector(`select[data-criterion="${criterionId}"]`);
                    if (criterionSelect) {
                        criterionSelect.value = 'NC';
                    }
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du statut:', error);
                }
    
                if (wrapper) {
                    if (isEditing) {
                        // Mode édition - Mettre à jour la carte existante
                        const existingCard = wrapper.querySelector(`#nc-${response.ncId}`);
                        if (existingCard) {
                            if (response.screenshot_path) {
                                const imgElement = existingCard.querySelector('.card-img-top');
                                if (imgElement) {
                                    imgElement.src = response.screenshot_path;
                                } else {
                                    existingCard.insertAdjacentHTML('afterbegin', 
                                        `<img src="${response.screenshot_path}" class="card-img-top" alt="Capture d'écran de la non-conformité">`
                                    );
                                }
                            }
                            existingCard.querySelector('h5.card-title + p').textContent = response.impact;
                            existingCard.querySelector('h5.card-text + p').textContent = response.description;
                            existingCard.querySelector('h5.card-title:last-of-type + p').textContent = response.solution;
                        }
                    } else {
                        // Mode création - Ajouter une nouvelle carte
                        const templateData = {
                            id: response.ncId,
                            criterion_id: criterionId,
                            impact: response.impact,
                            description: response.description,
                            solution: response.solution,
                            screenshot_path: response.screenshot_path,
                            pages: response.pages || [],
                            allPages: response.allPages || false
                        };
        
                        // Supprimer le message "Aucune NC" s'il existe
                        const emptyMessage = wrapper.querySelector('.alert-info');
                        if (emptyMessage && emptyMessage.textContent.includes('Aucune non-conformité')) {
                            emptyMessage.remove();
                        }
        
                        // Récupérer et insérer le template
                        const templateResponse = await fetch(`/nc-template?data=${encodeURIComponent(JSON.stringify(templateData))}`);
                        const html = await templateResponse.text();
                        wrapper.insertAdjacentHTML('afterbegin', html);
                    }
                }
    
                // Fermer la modal
                const modal = bootstrap.Modal.getInstance(this.form.closest('.modal'));
                if (modal) {
                    modal.hide();
                }
    
                // Réinitialiser le formulaire
                this.form.reset();
                if (this.filePreviewContainer) {
                    this.filePreviewContainer.remove();
                    this.filePreviewContainer = null;
                }
            }
        }  
        // Si c'est un formulaire d'édition de projet
        else if (this.form.id === 'editProjectForm') {
            // Fermer la modale
            const modal = bootstrap.Modal.getInstance(document.getElementById('editProject'));
            if (modal) {
                modal.hide();
            }
            // Recharger la page pour voir les changements
            window.location.reload();
        }
        // Si c'est un formulaire de projet (nouveau ou édition)
        else if (response.projectId) {
            window.location.href = `/audit/${response.projectId}`;
            return;
        }
    
        // Gestion de la redirection si spécifiée
        const redirect = this.form.getAttribute('data-redirect');
        if (redirect) {
            window.location.href = redirect.replace(':id', response.projectId);
            return;
        }
    }

    // Fichier: formHandler.js
    // Modification partielle - Dans la classe FormHandler - Méthode handleSubmit

    // Dans formHandler.js, mettre à jour la méthode handleSubmit :

    // Dans formHandler.js, modifier handleSubmit
    async handleSubmit() {
        try {
            this.startLoading();
            
            let response;
            if (this.form.id === 'editProjectForm') {
                response = await this.handleEditProjectSubmit();
            } else if (this.form.id === 'newProjectForm') {
                response = await this.handleNewProjectSubmit();
            } else {
                response = await this.handleDefaultSubmit();
            }

            await this.handleSuccess(response);

        } catch (error) {
            console.error('Erreur:', error);
            this.showError(error.message);
        } finally {
            this.stopLoading();
        }
    }

    async handleEditProjectSubmit() {
        const formData = new FormData(this.form);
        
        const data = {
            name: formData.get('name'),
            url: formData.get('url'),
            referential: formData.get('referential'),
            referentialVersion: formData.get('referentialVersion'),
            screens: []
        };

        // Récupérer toutes les pages
        const pageNames = formData.getAll('page_names[]');
        const pageUrls = formData.getAll('page_urls[]');
        
        // Combiner les noms et URLs des pages
        data.screens = pageNames.map((name, index) => ({
            name: name.trim(),
            url: pageUrls[index] || ''
        })).filter(screen => screen.name !== '');

        const response = await fetch(this.form.action, {
            method: this.method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async handleNewProjectSubmit() {
        const formData = new FormData(this.form);
        
        const data = {
            name: formData.get('name'),
            url: formData.get('url'),
            referential: formData.get('referential'),
            page_names: formData.getAll('page_names[]'),
            page_urls: formData.getAll('page_urls[]')
        };

        const response = await fetch(this.form.action, {
            method: this.method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async handleDefaultSubmit() {
        const response = await fetch(this.form.action, {
            method: this.method,
            body: new FormData(this.form)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }
    
    
}

document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form.senddata, form[id^="ncForm-"]');
    if (forms.length > 0) {
        forms.forEach(form => {
            if (!form.dataset.initialized) {
                new FormHandler(form);
            }
        });
    }
});

class ProjectHandler {
    constructor() {
        console.log('ProjectHandler initialized');
        this.pages = new Map();
        this.pageCounter = 0;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            ['newProject', 'editProject'].forEach(modalId => {
                // Vérifier d'abord si la modale existe
                const modal = document.getElementById(modalId);
                if (!modal) {
                    return; // Passer à l'itération suivante si la modale n'existe pas
                }
    
                // Validation du formulaire
                const form = modal.querySelector('form');
                if (form && form.id === 'newProjectForm') {
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const nameInput = form.querySelector('[name="name"]');
                        if (!nameInput.value.trim()) {
                            alert('Le nom du projet est requis');
                            nameInput.focus();
                            return;
                        }
                        // Continue avec le submit si la validation passe
                        form.submit();
                    });
                }
    
                // Bouton d'ajout de page
                const addPageBtn = modal.querySelector('#addNewPageRow');
                if (addPageBtn) {
                    addPageBtn.addEventListener('click', () => this.addNewPageRow(modalId));
                }
    
                // Gestion des boutons de suppression existants
                const pagesList = modal.querySelector('#pagesList');
                if (pagesList) {
                    if (pagesList.children.length === 0 && modalId === 'newProject') {
                        this.addNewPageRow(modalId);
                    }
    
                    // Ajouter les gestionnaires pour les boutons de suppression existants
                    pagesList.querySelectorAll('.delete-page').forEach(button => {
                        this.setupDeletePageButton(button, pagesList);
                    });
                }
            });
        });
    }
    
    setupDeletePageButton(button, pagesList) {
        button.addEventListener('click', () => {
            const row = button.closest('.row');
            if (row) {
                row.remove();
                // Mettre à jour l'état des boutons
                const remainingRows = pagesList.querySelectorAll('.row');
                remainingRows.forEach(r => {
                    const delBtn = r.querySelector('.delete-page');
                    if (delBtn) {
                        delBtn.disabled = remainingRows.length <= 1;
                    }
                });
            }
        });
    }
    
    addNewPageRow(modalId) {
        const modal = document.getElementById(modalId);
        const pagesList = modal.querySelector('#pagesList');
        const rowId = ++this.pageCounter;
    
        const row = document.createElement('div');
        row.className = 'row mb-2 align-items-center';
        row.dataset.rowId = rowId;
        row.innerHTML = `
            <div class="col-5">
                <input type="text" 
                       class="form-control page-name" 
                       name="page_names[]"
                       placeholder="Nom de la page"
                       required>
            </div>
            <div class="col-6">
                <input type="url" 
                       class="form-control page-url" 
                       name="page_urls[]"
                       placeholder="URL de la page">
            </div>
            <div class="col-1">
                <button type="button" 
                        class="btn btn-outline-danger delete-page"
                        ${pagesList.children.length === 0 ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    
        pagesList.appendChild(row);
            
        // Ajouter le gestionnaire d'événements au nouveau bouton de suppression
        const deleteBtn = row.querySelector('.delete-page');
        this.setupDeletePageButton(deleteBtn, pagesList);
    
        // Mettre à jour l'état de tous les boutons de suppression
        const remainingRows = pagesList.querySelectorAll('.row');
        if (remainingRows.length > 1) {
            remainingRows.forEach(r => {
                const delBtn = r.querySelector('.delete-page');
                if (delBtn) delBtn.disabled = false;
            });
        }
    }
}

new ProjectHandler();
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
        const modalElement = document.getElementById('learningModal');
        modalElement.removeAttribute('inert'); // Retirer inert avant d'afficher
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.setAttribute('inert', ''); // Remettre inert quand on ferme
        }, { once: true });
    
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
        // Convertir l'ID du critère en un sélecteur CSS valide
        // L'ID de la modal est maintenant "nc-modal-" au lieu de "addnc-"
        const modalId = `nc-modal-${this.currentCriterionId.replace(/\./g, '-')}`;
        const form = document.querySelector(`#${modalId} form`);
        
        if (!form) {
            console.warn(`Formulaire dans la modal #${modalId} non trouvé`);
            return;
        }
    
        // Remplir le formulaire avec les suggestions
        form.querySelector('[name="impact"]').value = suggestion.impact;
        form.querySelector('[name="description"]').value = suggestion.description;
        form.querySelector('[name="solution"]').value = suggestion.solution;
    
        // Fermer la modale des suggestions
        const learningModal = document.getElementById('learningModal');
        const modalInstance = bootstrap.Modal.getInstance(learningModal);
        modalInstance?.hide();
        learningModal.setAttribute('inert', '');
        
        // Ouvrir la modale de NC
        const ncModalElement = document.getElementById(modalId);
        if (!ncModalElement) {
            console.warn(`Modal #${modalId} non trouvée`);
            return;
        }
        
        ncModalElement.removeAttribute('inert');
        const ncModal = new bootstrap.Modal(ncModalElement);
        ncModal.show();
    
        // Gérer la fermeture de la modal
        ncModalElement.addEventListener('hidden.bs.modal', () => {
            ncModalElement.setAttribute('inert', '');
        }, { once: true });
    }

    async rateSuggestion(suggestionId, isHelpful) {
        try {
            const learningModal = document.getElementById('learningModal');
            const modalInstance = bootstrap.Modal.getInstance(learningModal);
            modalInstance?.hide();
            learningModal.setAttribute('inert', '');
    
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
document.addEventListener('DOMContentLoaded', function() {

    console.log('Script audit.js chargé !');
    
    // Au chargement de la page, récupérer le pageId de l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('pageId');
    
    if (pageId) {
        const screenSelector = document.getElementById('screenSelector');
        if (screenSelector) {
            screenSelector.value = pageId;
        }
    }

    // Dans audit.js - gestionnaires d'événements pour modifier et supprimer
    document.addEventListener('click', async function(e) {
        // Gestion du bouton supprimer
        if (e.target.matches('.delete-nc') && !e.target.dataset.handlerAttached) {
            console.log("Clic sur supprimer détecté");
            const ncId = e.target.dataset.ncId;
            console.log("NC ID:", ncId);
            e.target.dataset.handlerAttached = 'true'; // Marquer le gestionnaire comme attaché
            
            if (!ncId) {
                console.error('ID de la NC manquant');
                return;
            }
    
            if (!confirm('Êtes-vous sûr de vouloir supprimer cette non-conformité ?')) {
                return;
            }
    
            try {
                const response = await fetch(`/audit/${currentProjectId}/nc/${ncId}`, {
                    method: 'DELETE'
                });
    
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
    
                const data = await response.json();
                if (data.success) {
                    const card = e.target.closest('.card');
                    if (card) {
                        // Animation de suppression
                        card.style.transition = 'all 0.3s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-20px)';
                        
                        setTimeout(() => {
                            card.remove();
                            
                            // Nettoyage manuel du backdrop et restauration du scroll
                            const backdrop = document.querySelector('.modal-backdrop');
                            if (backdrop) {
                                backdrop.remove();
                            }
                            document.body.classList.remove('modal-open');
                            document.body.style.overflow = '';
                            document.body.style.paddingRight = '';
                            
                            // Vérifier s'il reste des NC
                            const wrapper = card.closest('.wrapper_ncs');
                            if (wrapper && !wrapper.querySelector('.card')) {
                                wrapper.innerHTML = `
                                    <div class="alert alert-info">
                                        Aucune non-conformité trouvée pour ce critère
                                    </div>
                                `;
                            }
                        }, 300);
                    }
                } else {
                    throw new Error(data.message || 'Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                alert('Erreur lors de la suppression: ' + error.message);
                
                // Nettoyage en cas d'erreur
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }
        }

        // Gestion du bouton modifier
        if (e.target.matches('.btn-modifier')) {
            console.log("Clic sur modifier détecté");
            const button = e.target;
            const card = button.closest('.card');
            const ncId = button.dataset.ncId;
            const criterionId = button.dataset.criterionId;
            
            console.log("Données du bouton:", {
                ncId,
                criterionId,
                card: !!card
            });
            
            if (!ncId || !card || !criterionId) {
                console.error('Données manquantes pour l\'édition');
                return;
            }
        
            const modalId = `nc-modal-${criterionId.replace(/\./g, '-')}`;
            const modal = document.getElementById(modalId);
            if (!modal) {
                console.error('Modal non trouvée');
                return;
            }
        
            const form = modal.querySelector('form');
            if (!form) {
                console.error('Formulaire non trouvé dans la modal');
                return;
            }
        
            // IMPORTANT: modifier l'action du formulaire pour l'édition
            const originalAction = form.getAttribute('action');
            form.setAttribute('action', `/audit/${currentProjectId}/nc/${ncId}/edit`);
            
            // Mettre à jour les champs cachés
            form.querySelector('[name="ncId"]').value = ncId;
            form.querySelector('[name="criterionId"]').value = criterionId;
        
            // Remplir les champs du formulaire
            form.querySelector('[name="impact"]').value = card.querySelector('h5.card-title + p').textContent.trim();
            form.querySelector('[name="description"]').value = card.querySelector('h5.card-text + p').textContent.trim();
            form.querySelector('[name="solution"]').value = card.querySelector('h5.card-title:last-of-type + p').textContent.trim();
        
            // Afficher l'image existante si présente
            const existingImg = card.querySelector('.card-img-top');
            if (existingImg) {
                const currentScreenshot = form.querySelector('#current-screenshot');
                currentScreenshot.innerHTML = `
                    <img src="${existingImg.src}" class="img-fluid mb-2" alt="Capture d'écran actuelle">
                    <small class="text-muted d-block">Capture d'écran actuelle</small>
                `;
            }
        
            // Configurer le formulaire pour le mode édition
            modal.querySelectorAll('.mode-create').forEach(el => el.style.display = 'none');
            modal.querySelectorAll('.mode-edit').forEach(el => el.style.display = 'inline');
            modal.querySelectorAll('.create-mode-field').forEach(el => el.style.display = 'none');
        
            // Gestionnaire pour restaurer l'action originale à la fermeture
            modal.addEventListener('hidden.bs.modal', () => {
                form.setAttribute('action', originalAction);
                form.reset();
                modal.querySelectorAll('.mode-create').forEach(el => el.style.display = 'inline');
                modal.querySelectorAll('.mode-edit').forEach(el => el.style.display = 'none');
                modal.querySelectorAll('.create-mode-field').forEach(el => el.style.display = 'block');
            }, { once: true });
        
            // Afficher la modal
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
        }
    });

    
    // Initialisation des dropdowns
    const dropdownElementList = document.querySelectorAll('.dropdown-toggle');
    const dropdownList = [...dropdownElementList].map(dropdownToggleEl => 
        new bootstrap.Dropdown(dropdownToggleEl)
    );

    // Initialisation des modales pour la méthodologie
    document.querySelectorAll('button[data-bs-target^="#test-modal_"]').forEach(button => {
        const targetId = button.getAttribute('data-bs-target');
        const modalElement = document.querySelector(targetId);
        if (modalElement && !modalElement.initialized) {
            new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true
            });
            modalElement.initialized = true;

            button.addEventListener('click', function(e) {
                e.preventDefault();
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.show();
                }
            });
        }
    });


    
    
    // Ajoutez également ce gestionnaire pour les boutons qui ouvrent les modales
    document.querySelectorAll('[data-bs-toggle="modal"]').forEach(button => {

        button.addEventListener('click', function(e) {
            console.log('Clic sur bouton modale');
            console.log('Target modal:', document.querySelector(this.getAttribute('data-bs-target')));
            const targetModalId = this.getAttribute('data-bs-target');
            const modal = document.querySelector(targetModalId);
            if (modal) {
                const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
                modalInstance.show();
            }
        });
    });


    function updateRates(rates) {
        if (rates.currentRate !== undefined) {
            document.getElementById('taux_conform_pa').textContent = `${rates.currentRate}%`;
        }
        if (rates.averageRate !== undefined) {
            document.getElementById('taux_moyen').textContent = `${rates.averageRate}%`;
        }
        if (rates.globalRate !== undefined) {
            document.getElementById('taux_conform').textContent = `${rates.globalRate}%`;
        }
    }   
        
    // Gestion des critères
    document.querySelectorAll('.criterion-status').forEach(select => {
        select.addEventListener('change', async function() {
            const criterionId = this.dataset.criterion;
            const status = this.value;
            const pageId = document.getElementById('screenSelector')?.value;
            
            // Ne pas permettre la sélection de 'MULTIPLE'
            if (status === 'MULTIPLE') {
                return;
            }
    
            try {
                const url = `/audit/${currentProjectId}/criterion/${criterionId}`;
                const body = pageId ? 
                    { status, pageId } : 
                    { status, allPages: true };
    
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });
                
                const data = await response.json();
                
                if (data.success && data.rates) {
                    updateRates(data.rates);
                    
                    // Mise à jour visuelle du statut
                    if (data.hasDifferentStatuses) {
                        // Ajouter l'indicateur visuel si nécessaire
                        const container = select.closest('.d-flex');
                        if (!container.querySelector('.badge')) {
                            container.insertAdjacentHTML('beforeend', `
                                <span class="badge bg-warning" 
                                      data-bs-toggle="tooltip" 
                                      title="Les statuts diffèrent selon les pages">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </span>
                            `);
                            // Initialiser le nouveau tooltip
                            new bootstrap.Tooltip(container.querySelector('[data-bs-toggle="tooltip"]'));
                        }
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour du statut:', error)
                // Optionnel: Ajouter une notification d'erreur
                const alert = document.createElement('div');
                alert.className = 'alert alert-danger fade show position-fixed bottom-0 end-0 m-3';
                alert.textContent = 'Erreur lors de la mise à jour du statut';
                document.body.appendChild(alert);
                setTimeout(() => alert.remove(), 3000);
            }
        });
    });


    

    // Gestion des écrans
    const screens = new Set();
    const screenInput = document.getElementById('screenInput');
    const addScreenBtn = document.getElementById('addScreen');
    const screensList = document.getElementById('screensList');
    const newProjectForm = document.getElementById('newProjectForm');

    function updateScreensData() {
        if (newProjectForm) {
            newProjectForm.setAttribute('data-custom', JSON.stringify({
                screens: Array.from(screens)
            }));
        }
    }

    function addScreen(screenName) {
        if (screenName && !screens.has(screenName)) {
            screens.add(screenName);
            
            const badge = document.createElement('div');
            badge.className = 'badge bg-primary me-2 mb-2';
            badge.innerHTML = `
                ${screenName}
                <button type="button" class="btn-close btn-close-white ms-2" aria-label="Supprimer"></button>
            `;
            
            badge.querySelector('.btn-close').addEventListener('click', () => {
                screens.delete(screenName);
                badge.remove();
                updateScreensData();
            });
            
            screensList.appendChild(badge);
            updateScreensData();
        }
    }

    // Gestionnaire du bouton d'ajout d'écran
    addScreenBtn?.addEventListener('click', () => {
        const screenName = screenInput.value.trim();
        if (screenName) {
            addScreen(screenName);
            screenInput.value = '';
        }
    });

    // Permettre l'ajout d'écran avec la touche Enter
    screenInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const screenName = screenInput.value.trim();
            if (screenName) {
                addScreen(screenName);
                screenInput.value = '';
            }
        }
    });

    // Gestion du changement d'écran
    const screenSelector = document.getElementById('screenSelector');
    if (screenSelector) {
        screenSelector.addEventListener('change', function() {
            const pageId = this.value;
            const url = new URL(window.location);
            if (pageId) {
                url.searchParams.set('pageId', pageId);
            } else {
                url.searchParams.delete('pageId');
            }
            window.location = url;
        });
    }

    // Initialisation des tooltips Bootstrap

    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });



    // Synchroniser les sélecteurs de page
    document.getElementById('screenSelector')?.addEventListener('change', function(e) {
        const pageId = this.value;
        document.querySelectorAll('input[name="pageId"]').forEach(input => {
            input.value = pageId;
        });
        
        document.querySelectorAll('select[id^="page-select-"]').forEach(select => {
            select.value = pageId;
        });
    });

    const deleteProjectBtn = document.getElementById('deleteProjectBtn');
    if (deleteProjectBtn) {
        deleteProjectBtn.addEventListener('click', async function() {
            if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.')) {
                return;
            }

            const spinner = this.querySelector('.spinner-border');
            try {
                this.disabled = true;
                spinner.classList.remove('d-none');

                const response = await fetch(`/audit/${currentProjectId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    window.location.href = '/';
                } else {
                    throw new Error(data.message || 'Une erreur est survenue lors de la suppression');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la suppression du projet: ' + error.message);
            } finally {
                this.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }


    // Dans audit.js, ajouter ceci
// Dans audit.js, cherchez la partie qui ressemble à ceci :

// Dans audit.js, modifiez la partie qui gère l'ouverture du collapse :
    document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(button => {
        const targetId = button.getAttribute('data-bs-target');
        const target = document.querySelector(targetId);
        if (!target) return;

        target.addEventListener('show.bs.collapse', async function() {
            // Récupérer l'ID du critère et le formater correctement
            const criterionId = button.getAttribute('data-bs-target')
                                .replace('#collapse-', '')  
                                .replace('-', '.'); // Changement ici : on remplace le tiret par un point
            const pageId = document.getElementById('screenSelector')?.value;
            console.log('Chargement des NC pour', criterionId);
            
            const wrapper = document.querySelector(`#wrapper-${criterionId.replace('.', '-')}`);
            if (!wrapper) {
                console.error('Wrapper non trouvé pour le critère', criterionId);
                return;
            }

            if (pageId) {
                const loadingSpinner = document.createElement('div');
                loadingSpinner.className = 'text-center my-4';
                loadingSpinner.innerHTML = `
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                `;
                wrapper.innerHTML = '';
                wrapper.appendChild(loadingSpinner);

                try {
                    const url = `/audit/${currentProjectId}/criterion/${criterionId}/allnc?pageId=${pageId}`;
                    console.log('URL appelée:', url);
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log('Données reçues:', data);

                    wrapper.innerHTML = '';
                    
                    if (!data.ncs || data.ncs.length === 0) {
                        wrapper.innerHTML = `
                            <div class="alert alert-info">
                                Aucune non-conformité trouvée pour ce critère sur cette page
                            </div>
                        `;
                    } else {
                        for (const nc of data.ncs) {
                            const templateResponse = await fetch(`/nc-template?data=${encodeURIComponent(JSON.stringify(nc))}`);
                            const html = await templateResponse.text();
                            wrapper.insertAdjacentHTML('beforeend', html);
                        }
                    }
                } catch (error) {
                    console.error('Erreur:', error);
                    wrapper.innerHTML = `
                        <div class="alert alert-danger">
                            Une erreur est survenue lors du chargement des non-conformités: ${error.message}
                        </div>
                    `;
                }
            }
        });
    });

   // Dans audit.js, ajoutez cette fonction :

    // Gestionnaire pour "Voir tous les écrans"
    // Dans audit.js, gardez uniquement cette partie pour la gestion du bouton "Voir tous les écrans"
    document.querySelectorAll('.seeall').forEach(button => {
        button.addEventListener('click', async function() {
            const criterionId = this.closest('.collapse_container')
                                .id.replace('accordion-detail-', '')
                                .replace('-', '.');
            const wrapper = document.querySelector(`#wrapper-${criterionId.replace('.', '-')}`);
            const currentPageId = document.getElementById('screenSelector')?.value;
            
            if (!wrapper) return;

            const loadingSpinner = document.createElement('div');
            loadingSpinner.className = 'text-center my-4';
            loadingSpinner.innerHTML = `
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
            `;

            try {
                wrapper.innerHTML = '';
                wrapper.appendChild(loadingSpinner);

                // Si on montre déjà toutes les pages, revenir à la page courante
                if (this.dataset.showingAll === 'true') {
                    const response = await fetch(`/audit/${currentProjectId}/criterion/${criterionId}/allnc?pageId=${currentPageId}`);
                    const data = await response.json();

                    wrapper.innerHTML = '';
                    
                    if (!data.ncs || data.ncs.length === 0) {
                        wrapper.innerHTML = `
                            <div class="alert alert-info">
                                Aucune non-conformité trouvée pour ce critère sur cette page
                            </div>
                        `;
                    } else {
                        for (const nc of data.ncs) {
                            const templateResponse = await fetch(`/nc-template?data=${encodeURIComponent(JSON.stringify(nc))}`);
                            const html = await templateResponse.text();
                            wrapper.insertAdjacentHTML('beforeend', html);
                        }
                    }

                    this.textContent = 'Voir tous les écrans';
                    this.classList.remove('btn-primary');
                    this.classList.add('btn-secondary');
                    this.dataset.showingAll = 'false';
                } 
                // Sinon, montrer toutes les pages
                else {
                    const response = await fetch(`/audit/${currentProjectId}/criterion/${criterionId}/allnc`);
                    const data = await response.json();

                    wrapper.innerHTML = '';
                    
                    if (!data.ncs || data.ncs.length === 0) {
                        wrapper.innerHTML = `
                            <div class="alert alert-info">
                                Aucune non-conformité trouvée pour ce critère
                            </div>
                        `;
                    } else {
                        for (const nc of data.ncs) {
                            const templateResponse = await fetch(`/nc-template?data=${encodeURIComponent(JSON.stringify(nc))}`);
                            const html = await templateResponse.text();
                            wrapper.insertAdjacentHTML('beforeend', html);
                        }
                    }

                    this.textContent = 'Revenir à l\'écran courant';
                    this.classList.remove('btn-secondary');
                    this.classList.add('btn-primary');
                    this.dataset.showingAll = 'true';
                }

                // Réinitialiser les handlers de suppression
                wrapper.querySelectorAll('.delete-nc').forEach(deleteBtn => {
                    if (!deleteBtn.dataset.handlerAttached) {
                        const formHandler = new FormHandler(document.querySelector('form.nc-form'));
                        formHandler.setupDeleteHandler(deleteBtn);
                    }
                });

            } catch (error) {
                console.error('Erreur:', error);
                wrapper.innerHTML = `
                    <div class="alert alert-danger">
                        Une erreur est survenue lors du chargement des non-conformités: ${error.message}
                    </div>
                `;
            }
        });
    });
    
    // Ajouter un listener sur le changement de page
    document.getElementById('screenSelector')?.addEventListener('change', function() {
        // Réinitialiser tous les boutons "Voir tous les écrans"
        document.querySelectorAll('.seeall').forEach(button => {
            if (this.value) {
                button.dataset.showingAll = 'false';
                button.textContent = 'Voir tous les écrans';
                button.classList.remove('btn-primary');
                button.classList.add('btn-secondary');
            } else {
                button.dataset.showingAll = 'true';
                button.textContent = 'Revenir à l\'écran courant';
                button.classList.remove('btn-secondary');
                button.classList.add('btn-primary');
            }
        });
    });

});
//# sourceMappingURL=all.js.map
