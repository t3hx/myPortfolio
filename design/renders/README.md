# Render comparison harness

Two directories:

- **`refs/`** — Ground truth. Blender EEVEE renders, one per camera stop, **1920×1080**. **Committed.** Do not edit.

  La plupart portent le `label` de l'arrêt en minuscules (`desk.png`,
  `cabinet.png`). **Trois font exception** et sont déclarées dans `REF_FILE`
  (`tests/e2e/renderComparison.ts`) : `vertical_monitor.png` pour l'arrêt `CV`
  (nommé d'après le nœud caméra `CameraStop_MonitorVertical`), `guitare.png`
  pour `Guitar`, `poster.png` pour `Posters`. Les deux noms n'ont pas le même
  propriétaire — le `label` est la clé de `?stop=`, donc des liens profonds ;
  le nom de fichier suit l'export Blender. Déclarer la correspondance coûte une
  ligne ; renommer d'un côté ou de l'autre casse forcément quelque chose.

- **`test-results/renders/`** — Playwright captures from the live WebGL view, at the repo root. Used for side-by-side comparison. **Gitignored** — captures are throwaway.

  Elles ont quitté ce dossier avec **#111** : une sortie jetable rangée à côté
  de la vérité terrain finit par se confondre avec elle. Elles sont maintenant
  dans `test-results/`, avec les autres sorties de test — mais **pas** dans le
  dossier de Playwright, qui a le sien (`outputDir: test-results/playwright`)
  parce qu'il le NETTOIE au démarrage d'une série.

`overview.png` sits beside them: a whole-room render that is **not** a camera stop. It exists to make the space legible; the comparison loop ignores it.

## Available reference stops

Les dix arrêts du tour, re-rendus le 2026-08-20 en 1920 × 1080 :

`home`, `desk`, `vertical_monitor`, `cabinet`, `bookshelf`, `cat`, `guitare`,
`poster`, `telescope`, `scoreboard`.

`moon.png` est **comparée elle aussi** depuis #97, comme onzième vue : la lune
n'est plus une étape du tour depuis #113 — on y accède en cliquant le
télescope — mais son cadrage reste authoré (`CameraStop_TelescopeMoon`) et
`?stop=moon` le pose de façon déterministe, lune détaillée visible, champ SANS
le pad du viseur (`TELESCOPE_FOV_PAD` est une décision d'UX, pas un cadrage
Blender). Son rendu est aussi le fond de la maquette
`design/screens/10-moon.html`. Seule `overview.png` reste hors boucle.

Re-render every reference whenever the Blender cameras move. Four framings changed between v12 and v13 (bookshelf, cv, scoreboard, home), which silently invalidated the previous set — a stale reference makes the comparison loop report drift that isn't there, or hide drift that is.

## The automated loop (issues #44, #45, #46)

```
pnpm test:e2e            # les dix arrêts, capturés et comparés
pnpm test:e2e --ui       # le même, en mode inspection
```

`playwright.config.ts` démarre le serveur de dev tout seul (port 4173) et le
réutilise s'il tourne déjà. Un seul navigateur, Chromium, à installer une fois :
`pnpm exec playwright install chromium`.

`test:e2e` est **distinct de `test`** : Vitest ne ramasse que `tests/**/*.test.ts`,
les spécifications Playwright sont des `.spec.ts` sous `tests/e2e/`.

### Ce qui est capturé, et pourquoi ce n'est pas la page

La boucle lit le **tampon de dessin de WebGL** (`canvas.toDataURL()`), elle ne
photographie pas la page. Les références sont des rendus Blender **nus** : une
capture de page y ajouterait la bulle, la barre de menu et le CV, et l'écart
mesuré serait dominé par du DOM qu'on n'a jamais voulu comparer — chaque nouvel
élément 2D le faussant un peu plus, en silence.

C'est aussi ce qui règle le piège noté le 2026-08-09, quand
`browser_take_screenshot` expirait deux fois de suite sur ce canvas : la boucle
`rAF` de R3F ne s'arrête jamais, donc l'attente de stabilité de Playwright ne
se termine jamais. Ici il n'y a pas de capture de page à stabiliser, on lit un
tampon. Le signal d'arrivée est le **démontage du préchargeur** (#25), pas un
délai deviné, et `?stop=` place la caméra sans tween.

Le paramètre `?capture` sert à ça et à rien d'autre : il allume
`preserveDrawingBuffer`. Sans lui l'image est noire ; en permanence, il coûte
une copie de tampon à chaque image.

Les deux environnements rasterisent avec **SwiftShader**
(`--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`), en local
comme sur GitHub — aucun runner n'a de GPU, et une tolérance mesurée ici n'aurait
aucun sens si la CI crénelait autrement.

### La tolérance, re-mesurée le 2026-08-20 (références 1920 × 1080)

| Arrêt            | Écart mesuré | Verdict                         |
| ---------------- | -----------: | ------------------------------- |
| home             |      0,000 % | identique au bit près           |
| poster           |      0,155 % | anticrénelage                   |
| scoreboard       |      0,161 % | anticrénelage                   |
| vertical_monitor |      0,164 % | anticrénelage                   |
| cat              |      0,203 % | anticrénelage                   |
| bookshelf        |      1,008 % | anticrénelage (feuillage)       |
| telescope        |      1,335 % | anticrénelage                   |
| desk             |      1,503 % | anticrénelage (câbles, clavier) |
| guitare          |      1,939 % | anticrénelage (cordes, frettes) |
| moon             |      0,455 % | anticrénelage (limbe, étoiles) — mesuré le 2026-09-26 |
| cabinet          |      5,868 % | **écart suivi** — dossiers runtime (2026-09-26) |

**Plafond global : 2,5 %** (`MAX_DIFF_RATIO`). Le pire arrêt conforme est la
guitare à 1,939 % ; la marge couvre une machine dont le rasteriseur crénelle un
cheveu autrement. Un seuil choisi a priori rend la CI rouge dès le premier jour,
et une CI rouge dès le premier jour se débranche.

**Monter en définition a RAPPROCHÉ les mesures** — bureau 1,808 → 1,503 %,
posters 0,218 → 0,155 % : l'écart vit sur les silhouettes, dont le poids relatif
baisse quand la définition monte. Le plafond garde donc plus de marge qu'avant.

Ces chiffres sont **reproductibles au chiffre près** : trois exécutions
consécutives rendaient exactement les mêmes taux en 1280 × 720. SwiftShader
rasterise de façon déterministe, et le signal d'arrivée (démontage du
préchargeur, puis deux `rAF`) ne laisse pas passer d'image à moitié construite.

Tout l'écart résiduel est **sur les silhouettes et les géométries fines** —
cordes, frettes, feuilles, câbles. Sur les aplats, EEVEE et WebGL sont
identiques au bit près : c'est ce que l'arrêt Accueil démontre à 0,000 %, et
c'est la meilleure preuve que le pipeline non éclairé fait bien son travail.

### L'écart suivi : cabinet

Ce n'est pas une tolérance relâchée pour faire passer la CI, et ce n'est plus
une référence « périmée » (`KNOWN_DEVIATIONS`, `tests/e2e/renderComparison.ts`) :

- **cabinet — écart suivi, 5,868 % mesuré le 2026-09-26, plafond 7 %.** La
  référence montre le tiroir ouvert avec l'unique dossier du `.glb` ; l'app en
  clone **un par projet** (#79), étiquettes écrites au runtime depuis
  `PROJECTS` — le diff dessine littéralement « Anima » et « Portfolio ».
  **Blender ne peut pas rendre ces clones**, donc aucune re-prise de référence
  ne fermera cet écart : il est structurel, assumé et capé (#97). Le reste de
  l'image est comparé normalement, et 7 % laisse peu de place à autre chose que
  le contenu du tiroir : l'arrêt continue de se surveiller. Le chiffre bouge
  quand les dossiers bougent (5,417 % avant l'inversion d'ordre de #181, un 6ᵉ
  projet le bougera encore) — attendu, le plafond absorbe.

La vue lune, elle, est redevenue une comparaison ordinaire avec #97 : la
référence HD correspond à ce que `?stop=moon` affiche, 0,455 % mesuré.

### En CI

`.github/workflows/render-diff.yml`, un job à part. `ci.yml` est copié à
l'octet près entre les trois dépôts et n'a pas à connaître une scène 3D ; et ce
job télécharge un navigateur pour rasteriser onze scènes de 3 Mo en logiciel,
ce qu'un lint n'a pas à payer.

Les captures **et** les images de différence partent en artefact `render-diff`
(14 jours), au vert comme au rouge : un rapport qui ne montre l'image qu'en cas
d'échec ne permet pas de voir une dérive s'installer sous le seuil.

## À la main

1. `pnpm dev`
2. Ouvrir `localhost:5173/?stop=<label>` — un saut déterministe vers cet arrêt,
   c'est ce qui rend les captures reproductibles.
3. Capturer en **1920×1080** dans `test-results/renders/<fichier>.png` — le nom du fichier, pas toujours celui de l'arrêt : voir `REF_FILE`.
4. Comparer à `refs/<stop>.png`.

**If the colors are wrong, the bake is wrong.** Le runtime est non éclairé par
construction (`src/config/renderPipeline.ts` : `MeshBasicMaterial`,
`NoToneMapping`, zéro lumière) — il ne reste aucune manette d'exposition ni de
tone mapping à tourner. Corriger dans Blender et ré-exporter. L'ancienne
calibration `src/config/blenderMatch.ts` appartenait à l'export éclairé et
n'existe plus.
