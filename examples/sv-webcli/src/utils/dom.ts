export const copyToClipboard = async (text: string): Promise<void> => {
  // try Clipboard API first (works in secure contexts)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);

      return;
    }
  } catch {
    // fall through to fallback method
  }

  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  textarea.style.top = '-999999px';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Failed to copy:', err);
  } finally {
    document.body.removeChild(textarea);
  }
};
