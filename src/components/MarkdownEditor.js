import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
export default function MarkdownEditor({ value, onChange }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "pane-label", children: "Obsah (Markdown) \u2014 str\u00E1nky odd\u011Bl pomoc\u00ED ---" }), _jsx("textarea", { id: "md-source", spellCheck: true, value: value, onChange: e => onChange(e.target.value) })] }));
}
