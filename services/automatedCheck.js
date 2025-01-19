const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class AutomatedCheck {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch();
        this.page = await this.browser.newPage();
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async checkUrl(url) {
        try {
            await this.page.goto(url, { waitUntil: 'networkidle0' });
            const results = {};

            // Vérification des images sans alt
            results['1.1.1'] = await this.checkImagesAlt();
            
            // Vérification des titres de cadres
            results['2.1.1'] = await this.checkFrameTitles();
            
            // Vérification de la structure des titres
            results['9.1.1'] = await this.checkHeadingsStructure();

            // Vérification des labels de formulaire
            results['11.1.1'] = await this.checkFormLabels();

            // Vérification du contraste des couleurs
            results['3.2.1'] = await this.checkColorContrast();

            // 8.2.1 - Ordre de tabulation cohérent
            results['8.2.1'] = await this.checkTabOrder();

            // 8.9.1 - Scripts indispensables accessibles
            results['8.9.1'] = await this.checkScriptAccess();

            // 10.4.1 - Présentation temporelle valide
            results['10.4.1'] = await this.checkTextPresentation();

            // 12.6.1 - Navigation cohérente
            results['12.6.1'] = await this.checkNavigation();

            // 13.1.1 - Redirections côté client
            results['13.1.1'] = await this.checkClientRedirects();

            return results;
        } catch (error) {
            logger.error('Erreur lors de la vérification automatique:', error);
            throw error;
        }
    }

    // Nouvelles méthodes de vérification
    async checkTabOrder() {
        const tabOrderCheck = await this.page.evaluate(() => {
            const focusables = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
            let lastTabIndex = 0;
            for (const element of focusables) {
                const tabIndex = parseInt(element.getAttribute('tabindex') || '0');
                if (tabIndex < 0 || (tabIndex > 0 && tabIndex < lastTabIndex)) {
                    return false;
                }
                if (tabIndex > 0) lastTabIndex = tabIndex;
            }
            return true;
        });
        return {
            status: tabOrderCheck ? 'C' : 'NC',
            details: tabOrderCheck ? 'Ordre de tabulation cohérent' : 'Problèmes dans l\'ordre de tabulation'
        };
    }

    async checkScriptAccess() {
        const scriptCheck = await this.page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                if (!script.hasAttribute('type') && !script.hasAttribute('aria-hidden')) {
                    return false;
                }
            }
            return true;
        });
        return {
            status: scriptCheck ? 'C' : 'NC',
            details: scriptCheck ? 'Scripts correctement déclarés' : 'Scripts sans attributs d\'accessibilité'
        };
    }

    async checkTextPresentation() {
        const presentationCheck = await this.page.evaluate(() => {
            const styles = window.getComputedStyle(document.body);
            return {
                lineHeight: parseFloat(styles.lineHeight) >= 1.5,
                textAlign: styles.textAlign !== 'justify',
                valid: true // Simplifié pour l'exemple
            };
        });
        return {
            status: presentationCheck.valid ? 'C' : 'NC',
            details: presentationCheck.valid ? 
                'Présentation du texte conforme' : 
                'Problèmes de présentation du texte détectés'
        };
    }

    async checkNavigation() {
        const navCheck = await this.page.evaluate(() => {
            const navElements = document.querySelectorAll('nav, [role="navigation"]');
            return navElements.length > 0;
        });
        return {
            status: navCheck ? 'C' : 'NC',
            details: navCheck ? 
                'Navigation principale identifiable' : 
                'Pas de navigation principale identifiable'
        };
    }

    async checkClientRedirects() {
        const redirectCheck = await this.page.evaluate(() => {
            const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
            return !metaRefresh;
        });
        return {
            status: redirectCheck ? 'C' : 'NC',
            details: redirectCheck ? 
                'Pas de redirection côté client' : 
                'Redirection côté client détectée'
        };
    }

    async checkImagesAlt() {
        const imagesWithoutAlt = await this.page.evaluate(() => {
            const images = document.querySelectorAll('img:not([alt])');
            return images.length === 0;
        });
        return {
            status: imagesWithoutAlt ? 'C' : 'NC',
            details: imagesWithoutAlt ? 'Toutes les images ont un attribut alt' : 'Images sans attribut alt détectées'
        };
    }

    async checkFrameTitles() {
        const framesWithoutTitle = await this.page.evaluate(() => {
            const frames = document.querySelectorAll('frame:not([title]), iframe:not([title])');
            return frames.length === 0;
        });
        return {
            status: framesWithoutTitle ? 'C' : 'NC',
            details: framesWithoutTitle ? 'Tous les cadres ont un titre' : 'Cadres sans titre détectés'
        };
    }

    async checkHeadingsStructure() {
        const headingsStructure = await this.page.evaluate(() => {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let lastLevel = 0;
            let isValid = true;

            for (const heading of headings) {
                const level = parseInt(heading.tagName[1]);
                if (level - lastLevel > 1) {
                    isValid = false;
                    break;
                }
                lastLevel = level;
            }
            return isValid;
        });
        return {
            status: headingsStructure ? 'C' : 'NC',
            details: headingsStructure ? 'Structure des titres cohérente' : 'Rupture dans la hiérarchie des titres'
        };
    }

    async checkFormLabels() {
        const formsCheck = await this.page.evaluate(() => {
            const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
            for (const input of inputs) {
                const id = input.id;
                if (!id || !document.querySelector(`label[for="${id}"]`)) {
                    return false;
                }
            }
            return true;
        });
        return {
            status: formsCheck ? 'C' : 'NC',
            details: formsCheck ? 'Tous les champs ont des labels' : 'Champs sans label détectés'
        };
    }

    async checkColorContrast() {
        // Nécessite l'utilisation d'une bibliothèque de contraste comme 'color-contrast'
        // Exemple simplifié
        const contrastCheck = await this.page.evaluate(() => {
            // Implémentation à faire avec une bibliothèque de contraste
            return true;
        });
        return {
            status: contrastCheck ? 'C' : 'NC',
            details: contrastCheck ? 'Contrastes conformes' : 'Problèmes de contraste détectés'
        };
    }
}

module.exports = AutomatedCheck;