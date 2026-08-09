# 🛠️ feat(debug): URL-driven debug view modes

> [!NOTE]
> Ajoute trois modes d'affichage choisis via l'URL : un mode **production propre** par défaut, et deux modes **diagnostic** (`?debug`, `?debug-fly`) pour inspecter la scène pendant le développement.

---

## 🇫🇷 Français

### ✨ Ce que ça fait

| URL | Mode | Affichage |
|---|---|---|
| `/` | `default` | **Scène seule.** Caméra positionnée sur le stop `Home`. Aucun HUD, aucun contrôle. |
| `/?debug` | `tour` | Scène + HUD `TourControls` (boutons pour passer d'un `CameraStop_*` à l'autre). |
| `/?debug-fly` | `fly` | **Navigation libre première personne** (souris + clavier), pas de HUD. |

> [!IMPORTANT]
> Le mode `default` est ce qui sera servi en production. `?debug` et `?debug-fly` sont des **outils de diagnostic uniquement** — jamais exposés aux visiteurs.

### 🤔 Pourquoi

Pendant l'investigation du bug *"boutons visibles, scène invisible"*, on avait besoin d'un moyen reproductible d'inspecter la scène sous différents angles **sans toucher au code**. Plutôt que de bricoler un flag à modifier à la main :

- **`?debug-fly`** permet de "rentrer" physiquement dans la scène et confirmer que la géométrie est bien chargée.
- **`?debug`** exerce le tour caméra dans son contexte HUD complet.
- **`/`** reste propre — aucun outil de debug qui fuite en prod.

### ⚙️ Implémentation

**`src/composables/useViewMode.ts`** lit `window.location.search` *une seule fois* au chargement du module et renvoie le mode comme une `const` (pas un `ref` réactif).

> [!TIP]
> **Changer de mode = recharger la page.** Décision volontaire : `<KeyboardControls>` installe un *pointer-lock* navigateur et des listeners DOM globaux. Les démonter/remonter à chaud peut laisser des listeners orphelins ou un pointer-lock coincé. Un reload garantit un état propre.

**`src/components/PortfolioScene.vue`** branche sur le mode :
- `tour` → monte `<TourControls>`.
- `fly` → monte `<KeyboardControls>` de `@tresjs/cientos` (qui embarque déjà `PointerLockControls` + le mapping clavier).
- `default` → rien d'extra, juste la scène.

### ⌨️ Support AZERTY / QWERTY

Géré gratuitement par cientos via **`event.code`** (position physique de la touche), pas `event.key` (caractère produit). En pratique : la touche en haut-gauche du bloc lettres avance la caméra, **qu'elle soit étiquetée `W` (QWERTY) ou `Z` (AZERTY)**. Les flèches fonctionnent aussi.

### 📂 Fichiers

- 🆕 **`src/composables/useViewMode.ts`** — nouveau, 25 lignes. Résolveur d'URL.
- ✏️ **`src/components/PortfolioScene.vue`** — remplace l'ancien flag `freeLook` par le branchement sur `mode`, ajoute l'overlay de hint pour le mode fly.
- 📖 **`CLAUDE.md`** — section *"View modes"* pour les futures sessions Claude Code.
- ⚙️ **`.gitignore`** — ajustement mineur.

### ✅ Comment tester

- [ ] `pnpm dev`
- [ ] Visiter `localhost:5173/` → scène propre, aucun bouton.
- [ ] Visiter `localhost:5173/?debug` → HUD `TourControls` visible.
- [ ] Visiter `localhost:5173/?debug-fly` → overlay de hint visible.
- [ ] En mode fly : cliquer sur le canvas, se déplacer avec `WASD`/`ZQSD`, regarder à la souris, `Esc` pour relâcher.
- [ ] `pnpm type-check` → vert.

### 🐛 Suite (hors de ce PR)

> [!WARNING]
> Les modes `default` et `?debug` partagent un **bug existant** : la caméra rendue n'est pas celle qu'on déclare (probable conflit d'activation avec les caméras importées du `.glb`). Ce PR fournit `?debug-fly` comme **source de vérité** pour confirmer que la géométrie est bien là — la correction du bug viendra dans un PR séparé.

---

## 🇬🇧 English

### ✨ What it does

| URL | Mode | Renders |
|---|---|---|
| `/` | `default` | **Scene only.** Camera snaps to the `Home` stop. No HUD, no controls. |
| `/?debug` | `tour` | Scene + `TourControls` HUD (buttons to step between `CameraStop_*` cameras). |
| `/?debug-fly` | `fly` | **Free first-person navigation** (mouse + keyboard), no HUD. |

> [!IMPORTANT]
> `default` is what ships to production. `?debug` and `?debug-fly` are **diagnostic tools only** — never exposed to visitors.

### 🤔 Why

While investigating the *"buttons visible, scene invisible"* bug, we needed a reproducible way to inspect the scene from arbitrary angles **without editing code**. Instead of toggling a flag by hand:

- **`?debug-fly`** lets us physically walk into the scene to confirm geometry actually loaded.
- **`?debug`** exercises the camera tour in its full HUD context.
- **`/`** stays clean — no debug tooling leaking into prod.

### ⚙️ Implementation

**`src/composables/useViewMode.ts`** reads `window.location.search` *once* at module load and returns the mode as a `const` (not a reactive `ref`).

> [!TIP]
> **Switching modes = page reload.** Deliberate: `<KeyboardControls>` installs a browser *pointer-lock* and global DOM listeners. Tearing them down and re-mounting mid-session can leak listeners or strand the pointer-lock. A reload guarantees a clean state.

**`src/components/PortfolioScene.vue`** branches on mode:
- `tour` → mounts `<TourControls>`.
- `fly` → mounts `<KeyboardControls>` from `@tresjs/cientos` (already bundles `PointerLockControls` + keyboard mapping).
- `default` → nothing extra, just the scene.

### ⌨️ AZERTY / QWERTY support

Handled for free by cientos via **`event.code`** (physical key position), not `event.key` (the character produced). In practice: the top-left letter-block key moves forward **whether it's labeled `W` (QWERTY) or `Z` (AZERTY)**. Arrow keys work too.

### 📂 Files

- 🆕 **`src/composables/useViewMode.ts`** — new, 25 lines. URL resolver.
- ✏️ **`src/components/PortfolioScene.vue`** — replaces the old `freeLook` flag with `mode` branching, adds the fly-mode hint overlay.
- 📖 **`CLAUDE.md`** — *"View modes"* section for future Claude Code sessions.
- ⚙️ **`.gitignore`** — minor tweak.

### ✅ How to test

- [ ] `pnpm dev`
- [ ] Visit `localhost:5173/` → clean scene, no buttons.
- [ ] Visit `localhost:5173/?debug` → `TourControls` HUD visible.
- [ ] Visit `localhost:5173/?debug-fly` → hint overlay visible.
- [ ] In fly mode: click the canvas, move with `WASD`/`ZQSD`, look with the mouse, `Esc` to release.
- [ ] `pnpm type-check` → green.

### 🐛 Follow-up (out of scope for this PR)

> [!WARNING]
> `default` and `?debug` share an **existing bug**: the rendered camera isn't the one we declare (likely an activation conflict with cameras imported from the `.glb`). This PR ships `?debug-fly` as the **ground truth** for confirming geometry is there — the bug fix will land in a separate PR.
