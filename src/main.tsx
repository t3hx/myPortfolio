import { createRoot } from 'react-dom/client'
import App from '@/App'
// Le design system 2D (direction « Lueur ») est du CODE : il est servi au
// visiteur, donc il vit dans src/ (#111). Les maquettes de design/screens/ le
// lisent depuis là — une seule source de vérité, dans les deux sens.
// Importé AVANT styles.css pour qu'à spécificité égale les règles propres à
// l'app gagnent (c'est ce qui fait gagner `.bubble--out` sur `bubble-in`).
import '@/styles/tokens.css'
import '@/styles/styles.css'

createRoot(document.getElementById('root')!).render(<App />)
