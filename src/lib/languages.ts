/**
 * 一期支持的语言列表（CM6 语言包按需注册，见 CodeBlock.tsx）。
 */
export interface LanguageDef {
  value: string
  label: string
}

export const LANGUAGES: LanguageDef[] = [
  { value: 'plaintext', label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'shell', label: 'Shell' },
]

export function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value
}
