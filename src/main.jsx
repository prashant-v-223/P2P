import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './App.jsx';
import './index.css';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm-dialog';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ToastProvider><ConfirmProvider><App /></ConfirmProvider></ToastProvider>
    </Provider>
  </React.StrictMode>,
);
