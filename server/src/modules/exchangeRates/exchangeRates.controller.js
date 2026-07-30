import { ExchangeRate } from '../../models/ExchangeRate.js';

const validRate = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export const getExchangeRates = async (_req, res) => {
  const rates = await ExchangeRate.find().sort({ currency: 1 }).lean();
  return res.json({ success: true, count: rates.length, rates });
};

export const saveAllRates = async (req, res) => {
  const { rates, updatedBy } = req.body;
  if (!Array.isArray(rates) || rates.some((rate) => !rate.currency || !validRate(rate.rate))) {
    return res.status(400).json({ success: false, error: 'Every rate requires a currency and positive numeric rate.' });
  }
  const updater = updatedBy || req.user.name || req.user.email;
  await ExchangeRate.bulkWrite(rates.map((rate) => ({
    updateOne: {
      filter: { currency: rate.currency.toUpperCase() },
      update: {
        $set: {
          name: rate.name || rate.currency.toUpperCase(),
          rate: Number(rate.rate),
          lastUpdatedBy: updater
        },
        $setOnInsert: { currency: rate.currency.toUpperCase() }
      },
      upsert: true
    }
  })));
  const updatedRates = await ExchangeRate.find().sort({ currency: 1 });
  return res.json({ success: true, message: 'Exchange rates saved.', rates: updatedRates });
};

export const addCurrency = async (req, res) => {
  const { currency, name, rate } = req.body;
  if (!currency?.trim() || !validRate(rate)) {
    return res.status(400).json({ success: false, error: 'Currency and a positive numeric rate are required.' });
  }
  const code = currency.trim().toUpperCase();
  if (await ExchangeRate.exists({ currency: code })) {
    return res.status(409).json({ success: false, error: `${code} already exists.` });
  }
  await ExchangeRate.create({
    currency: code,
    name: name?.trim() || code,
    rate: Number(rate),
    lastUpdatedBy: req.user.name || req.user.email
  });
  const rates = await ExchangeRate.find().sort({ currency: 1 });
  return res.status(201).json({ success: true, message: 'Currency added.', rates });
};

export const deleteCurrency = async (req, res) => {
  const rate = await ExchangeRate.findOneAndDelete({ currency: req.params.currency.toUpperCase() });
  if (!rate) return res.status(404).json({ success: false, error: 'Currency not found.' });
  const rates = await ExchangeRate.find().sort({ currency: 1 });
  return res.json({ success: true, message: 'Currency deleted.', rates });
};
