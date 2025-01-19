class AutoCheck {
    constructor() {
        this.modal = null;
        this.progressBar = document.querySelector('#autoCheckModal .progress-bar');
        this.resultsContainer = document.getElementById('autoCheckResults');
        this.button = document.getElementById('autoCheckButton');
        this.closeButtons = document.querySelectorAll('#autoCheckModal .btn-close, #autoCheckModal .btn-secondary');
        
        if (this.button) {
            this.button.addEventListener('click', () => this.startCheck());
        }

        // Initialiser la modal avec Bootstrap
        const modalElement = document.getElementById('autoCheckModal');
        if (modalElement) {
            this.modal = new bootstrap.Modal(modalElement, {
                keyboard: true,
                backdrop: 'static'
            });

            // Gestionnaire pour la fermeture
            this.closeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    this.modal.hide();
                });
            });
        }
    }

    updateRates(rates) {
        if (rates.currentRate !== undefined) {
            const currentRateElement = document.getElementById('taux_conform_pa');
            if (currentRateElement) {
                currentRateElement.textContent = `${rates.currentRate}%`;
            }
        }

        if (rates.averageRate !== undefined) {
            const averageRateElement = document.getElementById('taux_moyen');
            if (averageRateElement) {
                averageRateElement.textContent = `${rates.averageRate}%`;
            }
        }

        if (rates.globalRate !== undefined) {
            const globalRateElement = document.getElementById('taux_conform');
            if (globalRateElement) {
                globalRateElement.textContent = `${rates.globalRate}%`;
            }
        }
    }

    async startCheck() {
        const pageId = this.button.dataset.pageId;
        
        // Réinitialiser et afficher la modal
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
            this.progressBar.setAttribute('aria-valuenow', '0');
        }
        
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = `
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
                <p class="text-center">Analyse en cours...</p>
            `;
        }

        if (this.modal) {
            this.modal.show();
        }

        try {
            // Simuler le début de la progression
            if (this.progressBar) {
                this.progressBar.style.width = '30%';
                this.progressBar.setAttribute('aria-valuenow', '30');
            }

            const response = await fetch(`/api/autocheck/${currentProjectId}/${pageId}`, {
                method: 'POST'
            });

            // Progression à 60%
            if (this.progressBar) {
                this.progressBar.style.width = '60%';
                this.progressBar.setAttribute('aria-valuenow', '60');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Une erreur est survenue');
            }

            // Progression à 90%
            if (this.progressBar) {
                this.progressBar.style.width = '90%';
                this.progressBar.setAttribute('aria-valuenow', '90');
            }

            // Mettre à jour l'interface avec les résultats
            let resultsHtml = '<div class="list-group">';
            Object.entries(data.results).forEach(([criterionId, result]) => {
                const statusClass = result.status === 'C' ? 'success' : 'danger';
                const icon = result.status === 'C' ? 'check-circle' : 'exclamation-circle';
                
                resultsHtml += `
                    <div class="list-group-item list-group-item-${statusClass}">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-1">Critère ${criterionId}</h6>
                            <small>
                                <i class="fas fa-${icon}"></i>
                                ${result.status === 'C' ? 'Conforme' : 'Non Conforme'}
                            </small>
                        </div>
                        <p class="mb-1">${result.details}</p>
                    </div>
                `;

                // Mettre à jour le statut dans la grille des critères
                const select = document.querySelector(`select[data-criterion="${criterionId}"]`);
                if (select && select.value !== result.status) {
                    select.value = result.status;
                    select.dispatchEvent(new Event('change'));
                }
            });
            resultsHtml += '</div>';

            // Afficher les résultats et terminer la progression
            if (this.resultsContainer) {
                this.resultsContainer.innerHTML = resultsHtml;
            }
            if (this.progressBar) {
                this.progressBar.style.width = '100%';
                this.progressBar.setAttribute('aria-valuenow', '100');
            }

            // Mettre à jour les taux
            if (data.rates) {
                this.updateRates(data.rates);
            }

        } catch (error) {
            console.error('Erreur:', error);
            if (this.resultsContainer) {
                this.resultsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        Erreur lors de la vérification: ${error.message}
                    </div>
                `;
            }
            if (this.progressBar) {
                this.progressBar.style.width = '100%';
                this.progressBar.setAttribute('aria-valuenow', '100');
                this.progressBar.classList.remove('progress-bar-animated');
            }
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    new AutoCheck();
});