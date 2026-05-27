import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { marked } from 'marked';
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
export default function Page({ section, meta, isFirst, pageIndex, total }) {
    const labelText = total === 1 ? 'Náhled' :
        pageIndex === 0 ? 'Přední strana' :
            pageIndex === 1 ? 'Zadní strana' :
                `Strana ${pageIndex + 1}`;
    const html = marked.parse(section.trim(), { gfm: true });
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "page-label", children: labelText }), _jsxs("div", { className: "page", style: { '--base': `${meta.fontSize}pt` }, children: [isFirst && (_jsxs("div", { className: "page-title-block", children: [_jsxs("div", { children: [_jsx("div", { className: "page-title", children: esc(meta.title) }), _jsxs("div", { className: "page-meta", children: [esc(meta.org), meta.year ? ` · ${esc(meta.year)}` : ''] })] }), meta.logo && (_jsx("img", { className: "page-logo", src: meta.logo, alt: "" }))] })), _jsx("div", { className: "page-content", dangerouslySetInnerHTML: { __html: html } }), _jsxs("div", { className: "page-footer", children: [_jsx("span", { children: esc(meta.org) }), _jsxs("span", { children: [meta.web ? `${esc(meta.web)} · ` : '', "CC BY-SA 4.0"] })] })] })] }));
}
