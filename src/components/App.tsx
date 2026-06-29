import { Suspense, useRef, useState } from 'react'
import { EvoluProvider } from '@evolu/react'
import { evolu } from '../db/schema'
import EditorLayout from './EditorLayout'
import EditorPlaceholder from './EditorPlaceholder'
import { BootErrorBoundary } from './Recovery'
import Toolbar from './Toolbar'
import SettingsModal from './SettingsModal'
import { ToastProvider } from './ToastProvider'
import { ConfirmProvider } from './ConfirmProvider'
import LabelModal from './LabelModal'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [labelModalOpen, setLabelModalOpen] = useState(false)

  // Ref populated by EditorLayout via onSnapshotReady — avoids prop-drilling
  // the snapshot function through the component tree.
  const saveManualSnapshotRef = useRef<((label: string | null) => void) | null>(null)
  const publishRef = useRef<(() => void) | null>(null)

  function handleSaveSnapshot() {
    setLabelModalOpen(true)
  }

  function handleLabelConfirm(label: string | null) {
    setLabelModalOpen(false)
    saveManualSnapshotRef.current?.(label)
  }

  function handleLabelClose() {
    setLabelModalOpen(false)
  }

  return (
    <EvoluProvider value={evolu}>
      <ToastProvider>
        <ConfirmProvider>
          <Toolbar
            onOpenSettings={() => setSettingsOpen(true)}
            onSaveSnapshot={handleSaveSnapshot}
            onPublish={() => publishRef.current?.()}
          />
          {/* EditorLayout suspends while Evolu/OPFS initialises. Show a populated
              (cached) or skeleton placeholder instead of an empty editor. The
              error boundary catches a hard init failure; the placeholder itself
              surfaces a recovery option if the boot hangs (stale SW / OPFS). */}
          <BootErrorBoundary>
            <Suspense fallback={<EditorPlaceholder />}>
              <EditorLayout
                onSnapshotReady={fn => { saveManualSnapshotRef.current = fn }}
                onPublishReady={fn => { publishRef.current = fn }}
              />
            </Suspense>
          </BootErrorBoundary>
          {settingsOpen && (
            <SettingsModal onClose={() => setSettingsOpen(false)} />
          )}
          {labelModalOpen && (
            <LabelModal
              onConfirm={handleLabelConfirm}
              onClose={handleLabelClose}
            />
          )}
        </ConfirmProvider>
      </ToastProvider>
    </EvoluProvider>
  )
}
