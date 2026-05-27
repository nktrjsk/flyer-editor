const source  = document.getElementById('md-source');
const preview = document.getElementById('preview');

const metaIds = ['meta-title', 'meta-org', 'meta-year', 'meta-web', 'meta-fontsize'];

// ── Logo ──────────────────────────────────────────
// Restored from logo-store on re-open of a saved (standalone) file
let logoSrc = document.getElementById('logo-store').getAttribute('src') || '';

document.getElementById('meta-logo').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    logoSrc = e.target.result;
    document.getElementById('logo-store').src = logoSrc;
    document.getElementById('logo-filename').textContent = file.name;
    document.getElementById('logo-clear').style.display = '';
    scheduleRender();
  };
  reader.readAsDataURL(file);
});

function clearLogo() {
  logoSrc = '';
  document.getElementById('logo-store').removeAttribute('src');
  document.getElementById('logo-filename').textContent = '—';
  document.getElementById('logo-clear').style.display = 'none';
  document.getElementById('meta-logo').value = '';
  scheduleRender();
}

// ── Escape HTML ───────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Auto-scale title to fit page width ────────────
function fitTitles() {
  document.querySelectorAll('.page-title').forEach(el => {
    const max = 34, min = 14;
    el.style.whiteSpace = 'nowrap';
    el.style.fontSize = max + 'pt';

    let size = max;
    while (el.scrollWidth > el.offsetWidth && size > min) {
      size -= 0.5;
      el.style.fontSize = size + 'pt';
    }

    // Still overflowing at min size → allow wrapping
    if (el.scrollWidth > el.offsetWidth) {
      el.style.whiteSpace = 'normal';
    }
  });
}

// ── Render ────────────────────────────────────────
function render() {
  const title    = document.getElementById('meta-title').value.trim();
  const org      = document.getElementById('meta-org').value.trim();
  const year     = document.getElementById('meta-year').value.trim();
  const web      = document.getElementById('meta-web').value.trim();
  const fontSize = parseFloat(document.getElementById('meta-fontsize').value) || 9.5;

  const sections = source.value.split(/\n\s*---\s*\n/);
  preview.innerHTML = '';

  sections.forEach((section, i) => {
    // Page label (screen only, hidden in print)
    const labelEl = document.createElement('div');
    labelEl.className = 'page-label';
    labelEl.textContent =
      sections.length === 1 ? 'Náhled' :
      i === 0              ? 'Přední strana' :
      i === 1              ? 'Zadní strana'  :
                             `Strana ${i + 1}`;
    preview.appendChild(labelEl);

    // Page
    const page = document.createElement('div');
    page.className = 'page';
    page.style.setProperty('--base', fontSize + 'pt');

    // Title block on first page only
    const titleBlock = i === 0 ? `
      <div class="page-title-block">
        <div>
          <div class="page-title">${esc(title)}</div>
          <div class="page-meta">${esc(org)}${year ? ' · ' + esc(year) : ''}</div>
        </div>
        ${logoSrc ? `<img class="page-logo" src="${logoSrc}" alt="">` : ''}
      </div>` : '';

    // Footer on every page
    const footer = `
      <div class="page-footer">
        <span>${esc(org)}</span>
        <span>${web ? esc(web) + ' · ' : ''}CC BY-SA 4.0</span>
      </div>`;

    page.innerHTML = `
      ${titleBlock}
      <div class="page-content">
        ${marked.parse(section.trim(), { gfm: true })}
      </div>
      ${footer}
    `;

    preview.appendChild(page);
  });

  fitTitles();
}

// ── Debounced input handlers ──────────────────────
let timer;
function scheduleRender() {
  clearTimeout(timer);
  timer = setTimeout(render, 200);
}

source.addEventListener('input', scheduleRender);
metaIds.forEach(id =>
  document.getElementById(id).addEventListener('input', scheduleRender)
);

// ── Download ──────────────────────────────────────
// In dev (split files), fetches and inlines CSS+JS for a self-contained output.
// In a standalone downloaded file, just serialises the current DOM.
async function downloadHTML() {
  // Bake current form state into DOM
  source.defaultValue = source.value;
  metaIds.forEach(id => {
    const el = document.getElementById(id);
    el.setAttribute('value', el.value);
  });

  const isDev = !!document.querySelector('script[src="editor.js"]');
  let html;

  if (isDev) {
    let css, js;
    try {
      [css, js] = await Promise.all([
        fetch('style.css').then(r => { if (!r.ok) throw r; return r.text(); }),
        fetch('editor.js').then(r => { if (!r.ok) throw r; return r.text(); }),
      ]);
    } catch {
      alert('Stahování selhalo.\nSpusť editor přes lokální server, např.:\n  python3 -m http.server');
      return;
    }

    const title = document.getElementById('meta-title').value.trim();
    html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title) || 'Samostuduj — editor letáku'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"><\/script>
  <style>
${css}
  </style>
</head>
<body>
${document.body.innerHTML}
<script>
${js}
<\/script>
</body>
</html>`;
  } else {
    // Already standalone — serialise current DOM as-is
    html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  }

  const filename = (document.getElementById('meta-title').value.trim() || 'letak')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '.html';

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Init ──────────────────────────────────────────
document.getElementById('meta-year').value = new Date().getFullYear();

if (logoSrc) {
  document.getElementById('logo-filename').textContent = 'logo (uloženo)';
  document.getElementById('logo-clear').style.display = '';
}

document.fonts.ready.then(render);
