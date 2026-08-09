# Brief d'entrée — session Claude Design (UI 2D)

> **Statut : source de vérité pour la session Claude Design.**
> Ce document **remplace** le « Brief condensé pour la session Claude Design » du
> design doc `~/.gstack/projects/t3hx-myPortfolio/tehx-fix-rendering-design-20260804-174239.md`
> (2026-08-04). Ce brief-là a été rédigé **avant** l'export v12 et **avant** la
> validation du modèle de navigation : quatre de ses affirmations sont désormais
> fausses (§ 1). Il est volontairement autonome — le design doc vit hors du dépôt
> et ne sera donc pas ingéré avec la codebase.
>
> Dernière réconciliation avec le code : 2026-08-09.

---

## 0. Contexte en trois phrases

Portfolio personnel : une chambre 3D pré-bakée (Blender → `.glb`) sert de décor
interactif, surmontée d'une **UI 2D discrète**. L'utilisateur parcourt une visite
guidée d'arrêt caméra en arrêt caméra ; chaque arrêt met en valeur un objet et
raconte une facette de son auteur. **La 3D est le clou du spectacle : l'UI est au
service de la scène, jamais l'inverse.**

Le périmètre de cette session est **l'UI hors 3D uniquement**. La scène, les
shaders et les contours 3D sont hors périmètre.

---

## 1. Ce qui a changé depuis le brief du 2026-08-04

Quatre corrections. La première est la plus importante : elle change la sémantique
d'interaction sur laquelle reposent toutes les maquettes.

### 1.1 Le tour ne se « scrubbe » pas — un geste = un arrêt

Le brief de 2026-08-04 écrivait : *« TOURING : un scroll pendant un tween le
scrubbe (pas de blocage) »*. **C'est faux et explicitement rejeté.**

Le modèle validé par l'utilisateur (documenté dans `CLAUDE.md`, section
« Navigation model — user-validated — do not regress to scrubbing ») :

- **un geste de scroll = UN mouvement fluide vers l'arrêt suivant ou précédent**,
  piloté par un unique tween GSAP (`power3.inOut`, 1,2 s). Modèle « fullpage ».
- La molette est **possédée** (`preventDefault`, façon Lenis). Un scroll maintenu
  enchaîne arrêt par arrêt ; une impulsion sèche déplace d'exactement un arrêt.
- **Tout mouvement de « settle » après le geste a été explicitement refusé.** Pas
  de scrub, pas de snap.

Conséquence design : la position de la caméra n'est jamais « entre deux arrêts »
de façon durable. Les bulles ont donc **deux états seulement** (absente /
présente), liés à la phase `PARKED`, et pas une opacité continue indexée sur un
pourcentage de défilement.

### 1.2 Il y a 11 arrêts, pas 10 — un arrêt « CV » est apparu

L'export v12 fournit **11 caméras `CameraStop_*`**, chacune portant sa propre
focale. L'ordre de la visite est celui de `src/config/cameraStops.ts` :

| # | Arrêt (label) | Nœud Blender | Facette racontée |
|---|---|---|---|
| 1 | Home | `CameraStop_Home` | plan d'ouverture — voir § 5.1 |
| 2 | **CV** | `CameraStop_MonitorVertical` | **NOUVEAU** — « qui je suis », le parcours pro |
| 3 | Desk | `CameraStop_Desk` | le métier, l'outil de travail quotidien |
| 4 | Scoreboard | `CameraStop_Scoreboard` | mappemonde à punaises et fils : les voyages |
| 5 | Bookshelf | `CameraStop_BookshelfPlant` | lectures / influences |
| 6 | Cabinet | `CameraStop_Cabinet` | les projets pro (dossiers de la commode) |
| 7 | Cat | `CameraStop_Cat` | compagnon, touche personnelle |
| 8 | Guitar | `CameraStop_GuitarPoster` | musique |
| 9 | Posters | `CameraStop_PosterTelescope` | goûts culturels (films, musique, jeux) |
| 10 | Telescope | `CameraStop_Telescope` | astronomie (mène à Moon) |
| 11 | Moon | `CameraStop_TelescopeMoon` | signature « vraie phase de lune » |

L'arrêt **CV** est placé **en deuxième position**, juste après l'ouverture : la
révélation de l'écran plat enchaîne directement sur « qui je suis » avant que la
caméra ne recule sur le bureau. Il lui faut une facette, une bulle et une
maquette — le brief précédent ne le connaissait pas.

> ⚠️ **Collision de nommage à trancher** : « CV » désigne désormais deux choses —
> un **arrêt de la visite** (le second écran vertical) *et* un **item de la
> navigation persistante** qui ouvre/télécharge le PDF. C'est une question de
> design, pas une erreur : à arbitrer pendant la session.

### 1.3 Les focales sont très hétérogènes — une maquette « générique » ne marchera pas

Chaque caméra porte sa focale authoriale, et l'écart est extrême :

- Bookshelf : 73,74° de champ horizontal (≈ 24 mm) — plan large
- CV / MonitorVertical : 38,19° (≈ 52 mm)
- Home : 54,43°
- Moon : **7,63° (≈ 270 mm)** — téléobjectif serré

Le 270 mm de la lune ne laisse pas la place d'un plan large 24 mm. **Chaque arrêt
a sa composition, son espace négatif et sa focale propres**, d'où la contrainte
d'entrée du § 3.

### 1.4 Trois affirmations périmées de `docs/projet.md`

`docs/projet.md` fait partie de la codebase et sera donc lu comme l'état courant.
Il ne l'est plus sur trois points — **ce document fait foi** :

| `projet.md` dit | Réalité vérifiée (2026-08-09) |
|---|---|
| « **Tailwind 4** pour l'UI » | Annoncé comme cible du rebuild, **pas encore installé** — rien n'en avait eu besoin. L'UI actuelle est du **CSS écrit à la main** (`src/styles.css`, 270 lignes). Le choix reste ouvert (§ 5.4) : livrer des **tokens agnostiques** (valeurs + échelles) qui survivent aux deux options. |
| « calibrage `blenderMatch` déjà calibré » | `src/config/blenderMatch.ts` **a été supprimé**. Le pipeline est `src/config/renderPipeline.ts` : bake unlit intégral, `NoToneMapping`, zéro lumière. |
| « Authentification : lien magique + Google + GitHub » | **Différée**, aucune issue ouverte. **Hors périmètre** de cette session. |

---

## 2. Périmètre de la session

### Dans le périmètre

1. **Écran de pré-sélection** 3D / version classique — la première impression du
   site. Porte les liens directs Projets / CV / Contact.
   *Séquence actée : le chargement lourd ne démarre qu'au clic « expérience 3D ».
   Pas de préchargement spéculatif derrière l'écran de choix en v1.*
2. **Preloader** — progression réelle du téléchargement **+ un état terminal
   indéterminé à designer** : le décodage Draco, l'upload des textures et la
   compilation des shaders n'émettent aucune progression. La barre peut rester à
   100 % plusieurs secondes, surtout sur mobile. **Cet état d'attente final fait
   partie du design**, ce n'est pas un cas limite.
3. **Navigation d'accès direct**, présente à **deux endroits** : sur l'écran de
   pré-sélection, et en overlay discret persistant pendant toute l'expérience 3D.
   Comportement par item, indépendant de la position dans la visite :
   - **Projets** → panneau liste 2D → clic sur un projet → sa fiche
   - **CV** → ouvre/télécharge le PDF
   - **Contact** → panneau contact (email cliquable + GitHub / LinkedIn)

   C'est ce qui garantit le « ≤ 2 clics » du recruteur pressé sans finir la visite.
4. **Système de bulles narratives** décliné sur les cadrages réels.
   *Technique actée : overlay DOM ancré par projection écran* — le texte vit dans
   le DOM (accessibilité, SEO, netteté à toute densité), la bulle suit l'objet via
   la projection de sa position 3D.
5. **Fiches projets** (modèle de contenu § 6). *Conteneur acté : panneau latéral
   au-dessus de la scène* — jamais plein écran, la 3D reste visible.
6. **Sélecteur FR / EN** et **hints de contrôles**.
7. **Placeholder « version classique »** (CV + liens + contact) : sert aussi de
   fallback WebGL-indisponible et de destination mobile-portrait.

*Ordre de maquettage conseillé : le preloader en dernier — ses chiffres dépendent
des mesures de chargement (issues #50 à #52). Tout le reste est maquettable
immédiatement.*

### Hors périmètre

Scène 3D, shaders, contours 3D (technique encore ouverte), écrans d'auth
(différée), version 2D complète (différée — placeholder élégant seulement).

---

## 3. Contrainte d'entrée obligatoire : maquetter sur les renders réels

**Les maquettes des éléments superposés à la scène se posent sur les images de
référence `docs/renders/refs/<stop>.png` (1280×720), jamais sur un canvas
abstrait.** Chaque arrêt a sa composition et son espace négatif propres.

**Disponible aujourd'hui — 9 renders** : `bookshelf`, `cabinet`, `cat`, `desk`,
`guitar`, `moon`, `posters`, `scoreboard`, `telescope`.

**Manquant — 2 renders, et ce sont les deux plus critiques** : `home` (le plan
d'ouverture) et `cv` / `MonitorVertical` (le nouvel arrêt du § 1.2).

**Qui les produit** : ces images sont la vérité-terrain **Blender**, pas des
captures runtime — c'est justement contre elles que la boucle de comparaison
(#40 / #46) mesure le rendu WebGL. L'issue #40 le dit explicitement : *« les deux
manquants sont à produire depuis Blender, donc côté utilisateur »*. Ce n'est donc
**pas** une dépendance sur #45 (qui capture le runtime via Playwright), mais un
rendu à lancer dans Blender.

> **Contournement possible pour ne pas bloquer la session** : une capture runtime
> à `?stop=Home` et `?stop=CV` est un **fond de maquette parfaitement suffisant**,
> même si elle ne vaut pas comme référence de comparaison. Décision à prendre :
> rendre les deux images dans Blender, ou démarrer sur des captures runtime pour
> ces deux arrêts seulement.

**Règle d'ancrage responsive** : les refs 16:9 sont des références de
**composition**, pas une grille absolue. Le rendu réel s'étire du 16:10 portable
à l'ultrawide, ce qui déplace l'espace négatif. Les overlays s'ancrent
**relativement au sujet cadré** (l'objet de l'arrêt) avec des marges de safe-area,
**jamais en positions pixel absolues**.

Techniquement, le cadrage est un **ajustement horizontal** : le champ horizontal
authored dans Blender est l'invariant, et un viewport plus court **rogne en haut
et en bas** au lieu de reculer. Une maquette peut donc compter sur la largeur du
sujet, pas sur sa hauteur.

---

## 4. Contraintes techniques non négociables

Ces règles viennent du code déjà écrit et validé. Une maquette qui les enfreint
n'est pas implémentable en l'état.

**Échelle d'empilement** — `canvas 0 < bulles 100 < HUD 200 < panneau 300`.
Rien ne sort de cette échelle. (Le composant `<Html>` de drei monte par défaut à
~16 millions : son `zIndexRange` doit être plafonné.)

**Routage des entrées, une phase = une destination du scroll** :

```
TOURING ⇄ PARKED → PANEL_OPEN | TELESCOPE
```

- **TOURING** — le geste de scroll avance la visite d'un arrêt (§ 1.1).
- **PARKED** — arrêt atteint : objets cliquables actifs, survol = mise en exergue.
- **PANEL_OPEN** — **le scroll appartient au panneau**, la caméra ne bouge plus.
  Focus piégé, Échap ou clic-dehors ferme.
- **TELESCOPE** — excursion caméra vers l'oculaire, scroll ignoré, sortie explicite.

**Les bulles n'interceptent jamais la molette de la visite.** Mécaniquement : la
racine de l'overlay est en `pointer-events: none`, seuls les îlots interactifs les
réactivent ; le rig ignore les événements visant `.panel`.

**Apparition / disparition des bulles = liée à la phase `PARKED`**, pas à un
défilement continu.

**Tous les textes viennent d'un module de contenu**, jamais du code des
composants — c'est ce qui rend le bilingue et la relecture possibles.

**Bilingue FR / EN sur tous les textes de la v1.** Toute décision de longueur ou
de gabarit doit tenir dans les deux langues (le français est en moyenne 15 à 20 %
plus long). Choix persisté en `localStorage`.

**Paysage uniquement.** Les cadrages caméra sont pensés en paysage ; le mobile
portrait reçoit une invite à pivoter + le lien vers la version classique.

**Le HUD actuel n'est pas un design à préserver.** `src/ui/Hud.tsx` et le style
« comic stroke » de `src/styles.css` sont de l'échafaudage de diagnostic : rail
d'arrêts, badge de phase, boutons de test. Le rail d'arrêts en particulier est un
**prototype de diagnostic, pas la navigation réelle**. Tout est à remplacer.

---

## 5. Questions ouvertes — à trancher avec l'auteur, pas dans la maquette

### 5.1 L'écran de pré-sélection passe devant Home — TRANCHÉ (2026-08-09)

**Décision de l'auteur : c'est validé, l'écran de pré-sélection reste devant.**
La révélation Home devient la récompense du clic « expérience 3D » — elle n'est
pas supprimée, elle est déplacée après le choix. `Home` garde donc son cadrage
délibéré (moniteur plein cadre, révélation au premier scroll) et n'a toujours ni
bulle ni maquette dédiée.

Le reste de cette section est conservé comme trace de l'arbitrage.

Les deux sources se contredisaient sur le rôle de `Home` :

- Le brief de 2026-08-04 : *« Home devient le plan d'attente derrière l'écran de
  pré-sélection / la position initiale de la caméra — pas de bulle, pas de
  maquette dédiée. »*
- `CLAUDE.md` : *« Le cadrage `Home` est délibéré (décision produit) : il remplit
  le cadre avec un moniteur pour que le premier écran se lise comme une image 2D
  plate ; le premier scroll recule et révèle la pièce en 3D. Cette révélation est
  le premier temps fort de l'expérience — ne jamais "corriger" Home en vue
  d'ensemble. »*

Les deux s'accordaient sur le fait que Home est la pose initiale ; le conflit
portait sur le risque de désamorcer la révélation en plaçant un écran devant.
**Arbitré ci-dessus : le risque est assumé, la révélation devient la récompense
du clic.** Conséquence pour les maquettes : l'écran de pré-sélection doit *donner
envie d'entrer* — c'est lui qui porte la promesse que Home tiendra ensuite.

### 5.2 « CV » désigne un arrêt et un item de navigation (§ 1.2)

### 5.3 Rendre Home et CV dans Blender, ou démarrer sur des captures runtime ? (§ 3)

### 5.4 Tokens en variables CSS, ou passage à Tailwind ?

`projet.md` annonçait Tailwind 4 comme cible ; rien n'est installé et l'UI
actuelle est du CSS écrit à la main. Le choix n'a jamais été tranché. **Par
défaut, le design system se livre en tokens agnostiques** (valeurs + échelles
nommées) : ils s'exposent en variables CSS aujourd'hui et se transposent en thème
Tailwind sans réécriture si la décision bascule.

### 5.5 Deux écrans de lune — un ou deux traitements d'overlay ?

`Moon` est un arrêt atteignable au scroll (11ᵉ, 7,63° de champ — la vue lointaine
au téléobjectif) **et** `TELESCOPE` est une excursion déclenchée au clic, avec sa
vignette et sa lune haute définition. Deux surfaces différentes pour le même sujet :
faut-il une bulle sur chacune, une seule, ou un traitement spécifique à l'excursion ?

---

## 6. Modèle de contenu

**Fiche projet** (module TS statique bundlé, champs v1) :
`title`, `role`, `year`, `stack[]` (tags), `summary` (≤ 300 caractères **par
langue**), `highlights[]` (≤ 3 puces), `links{repo?, live?}`, `cover?` (image).

**Bulle narrative** : 1 bulle par arrêt en v1, **≤ 180 caractères par langue**.
Utiliser des placeholders réalistes dans les maquettes, **jamais de lorem ipsum** —
c'est la seule façon de voir si le gabarit tient.

**Ton** : chaleureux et narratif, à la première personne — « vous visitez chez
moi ». Ce ton démarre **au preloader**, pas après.

---

## 7. Exigences non fonctionnelles (chiffrées, testables)

**Accessibilité — Lighthouse doit être vert :**

- Tout contenu textuel (bulles, fiches, nav, hints) vit dans le **DOM**, jamais
  uniquement peint dans le canvas. C'est la raison d'être du choix DOM plutôt que
  texture : *si l'accessibilité n'est pas au rendez-vous, la décision perd son sens.*
- **Navigation clavier complète** : flèches / PageUp-PageDown pour avancer dans la
  visite, ordre de Tab logique, focus piégé dans les panneaux ouverts, Échap ferme.
- Le lecteur d'écran **annonce le texte de la bulle à l'arrivée** sur l'arrêt.
- Texte **sélectionnable**.
- Contraste **≥ 4,5:1** sur tout texte. Le moyen (scrim, aplat de bulle opaque, ou
  liseré) est au choix du design system ; **4,5:1 est le seuil mesuré**, sur un
  fond 3D vivant et donc variable.
- Cibles tactiles **≥ 44 px**.
- `prefers-reduced-motion` respecté : visite sans tweens longs (snaps).

**États par surface** (ce que le visiteur voit) :

| Surface | Chargement | Vide | Erreur | Succès |
|---|---|---|---|---|
| Liste projets | — (contenu bundlé) | message chaleureux + lien GitHub | — | dossiers cliquables |
| Fiche projet | — | — | — | panneau latéral complet |
| Cover manquante | — | case BD générique au trait (pas d'image cassée) | idem | cover affichée |
| Panneau contact | — | — | — | email cliquable + GitHub / LinkedIn |
| Toggle FR/EN | bascule instantanée | — | — | choix persisté |

**Fallbacks à designer** : échec réseau sur le `.glb` (message + retry + lien vers
la version classique) ; WebGL indisponible → placeholder « version classique » ;
mobile portrait → invite à pivoter.

---

## 8. Direction artistique — verrouillée

**« Carnet de BD »**, dérivée de la DA 2,5D de la scène : bulles de bande dessinée
au trait (queue pointant l'objet commenté), boutons et panneaux au trait dessiné +
aplats, fiches projets en « cases » de BD, écran de pré-sélection illustré.
**L'UI et la scène partagent le même langage graphique.**

Cette direction a été retenue contre une alternative « galerie d'art » sobre,
rejetée parce que le ton chaleureux et narratif n'y vivrait que dans les textes,
sans aucune différenciation d'UI. L'exigence typographique est le point de risque
assumé : le trait dessiné doit rester **crédible pour un profil CTO**, jamais
enfantin.

**Méthode de palette imposée** : **extraire les couleurs des aplats des renders
refs** (zones dominantes, à la pipette) plutôt que les inventer. Les renders sont
déjà calibrés AgX comme le rendu WebGL : la cohérence scène/UI est alors garantie
par construction. Tout écart volontaire se justifie par écrit.

**Typographie** : une vraie typographie choisie avec exigence, **couverture des
accents français obligatoire**.

### Interdictions anti-slop (non négociables)

- Pas de fonte système par défaut (`system-ui`, Inter, Arial) en typo principale.
- Pas de grille 3 colonnes « icône dans un cercle coloré + titre + description ».
- Pas de gradient violet/indigo, pas de blobs ni de vagues SVG décoratives.
- Le placeholder « version classique » porte la **même DA BD** que le reste — pas
  une page CV template.
- Les cards n'existent que si **la carte EST l'interaction** (dossiers de la
  commode : oui ; décoration de section : non). Pas de radius uniforme *bubbly*
  partout.

---

## 9. Livrable attendu de la session

**Un `docs/DESIGN.md`** — noter le chemin : la convention du dépôt range tous les
`.md` sous `docs/` sauf `README.md` et `CONTRIBUTING.md`. (Le brief de 2026-08-04
demandait `DESIGN.md` à la racine ; c'est corrigé ici.)

Il contient :

- les **tokens** : typographie, palette, échelle d'espacement — exprimés de façon
  **agnostique** (valeurs + échelles nommées), exposés en variables CSS
  aujourd'hui, transposables en thème Tailwind si le choix bascule (§ 5.4) ;
- l'**anatomie des composants BD** : bulle (trait, épaisseur, queue, padding),
  panneau, boutons ;
- les **budgets de motion**, cohérents avec le tween de visite existant
  (`power3.inOut`, 1,2 s) et avec `prefers-reduced-motion`.

C'est la source de vérité des reviews design futures. **Sans lui, chaque
implémentation ré-improvise.**

---

## 10. Ce que ce brief débloque

Deux epics sont concernées : **#12** (coquille produit et accessibilité) et
**#13** (narration et contenu).

| Issue | Titre | Ce que la session lui apporte |
|---|---|---|
| #24 | Écran de pré-sélection 3D ou classique (P0) | la maquette entière — § 2, item 1 |
| #25 | Preloader (P0) | la maquette + l'état terminal indéterminé — § 2, item 2 |
| #26 | Navigation persistante : projet ou contact en 2 clics (P0) | la maquette entière — § 2, item 3 |
| #30 | Bulles narratives ancrées par projection écran (P0, L) | anatomie de la bulle — parent de #47/#48/#49 |
| #47 | Composant bulle ancré par projection écran (P0) | trait, queue, padding, gabarits |
| #48 | Contenu et ancrage des bulles par stop (P0) | une composition par arrêt (§ 3) |
| #49 | Accessibilité des bulles (P0) | contraste, tailles, focus (§ 7) |
| #31 | Contenu projets type et repli liste vide (P0) | modèle de contenu § 6 + états vides |
| #33 | Bilingue FR/EN (P1) | contraintes de gabarit bilingue § 4 |
| #28 | Contrastes 4.5:1 et cibles tactiles 44 px (P1) | les seuils sont déjà posés § 7 |

**Dépendance en amont** : les deux renders `home` et `cv` (§ 3) — rendu Blender,
côté utilisateur.

**Aucune issue « design system » n'existe encore** : le `docs/DESIGN.md` du § 9
n'a pas de ticket. À créer sous l'epic #12 si la session est lancée.
