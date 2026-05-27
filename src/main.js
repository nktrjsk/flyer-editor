import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './components/App';
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
