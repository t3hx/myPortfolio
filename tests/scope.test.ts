import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TELESCOPE_FOV_PAD, isTelescope } from '@/config/telescope'
import { SCOPE_OUT_MS } from '@/ui/TelescopeScope'

/**
 * La visée du télescope (#106). Trois choses qu'aucune relecture ne
 * rattraperait, et une décision de composition qu'un refactor défera.
 */

const tokens = readFileSync('docs/design/tokens.css', 'utf8')
const component = readFileSync('src/ui/TelescopeScope.tsx', 'utf8')
/** Les COMMENTAIRES sont retirés partout dans ce fichier : ils expliquent
 *  justement ce qu'on interdit, et le mot interdit y figure donc forcément. */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const code = (ts: string) => ts.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = strip(tokens.slice(tokens.indexOf('.scope {'), tokens.indexOf('.scope::before')))

describe('la sortie de la visée', () => {
  it('dure exactement ce que le CSS annonce', () => {
    const declared = tokens.match(/--t-scope-out:\s*(\d+)ms/)
    expect(declared, 'jeton --t-scope-out introuvable').not.toBeNull()
    expect(Number(declared![1])).toBe(SCOPE_OUT_MS)
  })

  it("est déclarée après l'entrée, sinon elle ne gagne pas", () => {
    // Même spécificité : c'est l'ordre dans le fichier qui tranche.
    expect(tokens.indexOf('.scope--out')).toBeGreaterThan(tokens.indexOf('.scope {'))
  })

  it('démonte en différé', () => {
    // La caméra met 1,6 s à revenir de la lune ; démonter le cache à l'instant
    // où la phase change le ferait disparaître d'un coup au milieu du vol.
    expect(component).toContain('SCOPE_OUT_MS')
    expect(component).toContain('setMounted(false)')
  })
})

describe("l'empilement", () => {
  it('laisse la barre de menu au-dessus, donc une sortie', () => {
    // À `--z-panel` le cache couvrirait la barre et `Échap` deviendrait la
    // seule issue. Même arbitrage que le CV : ce qui n'est pas modal ne se
    // comporte pas comme un modal.
    expect(rule).toContain('z-index: var(--z-bubble)')
    expect(rule).not.toContain('--z-panel')
  })

  it("n'intercepte pas le pointeur", () => {
    expect(rule).toContain('pointer-events: none')
  })
})

describe("la composition de l'oculaire", () => {
  it('suit la lune, donc la LARGEUR du cadre', () => {
    // Même raison que pour les bulles : le tour ajuste son champ
    // HORIZONTALEMENT, donc la taille apparente de la lune est proportionnelle
    // à la largeur et à rien d'autre. Sur `min(100vw, 100vh)` la cible suivait
    // la lune près du 16:9 et s'en décrochait ailleurs — mesuré, elle tombait
    // à 0,95 du limbe et coupait la face de l'astre.
    expect(rule).toContain('100vw')
    expect(rule).not.toContain('min(100vw, 100vh)')
  })

  it('borde le limbe de la lune, sans mordre dessus', () => {
    // La cible se lit comme le bord d'une optique à une seule condition : être
    // POSÉE sur le limbe. Plus dedans, un trait fin en travers d'un astre
    // ressemble à une rayure ; plus dehors, il flotte dans le noir sans rien
    // border. Tout ce qui décore le bord se mesure donc en `--scope-moon`.
    const ring = tokens.slice(tokens.indexOf('.scope::before'), tokens.indexOf('.scope__reticle'))
    const factors = [...ring.matchAll(/--scope-moon\)\s*\*\s*([\d.]+)/g)].map((m) => Number(m[1]))
    expect(factors.length, 'la cible ne se mesure plus sur le rayon de la lune').toBeGreaterThan(0)
    for (const f of factors) expect(f).toBeGreaterThanOrEqual(1)
  })

  it('ne met pas de croix au centre', () => {
    // Le centre, c'est la lune, et on ne la barre pas : quatre repères au bord,
    // jamais un réticule en croix.
    expect(component).toContain('scope__tick--n')
    expect(component).toContain('scope__tick--e')
    expect(component).not.toMatch(/crosshair|scope__cross/)
  })
})

describe('le mouvement réduit', () => {
  it("conserve l'ouverture mais lui retire le resserrement", () => {
    // Elle répond à un clic, donc elle est conservée — mais le resserrement du
    // cercle, lui, part tout seul une fois le clic donné, et c'est du mouvement
    // plein cadre.
    const reduced = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion'))
    expect(reduced).toContain('.scope {')
    expect(reduced).not.toMatch(/\.scope\s*\{[^}]*scale/)
  })
})

describe('le nom du télescope', () => {
  it('reconnaît les enfants d’un maillage à plusieurs primitives', () => {
    // LE PIÈGE. `Telescope_Merged` a TROIS primitives, et le chargeur glTF en
    // fait un groupe dont les enfants s'appellent `_1`, `_2`, `_3`. Un raycast
    // ne rend jamais le groupe, toujours l'enfant : une égalité stricte sur le
    // nom ne reconnaît rien — mesuré, elle a cassé d'un coup le clic ET le
    // survol, sans rien afficher dans la console.
    expect(isTelescope('Telescope_Merged')).toBe(true)
    expect(isTelescope('Telescope_Merged_2')).toBe(true)
    // Le `_` du préfixe compte : sans lui, ceci passerait pour le télescope.
    expect(isTelescope('Telescope_MergedShadow')).toBe(false)
    expect(isTelescope('Desk_Merged')).toBe(false)
  })
})

describe("le moment de l'ouverture", () => {
  const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')

  it("attend l'ARRIVÉE, pas le clic", () => {
    // `phase === 'telescope'` est vrai dès le clic, alors que la caméra met
    // 1,6 s à rejoindre l'oculaire. Ouvrir la visée tout de suite posait le
    // cache circulaire sur une pièce encore en mouvement.
    expect(component).toContain('telescopeSettled')
    expect(code(component)).not.toContain("phase === 'telescope'")
    expect(rig).toContain('settleTelescope()')
    expect(rig.indexOf('onComplete')).toBeLessThan(rig.indexOf('settleTelescope()'))
  })
})

describe("l'excursion en deux temps", () => {
  const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')

  it("s'arrête à l'oculaire avant de grossir", () => {
    // En un seul vol, la caméra traversait l'instrument pour finir en gros
    // plan de lune sans que rien ne dise qu'un télescope se trouvait entre les
    // deux. La chorégraphie demandée est « fenêtre → objectif → dans
    // l'objectif → lune », donc il FAUT un arrêt.
    expect(rig).toContain('TELESCOPE_APPROACH_S')
    expect(rig).toContain('TELESCOPE_ZOOM_S')
    // Et la visée s'ouvre ENTRE les deux, pas au début ni à la fin.
    //
    // `lastIndexOf` sur les DURÉES, pas `indexOf` sur les noms : la première
    // occurrence de chaque constante est son import, en tête de fichier, donc
    // toujours avant tout le reste — comparer des positions d'imports ne dit
    // rien de l'ordre réel des deux temps.
    const settle = rig.lastIndexOf('settleTelescope()')
    expect(settle).toBeGreaterThan(rig.lastIndexOf('duration: TELESCOPE_APPROACH_S'))
    expect(settle).toBeLessThan(rig.lastIndexOf('duration: TELESCOPE_ZOOM_S'))
  })

  it('élargit le champ pour dégager du ciel autour de la lune', () => {
    // L'arrêt `Moon` du tour cadre la lune plein écran — décision de Blender,
    // qui ne bouge pas. Mais dans une VISÉE, une lune qui touche les bords ne
    // laisse pas voir qu'on regarde à travers quelque chose.
    expect(TELESCOPE_FOV_PAD).toBeGreaterThan(1)
    expect(rig).toContain('TELESCOPE_FOV_PAD')
  })

  it("déduit l'oculaire de la caméra de Blender, sans rien ajouter au .glb", () => {
    // `CameraStop_TelescopeMoon` est déjà à 58 cm du télescope : la pose de
    // l'oculaire s'obtient en reculant le long de son axe.
    expect(rig).toContain('TELESCOPE_EYEPIECE_BACK')
  })
})

describe('le cerne au survol', () => {
  const hover = readFileSync('src/scene/TelescopeHover.tsx', 'utf8')

  it('décide par un lancer de rayon, pas par onPointerOver', () => {
    // Posés sur la scène entière, `onPointerOver` / `onPointerOut` se
    // déclenchent pour CHAQUE maillage traversé : entrer sur le télescope
    // allumait le cerne, puis un `pointerOut` retardé venant d'un voisin
    // l'éteignait. Mesuré : un cerne qui ne s'allumait pas quand il fallait, et
    // qui s'allumait quand la souris était ailleurs.
    expect(hover).toContain('setFromCamera')
    expect(hover).toContain("addEventListener('pointermove'")
    expect(code(hover)).not.toContain('onPointerOver')
    const room = readFileSync('src/scene/RoomModel.tsx', 'utf8')
    expect(code(room)).not.toContain('onPointerOver')
  })

  it("s'éteint au DÉPART de l'excursion, pas au prochain mouvement", () => {
    // Après le clic la souris ne bouge plus : sans cela le cerne restait
    // allumé pendant tout le vol, en plein cadre sur le tube.
    const state = readFileSync('src/state/interaction.ts', 'utf8')
    // `lastIndexOf` : la première occurrence est la DÉCLARATION de l'interface,
    // pas l'implémentation.
    const enter = state.slice(
      state.lastIndexOf('enterTelescope: ()'),
      state.lastIndexOf('settleTelescope: ()'),
    )
    expect(enter).toContain('telescopeHovered: false')
  })
})

describe('la pastille de désignation', () => {
  const ping = readFileSync('src/scene/TelescopePing.tsx', 'utf8')

  it('vit dans le DOM, jamais dans la scène', () => {
    // Ce n'est pas une commodité : la boucle de comparaison capture le tampon
    // WebGL, et les références Blender ne contiennent aucun indice d'interface.
    // Tout ce qu'on dessinerait EN 3D au repos ferait dériver l'arrêt — et le
    // couper sous `prefers-reduced-motion` pour sauver la mesure aurait privé
    // d'affordance les personnes sensibles au mouvement, c'est-à-dire laissé
    // le test décider du design.
    expect(ping).toContain('<Html')
    expect(ping).toContain('portal={portal}')
  })

  it("ne s'affiche qu'où le clic répond", () => {
    // Une pastille allumée là où le clic ne fait rien est une promesse non
    // tenue — la même faute que le survol des cartouches de formation.
    expect(ping).toContain("phase === 'parked'")
    expect(ping).toContain('TELESCOPE_STOP')
    // Et elle s'efface au survol : le cerne prend le relais.
    expect(ping).toContain('hovered')
  })

  it('garde le point sous mouvement réduit, et perd l’anneau', () => {
    // L'anneau tourne en boucle tout seul : il part. Le point reste —
    // l'indication n'est pas du mouvement.
    const reduced = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion'))
    expect(reduced).toContain('.ping__ring')
    expect(reduced).not.toContain('.ping__dot')
  })
})

describe("l'échange des deux lunes", () => {
  const room = readFileSync('src/scene/RoomModel.tsx', 'utf8')
  const rig = readFileSync('src/scene/CameraRig.tsx', 'utf8')
  const state = readFileSync('src/state/interaction.ts', 'utf8')

  it('se produit là où personne ne peut le voir, aux DEUX bouts', () => {
    // C'est le moment qui compte, pas la condition, et il diffère à l'aller et
    // au retour. Piloté par la phase, l'échange se voyait des deux côtés : en
    // pleine fenêtre au clic, et en plein cadre à la sortie.
    expect(room).toContain('state.moonDetailed')
    expect(room).not.toContain("state.phase === 'telescope'")
  })

  it("s'allume dans le noir, derrière l'oculaire", () => {
    // `settleTelescope` tombe à la fin du temps d'approche : on regarde
    // l'intérieur du tube, il n'y a rien à regarder pendant l'échange.
    const settle = state.slice(
      state.lastIndexOf('settleTelescope: ()'),
      state.lastIndexOf('showDetailedMoon: ('),
    )
    expect(settle).toContain('moonDetailed: true')
  })

  it("s'éteint à la FIN du retour, pas à la touche `Échap`", () => {
    // À l'instant de la sortie la lune remplit encore l'écran ; à la fin du
    // vol, elle est redevenue un petit disque dans la fenêtre.
    expect(rig).toContain('showDetailedMoon(false)')
    expect(rig.lastIndexOf('showDetailedMoon(false)')).toBeGreaterThan(
      rig.lastIndexOf('returning.current = false'),
    )
  })
})

describe('le rappel de sortie', () => {
  it('dit quelle touche, parce que rien d’autre ne le dit', () => {
    // `Échap` est la SEULE issue de cette vue — un clic ailleurs ne fait rien —
    // et personne ne devine une touche qu'on ne lui montre pas.
    expect(component).toContain('scope__exit')
    expect(component).toContain('UI.sheet.escape')
    expect(component).toContain('UI.telescope.exit')
    expect(tokens).toContain('.scope__exit')
  })

  it('vit DANS le cache, pour partir avec lui', () => {
    // Posé à côté, il faudrait synchroniser deux animations de sortie.
    const exit = component.indexOf('scope__exit')
    expect(exit).toBeGreaterThan(component.indexOf("className={visible ? 'scope'"))
    expect(exit).toBeLessThan(component.lastIndexOf('</div>'))
  })
})
