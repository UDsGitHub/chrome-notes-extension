export function truncateText(text: string, maxLength: number) {
  const truncatedText = text.slice(0, maxLength);
  if (truncatedText.length < maxLength) return truncatedText;

  const lastSpace = truncatedText.lastIndexOf(" ");
  return lastSpace > 0
    ? `${truncatedText.slice(0, lastSpace)}...`
    : truncatedText;
}
