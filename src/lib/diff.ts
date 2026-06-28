export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

export function computeDiff(prev: string, next: string): DiffLine[] {
  const prevLines = prev.split('\n')
  const nextLines = next.split('\n')
  const m = prevLines.length
  const n = nextLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (prevLines[i - 1] === nextLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack
  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevLines[i - 1] === nextLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: prevLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: nextLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: prevLines[i - 1] })
      i--
    }
  }

  return result
}
