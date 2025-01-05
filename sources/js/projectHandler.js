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