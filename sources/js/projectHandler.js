// Fichier: projectHandler.js
// Fichier entier pour éviter toute confusion

class ProjectHandler {
    constructor() {
        this.screens = new Set();
        this.initialized = false;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            if (this.initialized) return;
            this.initialized = true;

            // Gestion du formulaire d'édition
            this.editForm = document.getElementById('editProjectForm');
            if (this.editForm) {
                // Supprimer tout gestionnaire d'événements existant
                const newForm = this.editForm.cloneNode(true);
                this.editForm.parentNode.replaceChild(newForm, this.editForm);
                this.editForm = newForm;
                
                this.editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
                this.loadExistingScreens();

                // Gestion de l'ajout d'écrans
                this.setupScreenAddition();
            }
        });
    }

    setupScreenAddition() {
        const addScreenBtn = this.editForm.querySelector('#addScreen');
        const screenInput = this.editForm.querySelector('#screenInput');

        if (addScreenBtn && screenInput) {
            // Gestionnaire pour le bouton d'ajout
            addScreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addScreen(screenInput);
            });

            // Gestionnaire pour la touche Enter
            screenInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addScreen(screenInput);
                }
            });
        }
    }

    addScreen(input) {
        const screenName = input.value.trim();
        if (screenName && !this.screens.has(screenName)) {
            this.screens.add(screenName);
            
            const screensList = this.editForm.querySelector('#screensList');
            const badge = document.createElement('div');
            badge.className = 'badge bg-primary me-2 mb-2';
            badge.innerHTML = `
                ${screenName}
                <button type="button" class="btn-close btn-close-white ms-2" aria-label="Supprimer"></button>
            `;
            
            badge.querySelector('.btn-close').addEventListener('click', () => 
                this.removeScreen(badge, screenName)
            );
            
            screensList.appendChild(badge);
            input.value = '';

            console.log('Écran ajouté:', screenName);
            console.log('Liste actuelle des écrans:', Array.from(this.screens));
        }
    }

    removeScreen(badge, screenName) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet écran ? Toutes les non-conformités associées seront également supprimées.')) {
            this.screens.delete(screenName);
            badge.remove();
            console.log('Écran supprimé:', screenName);
            console.log('Liste actuelle des écrans:', Array.from(this.screens));
        }
    }

    loadExistingScreens() {
        if (!this.editForm) return;

        const screensList = this.editForm.querySelector('#screensList');
        if (screensList) {
            // Vider d'abord this.screens
            this.screens.clear();
            
            screensList.querySelectorAll('.badge').forEach(badge => {
                const screenName = badge.textContent.trim().replace(/×$/, '').trim();
                if (screenName) {
                    this.screens.add(screenName);
                    
                    let closeBtn = badge.querySelector('.btn-close');
                    if (!closeBtn) {
                        closeBtn = document.createElement('button');
                        closeBtn.className = 'btn-close btn-close-white ms-2';
                        closeBtn.setAttribute('type', 'button');
                        closeBtn.setAttribute('aria-label', 'Supprimer');
                        badge.appendChild(closeBtn);
                    }

                    closeBtn.addEventListener('click', () => this.removeScreen(badge, screenName));
                }
            });

            console.log('Écrans chargés:', Array.from(this.screens));
        }
    }

    async handleEditSubmit(e) {
        e.preventDefault();
        console.log('Soumission du formulaire');
        
        const submitBtn = this.editForm.querySelector('button[type="submit"]');
        const spinner = submitBtn.querySelector('.spinner-border');

        try {
            submitBtn.disabled = true;
            spinner?.classList.remove('d-none');

            // Récupération et validation des données
            const formData = {
                name: this.editForm.querySelector('#editProjectName').value.trim(),
                url: this.editForm.querySelector('#editProjectUrl').value.trim(),
                referential: this.editForm.querySelector('#editReferential').value,
                referentialVersion: this.editForm.querySelector('#editReferentialVersion').value,
                screens: Array.from(this.screens)
            };

            console.log('Données à envoyer:', formData);

            // Validation côté client
            if (!formData.name) {
                throw new Error('Le nom du projet est requis');
            }

            // Envoi de la requête avec fetch
            const response = await fetch(this.editForm.action, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            console.log('Statut de la réponse:', response.status);
            const data = await response.json();
            console.log('Réponse du serveur:', data);

            if (!data.success) {
                throw new Error(data.message || 'Erreur lors de la mise à jour');
            }

            if (data.success) {
                // Récupérer le paramètre pageId de l'URL actuelle
                const urlParams = new URLSearchParams(window.location.search);
                const pageId = urlParams.get('pageId');
                
                // Recharger la page en préservant le paramètre pageId
                if (pageId) {
                    window.location.href = `${window.location.pathname}?pageId=${pageId}`;
                } else {
                    window.location.reload();
                }
            }

        } catch (error) {
            console.error('Erreur lors de la soumission:', error);
            
            // Affichage de l'erreur
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
            alertDiv.style.zIndex = '9999';
            alertDiv.textContent = error.message;
            document.body.appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 5000);
        } finally {
            submitBtn.disabled = false;
            spinner?.classList.add('d-none');
        }
    }
}

// Initialisation
new ProjectHandler();