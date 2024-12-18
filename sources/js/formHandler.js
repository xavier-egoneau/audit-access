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
            const customData = JSON.parse(this.form.getAttribute('data-custom') || '{}');
            const data = {
                ...Object.fromEntries(formData.entries()),
                ...customData
            };
            return JSON.stringify(data); // Convertir en JSON pour l'envoi
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
                const existingNc = document.querySelector(`#nc-${response.ncId}`);
                if (!existingNc) {
                    const criterionId = this.form.querySelector('[name="criterionId"]').value;
                    // Utiliser directement le format avec tirets
                    const wrapperId = `wrapper-${criterionId.replace(/\./g, '-')}`;
                    const wrapper = document.querySelector(`#${wrapperId}`);
                    
                    if (wrapper) {
                        // Préparer les données pour le template
                        const templateData = {
                            id: response.ncId,
                            criterion_id: criterionId,
                            impact: response.impact,
                            description: response.description,
                            solution: response.solution,
                            screenshot_path: response.screenshot_path,
                            pages: response.pages ? response.pages.map(page => page.name) : [],
                            allPages: response.allPages || false
                        };
    
                        try {
                            // Récupérer et insérer le template
                            const templateResponse = await fetch(`/nc-template?data=${encodeURIComponent(JSON.stringify(templateData))}`);
                            
                            if (!templateResponse.ok) {
                                throw new Error('Erreur lors de la récupération du template');
                            }
                            
                            const html = await templateResponse.text();
                            
                            // Si c'est vide, retirer le message "Aucune NC"
                            const emptyMessage = wrapper.querySelector('.alert-info');
                            if (emptyMessage && emptyMessage.textContent.includes('Aucune non-conformité')) {
                                emptyMessage.remove();
                            }
                            
                            wrapper.insertAdjacentHTML('afterbegin', html);
                            
                            // Réinitialiser les gestionnaires d'événements
                            FormHandler.initDeleteHandlers();
                            
                            // Animer l'apparition
                            const newNc = wrapper.querySelector(`#nc-${response.ncId}`);
                            if (newNc) {
                                newNc.style.opacity = '0';
                                requestAnimationFrame(() => {
                                    newNc.style.transition = 'opacity 0.3s ease';
                                    newNc.style.opacity = '1';
                                });
                            }
                        } catch (error) {
                            console.error('Erreur lors de l\'ajout de la NC:', error);
                            throw new Error('Erreur lors de l\'ajout de la non-conformité');
                        }
                    }
    
                    // Fermer la modal si elle existe
                    const modal = bootstrap.Modal.getInstance(this.form.closest('.modal'));
                    if (modal) {
                        modal.hide();
                    }
                }
            }
            
            // Réinitialisation du formulaire
            this.form.reset();
            if (this.filePreviewContainer) {
                this.filePreviewContainer.remove();
                this.filePreviewContainer = null;
            }
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

    async handleSubmit() {
        try {
            this.startLoading();
            
            // Récupérer les données du formulaire
            const formData = new FormData(this.form);
            const ncId = formData.get('ncId');
            const isEditMode = ncId && ncId.trim() !== '';
            const isNewProject = this.form.id === 'newProjectForm';
    
            // Construire l'URL appropriée
            let url;
            if (isNewProject) {
                url = '/audit/new';
            } else if (isEditMode) {
                url = `/audit/${currentProjectId}/nc/${ncId}/edit`;
            } else {
                url = `/audit/${currentProjectId}/nc`;
            }
    
            console.log(`Mode ${isNewProject ? 'création projet' : (isEditMode ? 'édition NC' : 'création NC')}, URL:`, url);
    
            // Configurer les options de la requête
            let fetchOptions = {
                method: this.method
            };
    
            if (isNewProject) {
                // Pour un nouveau projet, envoyer les données en JSON
                const customData = JSON.parse(this.form.getAttribute('data-custom') || '{}');
                const data = {
                    ...Object.fromEntries(formData.entries()),
                    ...customData
                };
                
                fetchOptions.headers = {
                    'Content-Type': 'application/json'
                };
                fetchOptions.body = JSON.stringify(data);
            } else {
                // Pour les NC, utiliser FormData tel quel
                fetchOptions.body = formData;
            }
    
            const response = await fetch(url, fetchOptions);
    
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
    
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Erreur lors de l\'opération');
            }
    
            // Gérer la réponse selon le type d'opération
            if (isNewProject && result.projectId) {
                window.location.href = `/audit/${result.projectId}`;
                return;
            }
    
            if (isEditMode && result.ncId) {
                // Mise à jour de la carte NC existante
                const card = document.querySelector(`#nc-${result.ncId}`);
                if (card) {
                    // Mettre à jour l'impact
                    const impactElement = card.querySelector('h5.card-title + p');
                    if (impactElement) {
                        impactElement.textContent = formData.get('impact') || '';
                    }
    
                    // Mettre à jour la description
                    const descriptionElement = card.querySelector('h5.card-text + p');
                    if (descriptionElement) {
                        descriptionElement.textContent = formData.get('description') || '';
                    }
    
                    // Mettre à jour la solution
                    const solutionElement = card.querySelector('h5.card-title:last-of-type + p');
                    if (solutionElement) {
                        solutionElement.textContent = formData.get('solution') || '';
                    }
    
                    // Mettre à jour l'image si une nouvelle a été uploadée
                    if (result.screenshot_path) {
                        const imgElement = card.querySelector('img.card-img-top');
                        if (imgElement) {
                            imgElement.src = result.screenshot_path;
                        } else {
                            // Si pas d'image existante, en ajouter une nouvelle
                            card.insertAdjacentHTML('afterbegin', 
                                `<img src="${result.screenshot_path}" class="card-img-top" alt="Capture d'écran de la non-conformité">`
                            );
                        }
                    }
    
                    // Animation de mise à jour
                    card.style.transition = 'background-color 0.3s ease';
                    card.style.backgroundColor = '#e8f5e9';
                    setTimeout(() => {
                        card.style.backgroundColor = '';
                    }, 500);
                }
    
                // Fermeture de la modal
                const modalElement = this.form.closest('.modal');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                    }
                }
    
                // Réinitialiser le formulaire
                this.form.reset();
                if (this.filePreviewContainer) {
                    this.filePreviewContainer.innerHTML = '';
                }
            } else {
                // Création d'une nouvelle NC ou autre cas
                await this.handleSuccess(result);
            }
    
        } catch (error) {
            console.error('Erreur:', error);
            this.showError(error.message);
        } finally {
            this.stopLoading();
        }
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
