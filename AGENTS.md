# AGENTS.md

Ce document explique comment travailler efficacement sur **prep-openings** (préparation d’ouvertures d’échecs).
Il couvre l’environnement de développement, les commandes de qualité, ainsi que les attentes autour des PRs.

---

## 🛠️ Environnement de dev

- **Naviguer dans le repo**
  - `pnpm install` pour installer les dépendances du workspace.
  - `pnpm dlx turbo run where <package_name>` pour localiser rapidement un package si le repo grandit.
  - `pnpm --filter <package_name> run dev` pour lancer le mode dev ciblé.

- **Créer / brancher un package**
  - `pnpm create vite@latest <package_name> -- --template react-ts` pour un package React + TS tout prêt.
  - `pnpm install --filter <package_name>` pour l’ajouter au workspace (Vite/ESLint/TS le verront).
  - Vérifier le champ `"name"` dans `packages/<package_name>/package.json`.

- **TypeScript, lint, format**
  - `pnpm lint` exécute ESLint (et TS si configuré).
  - `pnpm typecheck` exécute les checks TypeScript.
  - `pnpm format` applique Prettier.

- **Variables d’environnement**
  - Créer un `.env.local` dans chaque package si besoin (ne jamais le committer).
  - Préfixer Vite: `VITE_*` pour exposer au client.
  - Exemple:
    ```
    VITE_API_BASE_URL=https://api.example.com
    ```

---

## ✅ Tests & Qualité

- **Plan CI**
  - Les workflows sont dans `.github/workflows` (build, lint, typecheck, test). Reproduire les mêmes checks en local.

- **Lancer la suite**
  - Tout le repo: `pnpm test`
  - Un package: `pnpm turbo run test --filter <package_name>`
  - Depuis la racine du package: `pnpm test`

- **Focus d’un test (Vitest)**
  - Par nom: `pnpm vitest run -t "<test name>"`
  - Par fichier: `pnpm vitest run path/to/file.test.ts`

- **Type errors & lint**
  - Après refactor ou move d’imports:
    - `pnpm lint --filter <package_name>`
    - `pnpm typecheck --filter <package_name>`
  - Corriger jusqu’à obtenir un vert complet.

- **Règle d’or**
  - Toute modification de code doit s’accompagner de tests pertinents.

---

## 🚀 Build & Preview

- `pnpm build` pour builder tout le repo.
- `pnpm build --filter <package_name>` pour un package spécifique.
- `pnpm --filter <package_name> run dev` pour lancer le serveur dev.
- `pnpm --filter <package_name> run preview` après un build si configuré.

---

## 📦 Données & APIs (ouvertures d’échecs)

- Sources possibles: Chess.com, Lichess (historique, stats). Respecter leurs limites d’API.
- Prévoir un cache local si scraping/agrégation.
- Ne jamais committer de clé API. Utiliser `.env.local`.

---

## 🔁 PR Guidelines

- **Titre**
  - `[<package_name>] <titre clair>` (ex: `[ui-app] Fix board highlight`)

- **Commits**
  - Conventional commits recommandés (`feat:`, `fix:`, `docs:`, `chore:`, …).

- **Avant de pousser**
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build` si impact runtime/build.

- **Contenu de la PR**
  - Contexte + captures/gifs si UI.
  - Liste des changements et impact UX/perf si pertinent.
  - Checklist des tests effectués.

---

## 🧭 Branches

- `feature/<slug>` pour les features
- `fix/<slug>` pour les bugs
- `chore/<slug>` pour l’outillage/infra

---

## 🔍 Débogage rapide

- **Vite ne voit pas un package**: vérifier `pnpm install --filter <package_name>` et le champ `"name"`.
- **Types cassés**: `pnpm typecheck --filter <package_name>` puis corriger les imports.
- **Tests flakys**: exécuter `pnpm vitest run --reporter=verbose` et isoler avec `-t`.
- **ESLint hurle**: `pnpm lint --filter <package_name>` et ajuster la config locale.

---

## ✅ Checklist PR rapide

- Lint OK
- Typecheck OK
- Tests unitaires OK
- Pas de secrets committés
- Docs/README/AGENTS.md mis à jour si besoin
