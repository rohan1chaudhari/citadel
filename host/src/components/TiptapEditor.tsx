'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TiptapEditor({ value, onChange, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write in Markdown…',
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-zinc max-w-none focus:outline-none min-h-[250px] px-3 py-3',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && editor.getText() !== value) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-[300px] rounded-lg border border-zinc-200 bg-white">
        <div className="animate-pulse p-3">
          <div className="h-4 bg-zinc-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 text-sm font-medium transition ${
            editor.isActive('bold')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 text-sm italic transition ${
            editor.isActive('italic')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded px-2 py-1 text-sm font-mono transition ${
            editor.isActive('code')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Inline Code"
        >
          {'</>'}
        </button>
        <div className="mx-1 h-4 w-px bg-zinc-300" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`rounded px-2 py-1 text-sm font-bold transition ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded px-2 py-1 text-sm font-bold transition ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <div className="mx-1 h-4 w-px bg-zinc-300" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-2 py-1 text-sm transition ${
            editor.isActive('bulletList')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded px-2 py-1 text-sm transition ${
            editor.isActive('orderedList')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Numbered List"
        >
          1. List
        </button>
        <div className="mx-1 h-4 w-px bg-zinc-300" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded px-2 py-1 text-sm transition ${
            editor.isActive('blockquote')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Quote"
        >
          "Quote"
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`rounded px-2 py-1 text-sm font-mono transition ${
            editor.isActive('codeBlock')
              ? 'bg-zinc-200 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Code Block"
        >
          {'{ }'}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
          title="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
          title="Redo"
        >
          ↷
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="min-h-[250px]" />
    </div>
  );
}
