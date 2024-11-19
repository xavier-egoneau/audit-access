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

    document.addEventListener('click', async function(e) {
        // Gestion du bouton supprimer
        if (e.target.matches('.delete-nc')) {
            console.log("Clic sur supprimer détecté");
            const ncId = e.target.dataset.ncId;
            console.log("NC ID:", ncId);
            
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
                        card.style.transition = 'opacity 0.3s ease';
                        card.style.opacity = '0';
                        setTimeout(() => card.remove(), 300);
                    }
                } else {
                    throw new Error(data.message || 'Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                alert('Erreur lors de la suppression: ' + error.message);
            }
        }
    
        // Gestion du bouton modifier
        // Dans audit.js, dans la gestion du clic
        if (e.target.matches('.card-link.btn.btn-outline-primary')) {
            console.log("Clic sur modifier détecté");
            const card = e.target.closest('.card');
            if (!card) return;
            
            const ncId = e.target.dataset.ncId;
            console.log("NC ID pour modification:", ncId);
            
            // Récupérer les données actuelles de la NC
            const impactEl = card.querySelector('h5.card-title + p');
            const descriptionEl = card.querySelector('h5.card-text + p');
            const solutionEl = card.querySelector('h5.card-title:last-of-type + p');
            const screenshotEl = card.querySelector('img.card-img-top');
            const wrapper = card.closest('[data-criterion-id]');
            const criterionId = wrapper ? wrapper.dataset.criterionId : null;

            // Remplir le formulaire
            document.getElementById('editNcId').value = ncId;
            document.getElementById('editCriterionId').value = criterionId;
            document.getElementById('edit-impact').value = impactEl ? impactEl.textContent.trim() : '';
            document.getElementById('edit-description').value = descriptionEl ? descriptionEl.textContent.trim() : '';
            document.getElementById('edit-solution').value = solutionEl ? solutionEl.textContent.trim() : '';

            // Afficher l'image actuelle si elle existe
            const currentScreenshot = document.getElementById('current-screenshot');
            currentScreenshot.innerHTML = '';
            if (screenshotEl) {
                currentScreenshot.innerHTML = `
                    <img src="${screenshotEl.src}" class="img-fluid mb-2" alt="Capture d'écran actuelle">
                    <small class="text-muted d-block">Capture d'écran actuelle</small>
                `;
            }

            // Ouvrir la modale
            const editModal = new bootstrap.Modal(document.getElementById('editnc'));
            editModal.show();
        }
    });

    
    // Initialisation des dropdowns
    const dropdownElementList = document.querySelectorAll('.dropdown-toggle');
    const dropdownList = [...dropdownElementList].map(dropdownToggleEl => 
        new bootstrap.Dropdown(dropdownToggleEl)
    );

    document.querySelectorAll('.modal').forEach(modalElement => {
        new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
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

    // Dans audit.js, ajouter dans le DOMContentLoaded
    /*const deleteProjectBtn = document.getElementById('deleteProjectBtn');
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

                const data = await response.json();

                if (data.success) {
                    // Rediriger vers la page d'accueil
                    window.location.href = '/';
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la suppression du projet');
            } finally {
                this.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }
*/


    // Dans audit.js, ajouter ceci
// Dans audit.js, cherchez la partie qui ressemble à ceci :

document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(button => {
    const targetId = button.getAttribute('data-bs-target');
    const target = document.querySelector(targetId);
    if (!target) return;

    target.addEventListener('show.bs.collapse', async function() {
        const criterionId = button.getAttribute('data-bs-target')
                              .replace('#collapse-', '')  
                              .replace('-', '.'); 
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

                    if (window.FormHandler) {
                        const deleteButtons = wrapper.querySelectorAll('.delete-nc');
                        deleteButtons.forEach(button => {
                            if (!button.dataset.handlerAttached) {
                                const formHandler = new FormHandler(document.querySelector('form.nc-form'));
                                formHandler.setupDeleteHandler(button);
                            }
                        });
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