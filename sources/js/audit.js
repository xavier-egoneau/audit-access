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
            console.log("Recherche modal avec ID:", modalId);
            
            const modal = document.getElementById(modalId);
            if (!modal) {
                console.error('Modal non trouvée. Modales disponibles:', 
                    Array.from(document.querySelectorAll('.modal')).map(m => m.id)
                );
                return;
            }
        
            const form = modal.querySelector('form');
            if (!form) {
                console.error('Formulaire non trouvé dans la modal');
                return;
            }
            // Vérifions que tous les champs nécessaires existent
            const fields = {
                ncId: form.querySelector('[name="ncId"]'),
                criterionId: form.querySelector('[name="criterionId"]')
            };
            // Log de debug pour voir quels champs sont trouvés
            console.log("Champs trouvés dans le formulaire:", {
                ncId: !!fields.ncId,
                criterionId: !!fields.criterionId
            });

            // Vérification avant assignation
            if (!fields.ncId || !fields.criterionId) {
                console.error('Champs manquants dans le formulaire');
                return;
            }
            fields.ncId.value = ncId;
            fields.criterionId.value = criterionId;

            // Configuration de la modal pour l'édition
            modal.querySelectorAll('.mode-create').forEach(el => el.style.display = 'none');
            modal.querySelectorAll('.mode-edit').forEach(el => el.style.display = 'inline');
            modal.querySelectorAll('.create-mode-field').forEach(el => el.style.display = 'none');
    
            // Récupérer toutes les données de la carte
            const ncData = {
                impact: card.querySelector('h5.card-title + p')?.textContent?.trim(),
                description: card.querySelector('h5.card-text + p')?.textContent?.trim(),
                solution: card.querySelector('h5.card-title:last-of-type + p')?.textContent?.trim(),
                screenshot: card.querySelector('img.card-img-top')?.src
            };
            console.log("Données de la NC à éditer:", ncData);
    
            try {
                // Remplir les champs cachés
                const ncIdInput = form.querySelector('[name="ncId"]');
                const criterionIdInput = form.querySelector('[name="criterionId"]');
                const impactInput = form.querySelector('[name="impact"]');
                const descriptionInput = form.querySelector('[name="description"]');
                const solutionInput = form.querySelector('[name="solution"]');
    
                console.log("Champs trouvés:", {
                    ncId: !!ncIdInput,
                    criterionId: !!criterionIdInput,
                    impact: !!impactInput,
                    description: !!descriptionInput,
                    solution: !!solutionInput
                });
    
                if (ncIdInput) ncIdInput.value = ncId;
                if (criterionIdInput) criterionIdInput.value = button.dataset.criterionId;
                if (impactInput) impactInput.value = ncData.impact || '';
                if (descriptionInput) descriptionInput.value = ncData.description || '';
                if (solutionInput) solutionInput.value = ncData.solution || '';
    
                // Gérer la capture d'écran
                const currentScreenshot = form.querySelector('#current-screenshot');
                if (currentScreenshot && ncData.screenshot) {
                    currentScreenshot.innerHTML = `
                        <img src="${ncData.screenshot}" class="img-fluid mb-2" alt="Capture d'écran actuelle">
                        <small class="text-muted d-block">Capture d'écran actuelle</small>
                    `;
                }
    
                // Afficher la modal
                const modalInstance = new bootstrap.Modal(modal);
                modalInstance.show();
                modal.addEventListener('hidden.bs.modal', () => {
                    document.body.classList.remove('modal-open');
                    document.body.style.paddingRight = '';
                    document.body.style.overflow = '';
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                }, { once: true }); // L'option once:true fait que l'événement se supprime automatiquement après utilisation
    
            } catch (error) {
                console.error("Erreur lors du remplissage du formulaire:", error);
            }
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