# Auditeur RGAA/WCAG

Application d'audit d'accessibilité web permettant de tester la conformité aux référentiels RGAA et WCAG tout en automatisant un maximum de tâches.

## Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Base de données](#base-de-données)
- [Intelligence Artificielle](#intelligence-artificielle)
- [Interface utilisateur](#interface-utilisateur)
- [API](#api)
- [Gestion des erreurs](#gestion-des-erreurs)
- [Tests](#tests)
- [Déploiement](#déploiement)

## Prérequis

- Node.js (v14 ou supérieur)
- NPM (v6 ou supérieur)
- SQLite3

## Installation

1. Cloner le repository :
```bash
git clone https://github.com/xavier-egoneau/audit-access.git
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
Créer un fichier `.env` à la racine du projet :
```env
PORT=3000
NODE_ENV=development
```

4. Lancer l'application :
```bash
npm run dev
```

## Structure du projet

```
.
├── database/            # Bases de données SQLite des projets
├── data/                # Bdd pour l'apprentissage des suggestions
├── public/              # Fichiers statiques
│   ├── assets/          # CSS et JS compilés
│   └── uploads/         # Screenshots des non-conformités
├── models/              # Modèles de données
├── services/            # Services métier
├── views/               # Templates Twig
│   └── partials/        # Composants réutilisables
│   └── audit/           # Templates Twig
├── sources/             # Sources js & scss + gulp process
│   └── js/              # js
│   └── scss/            # scss
│   └── tasks/           # tasks gulp
├── app.js               # Point d'entrée de l'application
└── package.json
└── criteres_rgaa.xml
└── criteres_wcag.xml
```


## Fonctionnalités

### Gestion des projets
- Création de nouveaux projets d'audit
- Configuration du référentiel (RGAA/WCAG)
- Gestion multi-pages
- Suppression de projets

### Audit
- Test des critères RGAA/WCAG
- Gestion des statuts (C, NC, NA, NT)
- Documentation des non-conformités
- Calcul automatique des taux de conformité
- Screenshots des non-conformités
- Quick wins et suggestions

### Intelligence Artificielle
- Apprentissage à partir des non-conformités
- Suggestions contextuelles
- Feedback sur les suggestions
- Amélioration continue des recommandations

## Base de données

### Tables principales (par projet)
- `project_info` : Informations du projet
- `pages` : Pages auditées
- `audit_results` : Résultats des tests
- `non_conformities` : Non-conformités documentées

### Base de données d'apprentissage
- `learning_patterns` : Patterns d'apprentissage
- `learning_suggestions` : Suggestions générées
- `learning_feedback` : Retours utilisateurs
- `learning_metrics` : Métriques d'apprentissage

## Intelligence Artificielle

### Fonctionnement
1. Analyse des patterns dans les non-conformités
2. Génération de suggestions contextuelles
3. Apprentissage à partir des retours utilisateurs
4. Amélioration continue des suggestions

### API d'apprentissage
```javascript
/api/learning/suggestions/:criterionId
/api/learning/metrics/:criterionId
/api/feedback
```

## Interface utilisateur

### Composants principaux
- Grille des critères
- Formulaires de non-conformité
- Suggestions IA
- Modales de gestion

### Technologies frontend
- Bootstrap 5
- Twig
- JavaScript natif
- Gulp pour la compilation

## API

### Endpoints principaux
```
POST    /audit/new              # Création de projet
POST    /audit/:projectId/nc    # Ajout de non-conformité
DELETE  /audit/:projectId       # Suppression de projet
GET     /audit/:projectId       # Affichage audit
```

### API d'apprentissage
```
GET     /api/learning/suggestions/:criterionId
GET     /api/learning/metrics/:criterionId
POST    /api/feedback
```

## Gestion des erreurs

- Gestion des erreurs de base de données
- Validation des entrées utilisateur
- Messages d'erreur contextuels
- Logs des erreurs

## Structure des XML et gestion des versions

> ⚠️ La structure actuelle des XML est fonctionnelle mais pourrait être enrichie, notamment avec l'ajout de cas particuliers et de tests spécifiques.

### Format des fichiers XML

#### Structure générale
```xml
<CRITERES version="4.1">
    <Critere id="1.1">
        <Titre>Chaque image a-t-elle une alternative textuelle ?</Titre>
        <NiveauWCAG>A</NiveauWCAG>
        <Tests>
            <Test id="1.1.1">
                <Description>...</Description>
                <Methodologie>
                    <Etape>Repérer les images</Etape>
                    <Etape>Vérifier la présence d'alternative</Etape>
                </Methodologie>
            </Test>
        </Tests>
    </Critere>
</CRITERES>

## Tests

Pour lancer les tests :
```bash
npm test
```

## Déploiement

1. Construire les assets :
```bash
gulp build
```

2. Variables d'environnement de production :
```env
NODE_ENV=production
PORT=3000
```

3. Lancer en production :
```bash
npm start
```

## Maintenance

### Mise à jour des dépendances
Régulièrement, mettre à jour les dépendances :
```bash
npm update
```

### Backup des données
Sauvegarder régulièrement le dossier `database/` et `public/uploads/`

## Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Consulter la documentation technique dans le code
- Vérifier les logs d'erreur

## Roadmap

- [ ] Support multi-utilisateurs
- [ ] Export PDF des rapports
- [ ] API REST complète
- [ ] Tests automatisés
- [ ] Mode hors-ligne