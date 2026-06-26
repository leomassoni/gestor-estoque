import type { ComponentProps } from 'react'
import Editor from 'react-simple-code-editor'

type LazyCodeEditorProps = ComponentProps<typeof Editor>

export default function LazyCodeEditor(props: LazyCodeEditorProps) {
  return <Editor {...props} />
}
