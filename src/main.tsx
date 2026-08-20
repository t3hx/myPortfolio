import { createRoot } from 'react-dom/client'
import App from '@/App'
// Le design system 2D (direction « Lueur ») est importé depuis docs/design tel
// quel plutôt que copié : une seule source de vérité, partagée avec les
// maquettes de docs/design/screens/. Importé AVANT styles.css pour qu'à
// spécificité égale les règles propres à l'app gagnent.
import '../docs/design/tokens.css'
import '@/styles.css'

createRoot(document.getElementById('root')!).render(<App />)
