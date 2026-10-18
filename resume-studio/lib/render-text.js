// Plain-text renderer: handy for pasting into online application forms.
export function renderText(model) {
  const lines = [];
  for (const b of model.blocks) {
    switch (b.type) {
      case 'name': lines.push(b.text); break;
      case 'contact': lines.push(b.text, ''); break;
      case 'section': lines.push('', b.text, '-'.repeat(Math.min(b.text.length, 60))); break;
      case 'paragraph': lines.push(b.text); break;
      case 'labelValue': lines.push(`${b.label} ${b.value}`); break;
      case 'entryHeader': lines.push('', `${b.primary}${b.secondary || ''}${b.right ? `  (${b.right})` : ''}`); break;
      case 'subline': lines.push(`${b.label || ''}${b.text}`); break;
      case 'bullet': lines.push(`  - ${b.text}`); break;
      default: break;
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
