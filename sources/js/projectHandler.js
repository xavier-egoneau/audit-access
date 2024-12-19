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
                const addPageBtn = document.getElementById(`${modalId}`).querySelector('#addNewPageRow');
                if (addPageBtn) {
                    addPageBtn.addEventListener('click', () => this.addNewPageRow(modalId));
                }

                const pagesList = document.getElementById(`${modalId}`).querySelector('#pagesList');
                if (pagesList && pagesList.children.length === 0 && modalId === 'newProject') {
                    this.addNewPageRow(modalId);
                }
            });
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

        // Gestionnaire de suppression de ligne
        const deleteBtn = row.querySelector('.delete-page');
        deleteBtn.addEventListener('click', () => {
            row.remove();
            const remainingRows = pagesList.querySelectorAll('.row');
            if (remainingRows.length === 1) {
                remainingRows[0].querySelector('.delete-page').disabled = true;
            }
        });

        pagesList.appendChild(row);
        
        const allRows = pagesList.querySelectorAll('.row');
        if (allRows.length > 1) {
            allRows.forEach(r => {
                const delBtn = r.querySelector('.delete-page');
                if (delBtn) delBtn.disabled = false;
            });
        }
    }
}

new ProjectHandler();