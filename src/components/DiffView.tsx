import type { DiffLine } from '../lib/diff'

interface DiffViewProps {
  lines: DiffLine[]
}

export default function DiffView({ lines }: DiffViewProps) {
  return (
    <div className="diff-view">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`diff-line diff-line--${line.type}`}
        >
          {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
          {line.text}
        </div>
      ))}
    </div>
  )
}
