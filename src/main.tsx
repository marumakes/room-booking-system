import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { supabaseAuthRepo } from './data/authRepo'
import { supabaseClaimsRepo } from './data/claimsRepo'
import { browserFileSaver } from './data/fileDownload'
import { supabaseHistoryRepo } from './data/historyRepo'
import { supabaseProfileRepo } from './data/profileRepo'
import { supabaseRoomsRepo } from './data/roomsRepo'
import { xlsxWriter } from './data/xlsxWriter'
import './index.css'
import { App } from './ui/App'
import { ReposContext, type Repos } from './ui/repos'

// Composition root: the only place the UI is wired to the Supabase data layer.
const repos: Repos = {
  auth: supabaseAuthRepo,
  profiles: supabaseProfileRepo,
  rooms: supabaseRoomsRepo,
  claims: supabaseClaimsRepo,
  files: browserFileSaver,
  history: supabaseHistoryRepo,
  spreadsheets: xlsxWriter,
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ReposContext value={repos}>
        <App />
      </ReposContext>
    </BrowserRouter>
  </StrictMode>,
)
