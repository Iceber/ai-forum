export function appendMarkdownImage(content: string, fileUrl: string): string {
  const needsNewLine = content.length > 0 && !content.endsWith('\n');
  return `${content}${needsNewLine ? '\n' : ''}![image](${fileUrl})`;
}
