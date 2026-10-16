// Keep numeric editing independent from timer enablement and UI language.
export function latinDigits(value) {
  return String(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0));
}
export function parseInteger(value) {
  const text=latinDigits(value).trim();
  if (!/^\d+$/.test(text)) return NaN;
  const n=Number(text);
  return Number.isSafeInteger(n)?n:NaN;
}
export function timerValue(enabled, draft) {
  if (!enabled) return 0;
  const n=parseInteger(draft);
  if (!Number.isInteger(n)||n<10||n>600) throw new Error('أدخل وقتًا صحيحًا من 10 إلى 600 ثانية أو أوقف المؤقت.');
  return n;
}
