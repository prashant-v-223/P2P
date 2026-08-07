// currencyHelper.js - Universal FX Currency Converter to INR (83.50 INR/USD)
const FX_RATES = {
  USD: 83.5,
  EUR: 90.2,
  CNY: 11.5,
  GBP: 105.0,
  AED: 22.7,
  INR: 1.0
};

export function getFxRate(currency = 'INR') {
  const code = String(currency || 'INR').toUpperCase().trim();
  return FX_RATES[code] || 1.0;
}

export function convertToINR(amount, currency = 'INR') {
  const num = Number(amount) || 0;
  const rate = getFxRate(currency);
  return Math.round(num * rate);
}

export function formatCurrencyINR(amount, currency = 'INR') {
  const num = Number(amount) || 0;
  const curr = String(currency || 'INR').toUpperCase().trim();

  if (curr === 'INR' || !curr) {
    return {
      primary: `₹${num.toLocaleString('en-IN')}`,
      convertedAmount: num,
      rate: 1.0,
      isConverted: false,
      origText: `₹${num.toLocaleString('en-IN')}`
    };
  }

  const rate = getFxRate(curr);
  const inrVal = Math.round(num * rate);
  const origSymbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : `${curr} `;

  return {
    primary: `₹${inrVal.toLocaleString('en-IN')}`,
    secondary: `(${origSymbol}${num.toLocaleString('en-IN')} ${curr} @ ₹${rate})`,
    convertedAmount: inrVal,
    rate,
    isConverted: true,
    origText: `${origSymbol}${num.toLocaleString('en-IN')} ${curr}`
  };
}
