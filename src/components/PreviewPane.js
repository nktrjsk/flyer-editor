import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef } from 'react';
import Page from './Page';
function fitTitles(pane) {
    pane.querySelectorAll('.page-title').forEach(el => {
        const max = 34, min = 14;
        el.style.whiteSpace = 'nowrap';
        el.style.fontSize = `${max}pt`;
        let size = max;
        while (el.scrollWidth > el.offsetWidth && size > min) {
            size -= 0.5;
            el.style.fontSize = `${size}pt`;
        }
        if (el.scrollWidth > el.offsetWidth) {
            el.style.whiteSpace = 'normal';
        }
    });
}
export default function PreviewPane({ meta, markdown }) {
    const paneRef = useRef(null);
    const fontsReady = useRef(false);
    // Gate first fitTitles on fonts being loaded
    useEffect(() => {
        document.fonts.ready.then(() => {
            fontsReady.current = true;
            if (paneRef.current)
                fitTitles(paneRef.current);
        });
    }, []);
    useLayoutEffect(() => {
        if (fontsReady.current && paneRef.current) {
            fitTitles(paneRef.current);
        }
    });
    const sections = markdown.split(/\n\s*---\s*\n/);
    return (_jsx("div", { className: "preview-pane", id: "preview", ref: paneRef, children: sections.map((section, i) => (_jsx(Page, { section: section, meta: meta, isFirst: i === 0, pageIndex: i, total: sections.length }, i))) }));
}
