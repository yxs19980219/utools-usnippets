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
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'shell', label: 'Shell' },
]

/** 片段可选语言（默认片段语言候选）：排除 markdown —— 笔记固定 markdown，不可作为片段默认 */
export const SNIPPET_LANGUAGES: LanguageDef[] = LANGUAGES.filter(
  (l) => l.value !== 'markdown'
)

export function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value
}
