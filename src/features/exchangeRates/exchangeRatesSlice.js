import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../services/api';

export const fetchExchangeRates = createAsyncThunk(
  'exchangeRates/fetchExchangeRates',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiFetch('/api/exchange-rates');
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data.rates;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const saveAllRates = createAsyncThunk(
  'exchangeRates/saveAllRates',
  async ({ rates, updatedBy }, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch('/api/exchange-rates', {
        method: 'PUT',
        body: JSON.stringify({ rates, updatedBy })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchExchangeRates());
      return data.rates;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addCurrency = createAsyncThunk(
  'exchangeRates/addCurrency',
  async (currencyObj, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch('/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify(currencyObj)
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchExchangeRates());
      return data.rates;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteCurrency = createAsyncThunk(
  'exchangeRates/deleteCurrency',
  async (currencyCode, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch(`/api/exchange-rates/${currencyCode}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchExchangeRates());
      return currencyCode;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const exchangeRatesSlice = createSlice({
  name: 'exchangeRates',
  initialState: {
    rates: [],
    loading: false,
    saving: false,
    toastMessage: '',
    error: null,
    calculator: {
      currency: 'USD',
      amount: 500000,
      convertedINR: 47897700,
      matchedSlabName: 'Advance Payment (Above ₹1CR)',
      requiredApprovalSteps: ['Procurement Head Approval', 'MD Approval', 'Finance Approval']
    }
  },
  reducers: {
    updateLocalRate: (state, action) => {
      const { currency, rate } = action.payload;
      const item = state.rates.find(r => r.currency === currency);
      if (item) {
        item.rate = rate;
      }
    },
    calculateConversion: (state, action) => {
      const { currency, amount } = action.payload;
      const rateObj = state.rates.find(r => r.currency === currency);
      const rateVal = rateObj ? rateObj.rate : 1;
      const inrVal = Number(amount || 0) * rateVal;

      let slabName = 'Advance Payment (Up to ₹1CR)';
      let steps = ['Procurement Head Approval', 'Finance Approval'];

      if (inrVal > 10000000) {
        slabName = 'Advance Payment (Above ₹1CR)';
        steps = ['Procurement Head Approval', 'MD Approval', 'Finance Approval'];
      }

      state.calculator = {
        currency,
        amount: Number(amount),
        convertedINR: inrVal,
        matchedSlabName: slabName,
        requiredApprovalSteps: steps
      };
    },
    clearRatesToast: (state) => {
      state.toastMessage = '';
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExchangeRates.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchExchangeRates.fulfilled, (state, action) => {
        state.loading = false;
        state.rates = action.payload;
      })
      .addCase(saveAllRates.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveAllRates.fulfilled, (state) => {
        state.saving = false;
        state.toastMessage = 'All FX rates successfully saved!';
      });
  }
});

export const { updateLocalRate, calculateConversion, clearRatesToast } = exchangeRatesSlice.actions;
export default exchangeRatesSlice.reducer;
