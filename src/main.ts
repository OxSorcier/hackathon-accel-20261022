import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.js';
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(createElement(App));
