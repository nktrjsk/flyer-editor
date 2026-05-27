interface MarkdownEditorProps {
  value: string
  onChange: (md: string) => void
}

export default function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <>
      <div className="pane-label">Obsah (Markdown) — stránky odděl pomocí ---</div>
      <textarea
        id="md-source"
        spellCheck
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </>
  )
}
