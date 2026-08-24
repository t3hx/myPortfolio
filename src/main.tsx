import { createRoot } from 'react-dom/client'
import App from '@/App'
// Le design system 2D (direction « Lueur ») est du CODE : il est servi au
// visiteur, donc il vit dans src/ (#111). Les maquettes de design/screens/ le
// lisent depuis là — une seule source de vérité, dans les deux sens.
// Importé AVANT styles.css pour qu'à spécificité égale les règles propres à
// l'app gagnent (c'est ce qui fait gagner `.bubble--out` sur `bubble-in`).
import '@/styles/tokens.css'
import '@/styles/styles.css'
// Le site classique en DERNIER : il doit pouvoir déverrouiller le
// `overflow: hidden` que styles.css pose sur `html, body, #root`, et à
// spécificité égale c'est le dernier qui gagne. Sa règle est d'ailleurs plus
// spécifique (`:root[data-experience='classic']`), mais s'en remettre à ça
// seul rendrait l'ordre des imports faussement anodin — il ne l'est pas ici,
// pas plus qu'entre les deux précédents.
import '@/styles/classic.css'

createRoot(document.getElementById('root')!).render(<App />)
