import { Suspense, useState } from 'react'
import { EvoluProvider } from '@evolu/react'
import { evolu } from '../db/schema'
import EditorLayout from './EditorLayout'
import Toolbar from './Toolbar'
import SettingsModal from './SettingsModal'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <EvoluProvider value={evolu}>
      <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
      {/* EditorLayout suspends while Evolu loads — show minimal shell */}
      <Suspense fallback={<div className="editor-layout" />}>
        <EditorLayout />
      </Suspense>
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </EvoluProvider>
  )
}
