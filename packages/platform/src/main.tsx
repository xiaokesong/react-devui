import { StrictMode } from 'react';
import ReactDOMClient from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './app/App';
import { startup } from './startup';

startup.then(() => {
  const rootElement = document.getElementById('root') as Element;

  ReactDOMClient.createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
});
