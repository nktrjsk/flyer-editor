import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function MetaSection({ meta, onChange }) {
    function handleLogo(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = ev => onChange({ logo: ev.target?.result });
        reader.readAsDataURL(file);
    }
    return (_jsxs("div", { className: "meta-section", children: [_jsxs("div", { className: "meta-field", children: [_jsx("label", { children: "N\u00E1zev" }), _jsx("input", { type: "text", value: meta.title, onChange: e => onChange({ title: e.target.value }) })] }), _jsxs("div", { className: "meta-field", children: [_jsx("label", { children: "Organizace" }), _jsx("input", { type: "text", value: meta.org, onChange: e => onChange({ org: e.target.value }) })] }), _jsxs("div", { className: "meta-field", children: [_jsx("label", { children: "Rok" }), _jsx("input", { type: "text", value: meta.year, onChange: e => onChange({ year: e.target.value }) })] }), _jsxs("div", { className: "meta-field", children: [_jsx("label", { children: "P\u00EDsmo (pt)" }), _jsx("input", { type: "number", value: meta.fontSize, min: 6, max: 16, step: 0.5, onChange: e => onChange({ fontSize: parseFloat(e.target.value) || 9.5 }) })] }), _jsxs("div", { className: "meta-field", style: { gridColumn: '1 / -1' }, children: [_jsx("label", { children: "Web / odkaz" }), _jsx("input", { type: "text", placeholder: "samostuduj.cz", value: meta.web, onChange: e => onChange({ web: e.target.value }) })] }), _jsxs("div", { className: "meta-field", style: { gridColumn: '1 / -1' }, children: [_jsx("label", { children: "Logo" }), _jsxs("div", { className: "logo-input-row", children: [_jsx("label", { className: "logo-btn", htmlFor: "meta-logo", children: "Vybrat soubor" }), _jsx("input", { id: "meta-logo", type: "file", accept: "image/*", style: { display: 'none' }, onChange: handleLogo }), _jsx("span", { className: "logo-filename", children: meta.logo ? 'logo (načteno)' : '—' }), meta.logo && (_jsx("button", { className: "logo-clear", onClick: () => onChange({ logo: '' }), children: "\u2715" }))] })] })] }));
}
