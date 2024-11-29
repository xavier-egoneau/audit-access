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
            });
            
            screensList.appendChild(badge);
            input.value = '';
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
        if (button.dataset.handlerAttached) return;
        
        console.log("Configuration du handler de suppression pour la NC:", button.dataset.ncId);
        
        button.dataset.handlerAttached = 'true';
        button.addEventListener('click', async (e) => {
            console.log("Clic sur le bouton supprimer pour la NC:", button.dataset.ncId);
            const ncId = button.dataset.ncId;
            
            if (!ncId) {
                console.error('ID de la NC manquant');
                return;
            }

            if (!confirm('Êtes-vous sûr de vouloir supprimer cette non-conformité ?')) {
                return;
            }

            try {
                console.log("Tentative de suppression de la NC:", ncId);
                const url = `/audit/${currentProjectId}/nc/${ncId}`;
                console.log("URL de suppression:", url);

                const response = await fetch(url, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }

                const data = await response.json();
                console.log("Réponse de la suppression:", data);

                if (data.success) {
                    const card = button.closest('.card');
                    if (card) {
                        card.style.transition = 'opacity 0.3s ease';
                        card.style.opacity = '0';
                        setTimeout(() => card.remove(), 300);
                    }
                } else {
                    throw new Error(data.message || 'Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                alert('Erreur lors de la suppression de la non-conformité: ' + error.message);
            }
        });
    }

    // Fichier: formHandler.js
    // Modification partielle - Remplacer la méthode handleSuccess

    // Fichier: formHandler.js 
    // Fonction handleSuccess complète

    // Fichier: formHandler.js
// Méthode handleSuccess complète

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
                    let templateData = {
                        ...response,
                        id: response.ncId,
                        // Transformer les objets pages en tableau de noms
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

    async handleSubmit() {
        try {
            this.startLoading();

            // Pour le formulaire de nouveau projet
            if (this.form.id === 'newProjectForm') {
                const formData = new FormData(this.form);
                const screensList = this.form.querySelector('#screensList');
                const screens = Array.from(screensList.querySelectorAll('.badge'))
                    .map(badge => badge.textContent.trim().replace(/×$/, '').trim());

                console.log('Envoi du nouveau projet avec les écrans:', screens);
                
                const data = {
                    name: formData.get('name'),
                    url: formData.get('url') || '',
                    referential: formData.get('referential') || 'RGAA',
                    referentialVersion: formData.get('referentialVersion') || '4.1',
                    screens: screens
                };

                const response = await fetch(this.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                
                if (result.success && result.projectId) {
                    window.location.href = `/audit/${result.projectId}`;
                    return;
                } else {
                    throw new Error(result.message || 'Erreur lors de la création du projet');
                }
            } 
            // Pour les formulaires de NC
            else // Pour les formulaires de NC
            if (this.form.classList.contains('nc-form')) {
                const formData = new FormData(this.form);
                const pageIdInput = this.form.querySelector('[name="pageId"]');
                const allPagesCheckbox = this.form.querySelector('input[name="allPages"]');
                
                // Détecter si nous sommes en vue "Toutes les pages"
                const screenSelector = document.getElementById('screenSelector');
                const isAllPagesView = screenSelector && !screenSelector.value;
                
                // Si la checkbox est cochée OU si on est en vue "Toutes les pages"
                if (allPagesCheckbox?.checked || isAllPagesView) {
                    formData.set('allPages', 'true');
                    formData.delete('pageId');
                } else {
                    formData.set('allPages', 'false');
                    if (!formData.get('pageId')) {
                        const currentPageId = document.getElementById('screenSelector')?.value;
                        if (currentPageId) {
                            formData.set('pageId', currentPageId);
                        }
                    }
                }
            
                console.log('Envoi de la NC avec formData:', Object.fromEntries(formData));
            
                const response = await fetch(this.url, {
                    method: this.method,
                    body: formData
                });
            
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la soumission de la NC');
                }
            
                const result = await response.json();
                await this.handleSuccess(result);
            }
            // Pour les autres formulaires
            else {
                const response = await fetch(this.url, {
                    method: this.method,
                    body: this.getFormData()
                });

                const result = await response.json();
                await this.handleSuccess(result);
            }

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
        } finally {
            this.stopLoading();
            this.isSubmitting = false;
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
