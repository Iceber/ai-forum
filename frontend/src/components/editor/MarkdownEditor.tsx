'use client';

import { useState } from 'react';
import MarkdownContent from './MarkdownContent';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={`px-4 py-2 text-sm ${
            !preview
              ? 'bg-white border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`px-4 py-2 text-sm ${
            preview
              ? 'bg-white border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          预览
        </button>
      </div>
      {preview ? (
        <div className="p-4 min-h-[200px]">
          {value ? (
            <MarkdownContent content={value} className="prose prose-sm max-w-none" />
          ) : (
            <span className="text-gray-400">暂无内容</span>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '支持 Markdown 格式...'}
          className="w-full p-4 min-h-[200px] resize-y focus:outline-none"
          rows={8}
        />
      )}
    </div>
  );
}
