export function encryptCaesar(text: string, shift: number): string {
  return text.split('').map(char => {
    if (char.match(/[a-z]/i)) {
      const code = char.charCodeAt(0);
      const isUpperCase = code >= 65 && code <= 90;
      const base = isUpperCase ? 65 : 97;
      return String.fromCharCode(((code - base + shift) % 26 + 26) % 26 + base);
    }
    return char;
  }).join('');
}

export function decryptCaesar(text: string, shift: number): string {
  return encryptCaesar(text, -shift);
}
