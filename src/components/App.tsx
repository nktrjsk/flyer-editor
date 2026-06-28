import { Suspense, useRef, useState } from 'react'
import { EvoluProvider } from '@evolu/react'
import { evolu } from '../db/schema'
import EditorLayout from './EditorLayout'
import EditorPlaceholder from './EditorPlaceholder'
import { BootErrorBoundary } from './Recovery'
import Toolbar from './Toolbar'
import SettingsModal from './SettingsModal'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Ref populated by EditorLayout via onSnapshotReady — avoids prop-drilling
  // the snapshot function through the component tree.
  const saveManualSnapshotRef = useRef<((label: string | null) => void) | null>(null)

  function handleSaveSnapshot() {
    const label = window.prompt('Název verze (volitelné) — Enter pro uložení bez názvu, Escape pro zrušení:')
    if (label === null) return // user cancelled
    saveManualSnapshotRef.current?.(label.trim() || null)
  }

  return (
    <EvoluProvider value={evolu}>
      <Toolbar
        onOpenSettings={() => setSettingsOpen(true)}
        onSaveSnapshot={handleSaveSnapshot}
      />
      {/* EditorLayout suspends while Evolu/OPFS initialises. Show a populated
          (cached) or skeleton placeholder instead of an empty editor. The
          error boundary catches a hard init failure; the placeholder itself
          surfaces a recovery option if the boot hangs (stale SW / OPFS). */}
      <BootErrorBoundary>
        <Suspense fallback={<EditorPlaceholder />}>
          <EditorLayout
            onSnapshotReady={fn => { saveManualSnapshotRef.current = fn }}
          />
        </Suspense>
      </BootErrorBoundary>
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </EvoluProvider>
  )
}
