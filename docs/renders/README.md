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

- **`actual/`** — Playwright captures from the live WebGL view. Used for side-by-side comparison. **Gitignored** — captures are throwaway.

`overview.png` sits beside them: a whole-room render that is **not** a camera stop. It exists to make the space legible; the comparison loop ignores it.

## Available reference stops

Les 11, re-rendues le 2026-08-20 en 1920 × 1080 :

`home`, `vertical_monitor`, `desk`, `scoreboard`, `bookshelf`, `cabinet`,
`cat`, `guitare`, `poster`, `telescope`, `moon`.

Re-render every reference whenever the Blender cameras move. Four framings changed between v12 and v13 (bookshelf, cv, scoreboard, home), which silently invalidated the previous set — a stale reference makes the comparison loop report drift that isn't there, or hide drift that is.

## The automated loop (issues #44, #45, #46)

```
pnpm test:e2e            # les 11 arrêts, capturés et comparés
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
| cabinet          |      5,417 % | **écart suivi** — tiroir ouvert |
| moon             |     39,467 % | **non vérifié** — mauvaise lune |

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

### Les deux références périmées

Ce ne sont pas des tolérances relâchées pour faire passer la CI, et les deux ne
sont pas traitées pareil (`KNOWN_DEVIATIONS`, `tests/e2e/renderComparison.ts`).

- **cabinet — écart suivi, 5,790 %, plafond 7 %.** La référence est antérieure
  au tiroir qui s'ouvre à l'arrivée (#76) et aux dossiers étiquetés qu'il
  contient (#79) ; le diff les dessine littéralement. Le reste de l'image est
  comparé normalement et 7 % laisse peu de place à autre chose que le tiroir :
  l'arrêt continue de se surveiller. **La référence est à re-rendre depuis
  Blender, tiroir ouvert — issue #97.**
- **moon — non vérifié.** La référence montre `Outside_Moon_Detailed`, la lune
  photographique ; l'app montre `Outside_Moon`, la lune stylisée. L'échange de
  visibilité n'a lieu qu'en phase TELESCOPE, alors que l'arrêt se visite aussi
  à la molette, à 270 mm de focale. Ce ne sont pas deux rendus du même objet :
  il n'y a rien à comparer. L'arrêt est donc **déclaré non vérifié** — la suite
  affiche `10 passed, 1 skipped` avec la raison, la capture et le diff partent
  quand même en artefact. Un plafond assez haut pour absorber 40 % n'attraperait
  plus rien et rendrait un vert sur un arrêt que personne ne vérifie.
  **Décision produit du 2026-08-20 : c'est la référence qui a tort**, elle a été
  rendue avec le mauvais objet visible — à re-rendre avec la lune stylisée,
  **issue #97**.

Les deux entrées disparaissent ensemble le jour où #97 ferme.

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
3. Capturer en **1920×1080** dans `actual/<fichier>.png` — le nom du fichier, pas toujours celui de l'arrêt : voir `REF_FILE`.
4. Comparer à `refs/<stop>.png`.

**If the colors are wrong, the bake is wrong.** Le runtime est non éclairé par
construction (`src/config/renderPipeline.ts` : `MeshBasicMaterial`,
`NoToneMapping`, zéro lumière) — il ne reste aucune manette d'exposition ni de
tone mapping à tourner. Corriger dans Blender et ré-exporter. L'ancienne
calibration `src/config/blenderMatch.ts` appartenait à l'export éclairé et
n'existe plus.
