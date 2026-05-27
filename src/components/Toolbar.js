import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Toolbar({ onOpenSettings }) {
    return (_jsxs("header", { className: "toolbar", children: [_jsx("span", { className: "toolbar-title", children: "Samostuduj \u00B7 editor let\u00E1ku" }), _jsxs("div", { className: "toolbar-actions", children: [_jsx("button", { onClick: onOpenSettings, children: "\u2699 Nastaven\u00ED" }), _jsx("button", { onClick: () => window.print(), children: "\u2399 Tisknout / PDF" })] })] }));
}
