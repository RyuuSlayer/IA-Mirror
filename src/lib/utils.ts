export function formatDescription(text: string): string {
  if (!text) return '';
  
  // Replace <br /> tags with newlines
  let formatted = text.replace(/<br\s*\/?>/g, '\n');
  
  // Remove other HTML-like tags
  formatted = formatted.replace(/<[^>]+>/g, '');
  
  // Split into paragraphs
  return formatted.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
}
