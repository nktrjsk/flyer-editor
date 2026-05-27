import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { DEFAULT_META, DEFAULT_MARKDOWN } from '../types';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import SourcePane from './SourcePane';
import PreviewPane from './PreviewPane';
// Temporary stub until Evolu is wired in (Phase 3)
const STUB_CONCEPTS = [{ id: '1', title: 'Znakový jazyk' }];
export default function App() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [meta, setMeta] = useState(DEFAULT_META);
    const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
    function handleMetaChange(patch) {
        setMeta(prev => ({ ...prev, ...patch }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(Toolbar, { onOpenSettings: () => setSettingsOpen(!settingsOpen) }), _jsxs("div", { className: "editor-layout", children: [_jsx(Sidebar, { concepts: STUB_CONCEPTS, activeId: "1", onSelect: () => { }, onNew: () => { }, onDelete: () => { } }), _jsx(SourcePane, { meta: meta, markdown: markdown, onMetaChange: handleMetaChange, onMarkdownChange: setMarkdown }), _jsx(PreviewPane, { meta: meta, markdown: markdown })] }), settingsOpen && (_jsx("div", { className: "modal-overlay", onClick: () => setSettingsOpen(false), children: _jsxs("div", { className: "modal", onClick: e => e.stopPropagation(), children: [_jsx("div", { className: "modal-title", children: "Nastaven\u00ED" }), _jsx("p", { style: { color: '#888', fontSize: '10pt' }, children: "Nastaven\u00ED synchronizace bude dostupn\u00E9 po integraci Evolu (Phase 3)." }), _jsx("div", { className: "modal-footer", children: _jsx("button", { className: "modal-close-btn", onClick: () => setSettingsOpen(false), children: "Zav\u0159\u00EDt" }) })] }) }))] }));
}
