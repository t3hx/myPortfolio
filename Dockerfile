# Portfolio 3D — image de service du build statique (issue #16).
#
# Le build se fait ICI, jamais sur le VPS : GitHub Actions construit et pousse
# sur GHCR, Dokploy tire et redémarre. L'image finale ne contient donc aucun
# outillage Node — seulement nginx et `dist/`.

# ── Étage de build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# pnpm vient de `packageManager` dans package.json : une seule déclaration de
# version, celle que corepack applique. Épingler la version ailleurs la ferait
# diverger du lockfile au premier bump.
RUN corepack enable

# Les manifestes d'abord : tant que les dépendances ne bougent pas, cette couche
# est réutilisée telle quelle et l'installation n'est pas rejouée.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# `build` seul : lint, types et tests sont le travail de la CI, qui tourne AVANT
# ce build (le job `deploy` de ci.yml dépend de `verify`). Les rejouer ici
# doublerait le temps de mise en ligne sans rien vérifier de plus.
#
# `version.json` est la preuve de mise en ligne : la CI passe la version
# calculée (`vX.Y.Z`) en build-arg, puis interroge ce fichier sur la prod
# jusqu'à ce qu'il annonce cette version. Il n'y a ni secret ni configuration
# dedans, seulement un numéro.
# Le `chmod` vit ICI et pas après la copie : `COPY` conserve les modes du
# contexte, et un `RUN chmod` dans l'étage final réécrirait toute la couche —
# mesuré, 5,7 Mo d'image en plus pour rien.
#
# Et ce n'est pas de la précaution : le `.glb` du poste de développement était
# en 600, l'image le servait donc en 403, alors qu'un `checkout` de CI l'écrit
# en 644 selon son umask. Le défaut n'apparaît que sur certaines machines, ce
# qui est la pire façon d'échouer.
# `a+rX` : lecture pour tous, traversée seulement là où elle existe déjà — les
# dossiers restent traversables, les fichiers ne deviennent pas exécutables.
ARG APP_VERSION=dev
RUN pnpm build \
 && printf '{"version":"%s"}\n' "$APP_VERSION" > dist/version.json \
 && chmod -R a+rX dist

# ── Étage de service ─────────────────────────────────────────────────────────
# `alpine-slim` et non `alpine` : ~12 Mo contre ~50, et rien de ce que la
# variante complète ajoute (modules perl, njs, images) ne sert à servir un
# dossier de fichiers.
FROM nginx:1.27-alpine-slim
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Le décodeur draco (`public/draco/`) et le modèle (`public/models/scene.glb`)
# sont copiés tels quels par Vite depuis `public/` : ils arrivent donc dans
# `dist/` sans règle particulière. Le `.glb` est suivi par git DEPUIS #16 —
# gitignoré, il manquait au `checkout` de la CI et l'image partait avec une
# scène vide, sans que rien n'échoue.

EXPOSE 80
