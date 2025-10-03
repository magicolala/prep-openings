# prep-openings

Application web pour préparer et explorer des ouvertures d’échecs. Le projet est basé sur Vite + React + TypeScript et déployé automatiquement sur GitHub Pages via GitHub Actions.

## 🚀 Fonctionnalités prévues

- Visualisation d’un échiquier interactif.
- Gestion et analyse de lignes d’ouverture.
- Suggestions de coups et statistiques par variante.
- Export/import de répertoires au format PGN.

## 🧰 Stack technique

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- TypeScript
- ESLint, Prettier
- GitHub Actions pour CI/CD (build, lint, déploiement sur GitHub Pages)

## 📦 Prérequis

- Node.js 18+
- pnpm (recommandé) ou npm

## ▶️ Démarrage

```bash
pnpm install
pnpm run dev
```

L’application est ensuite accessible sur [http://localhost:5173](http://localhost:5173).

## 🧪 Qualité

| Commande              | Description                          |
| --------------------- | ------------------------------------ |
| `pnpm run lint`       | Exécute ESLint sur le projet         |
| `pnpm run typecheck`  | Lancement des vérifications TS       |
| `pnpm run test`       | Lance la suite de tests (Vitest)     |
| `pnpm run build`      | Build de production                  |

## 🌐 Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` déclenche les étapes suivantes pour chaque push sur `main` ou déclenchement manuel:

1. Installation des dépendances et cache pnpm.
2. Lint avec autofix puis vérification qu’aucune correction n’est requise.
3. Build de l’application.
4. Publication de l’artefact et déploiement sur GitHub Pages.

## 🗂️ Structure du projet

```
.
├── public/                 # Assets statiques
├── src/
│   ├── assets/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   └── App.tsx
├── .github/workflows/      # Pipelines CI/CD
├── AGENTS.md               # Consignes de contribution
└── README.md               # Ce fichier
```

## 🤝 Contribution

1. Créer une branche `feature/<slug>` ou `fix/<slug>`.
2. Implémenter la fonctionnalité ou correction.
3. S’assurer que lint, typecheck, tests et build passent.
4. Ouvrir une PR en suivant les guidelines de `AGENTS.md`.

## 📄 Licence

Ce projet est distribué sous licence MIT. Voir [LICENSE](LICENSE) si présent.
