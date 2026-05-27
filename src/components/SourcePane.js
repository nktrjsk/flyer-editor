import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import MetaSection from './MetaSection';
import MarkdownEditor from './MarkdownEditor';
export default function SourcePane({ meta, markdown, onMetaChange, onMarkdownChange }) {
    return (_jsxs("div", { className: "source-pane", children: [_jsx(MetaSection, { meta: meta, onChange: onMetaChange }), _jsx(MarkdownEditor, { value: markdown, onChange: onMarkdownChange })] }));
}
