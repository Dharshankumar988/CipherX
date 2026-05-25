export function encryptVigenere(text: string, keyword: string): string {
  if (!keyword) return text;
  keyword = keyword.toUpperCase();
  let result = '';
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c.match(/[a-z]/i)) {
      const code = text.charCodeAt(i);
      const isUpperCase = code >= 65 && code <= 90;
      const shift = keyword.charCodeAt(j % keyword.length) - 65;
      const base = isUpperCase ? 65 : 97;
      result += String.fromCharCode(((code - base + shift) % 26) + base);
      j++;
    } else {
      result += c;
    }
  }
  return result;
}

export function decryptVigenere(text: string, keyword: string): string {
  if (!keyword) return text;
  keyword = keyword.toUpperCase();
  let result = '';
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c.match(/[a-z]/i)) {
      const code = text.charCodeAt(i);
      const isUpperCase = code >= 65 && code <= 90;
      const shift = keyword.charCodeAt(j % keyword.length) - 65;
      const base = isUpperCase ? 65 : 97;
      result += String.fromCharCode(((code - base - shift + 26) % 26) + base);
      j++;
    } else {
      result += c;
    }
  }
  return result;
}
