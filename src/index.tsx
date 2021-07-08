import React from 'react';
import { render } from 'react-dom';
import App from './App';
import { AppContextProvider } from './AppContext';

render(<AppContextProvider />, document.getElementById('root'));
