# Handoff : UI 2D du portfolio 3D (« Lueur »)

## Overview
UI 2D minimale posée sur un portfolio dont l'interface est une chambre 3D (Blender → WebGL) visitée caméra par caméra. Deux composants seulement — une barre de menu verticale persistante (bord droit) et une « bulle » de texte par arrêt, ancrée à l'objet cadré — plus deux écrans d'entrée (pré-sélection de version, pré-loader) et le contenu CV affiché par le moniteur vertical.

## About the Design Files
Les fichiers de ce dossier sont des **références de design en HTML** — des prototypes montrant l'apparence et le comportement voulus, pas du code de production à copier. La tâche : **recréer ces designs dans l'environnement du code existant** (le front WebGL du portfolio et son overlay DOM), avec ses patterns — ou, à défaut, dans le framework le plus adapté. Le CSS des références est volontairement écrit à la main sur des custom properties (`tokens.css`) : c'est la forme attendue par le projet (tokens, pas d'utilitaires).

## Fidelity
**High-fidelity.** Couleurs, typo, espacements, positions et états sont finaux — recréer au pixel. Seuls les contenus CV (postes, missions) et les textes de bulles sont des placeholders à remplacer par les vrais contenus (bilingues FR/EN ; prévoir +15–20 % de longueur en FR).

## Screens / Views
Un fichier par écran dans `screens/` (ouvrables tels quels dans un navigateur) :

| Fichier | Rôle |
|---|---|
| 0a-preselection.html | Choix « Expérience 3D » (halo par défaut) vs « classique » ; choix mémorisé |
| 0b-preloader.html | Logo en respiration + barre de chargement 340×2 px + microcopie |
| home.html | Arrêt d'accueil — bulle centrée bas, une ligne, point sans titre |
| 01-desk.html … 10-moon.html | Les 10 autres arrêts — bulle positionnée par arrêt (table dans DESIGN.md) |
| 02-cv.html | + contenu CV « à l'écran » : photo, langues/permis, accordéon des postes (hover) |

Anatomie détaillée des deux composants, placements par arrêt, états et variantes : **voir DESIGN.md** (source de vérité).

## Interactions & Behavior
- **Bulle** : 2 états (présente/absente). In : 480 ms reveal bas→haut (clip) — jouer l'animation sur un wrapper pour les variantes transformées (--centered, --tilted). Out : fade 200 ms avant le départ caméra (1 200 ms). Jamais d'opacité indexée sur le scroll. Suit l'objet ancré à l'écran (projection 3D→2D côté app).
- **Barre** : opacité .4 au repos → .75 au :hover/:focus-within (180 ms). Item actif = cartouche + point accent. Toggle FR/EN en bas. Tab/↑↓ au clavier.
- **CV** : cartouches accordéon — :hover/:focus-within ouvre les missions (max-height, 260 ms).
- **Pré-sélection** : la carte 3D porte le halo d'office ; l'autre le gagne au survol. Choix persisté (localStorage) et modifiable depuis le menu.
- La racine de l'overlay est `pointer-events: none` (la molette pilote la caméra) ; seuls barre et CV réactivent les événements — tranché avec #47 : aucune bulle n'est interactive, `.bubble--interactive` reste une spécification dormante (voir DESIGN.md).

## State Management
- `lang: 'fr' | 'en'` — bascule tout le texte (bulles, menu, CV).
- `currentStop` — pilote la bulle affichée et l'état actif du menu.
- `openJob: index | null` — accordéon CV (hover/focus).
- `experience: '3d' | 'classic'` — choix de la pré-sélection, persisté.
- `loadProgress: 0–100` — largeur du fill du preloader (transition 300 ms).

## Design Tokens
Tout est dans `tokens.css` (custom properties commentées) et résumé en tables dans DESIGN.md : palette pipette (#18110C verre, #EFE5D3 crème, #8FDBE4 accent, #6FD8E6 halo), échelle 4→48, rayons 10/18/26, z 0/100/200/300, budgets motion 140→1200 ms.

## Assets
Les fonds sont les rendus Blender déjà versionnés dans **`docs/renders/refs/`** (11 arrêts, 1280×720, calibrés comme le rendu WebGL) — la session design travaillait sur des exports 1920×1080 des mêmes cadrages, repointés ici pour qu'un seul jeu de rendus fasse foi. Les maquettes les posent en `center / cover`, donc la résolution est indifférente ; re-shooter `refs/` après un nouvel export Blender met les maquettes à jour toutes seules. Dans l'app réelle, le canvas WebGL remplace ces fonds. La photo du CV est un placeholder (encart hachuré) à remplacer.

## Files
- `DESIGN.md` — direction, tokens, anatomie, placements, budgets motion (source de vérité)
- `tokens.css` — tokens + composants .bubble / .menu (CSS main, prêt à adapter)
- `screens/*.html` — 13 écrans de référence autonomes
- fonds : `../renders/refs/*.png` (versionnés, partagés avec la boucle de comparaison)
