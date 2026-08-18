const currencyLocales = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };

export function formatCurrency(amount, currency = 'INR', options = {}) {
  const code = String(currency || 'INR').trim().toUpperCase();
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(currencyLocales[code] || 'en-IN', {
      style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2, ...options
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${code} ${(Number.isFinite(value) ? value : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
