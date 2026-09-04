/* Gorgeous GRUB — vanilla site logic */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = { themes: [], filter: "all", query: "" };

async function loadThemes() {
  if (Array.isArray(window.GRUB_THEME_CATALOG)) {
    state.themes = window.GRUB_THEME_CATALOG;
    state.themes.forEach(hydrateThemeConfig);
    return;
  }
  const res = await fetch("./themes.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`themes.json returned HTTP ${res.status}`);
  state.themes = await res.json();
  await Promise.all(state.themes.map(async (theme) => {
    const themeRes = await fetch(`./${encodeURIComponent(theme.slug)}/theme.txt`, { cache: "no-cache" });
    if (!themeRes.ok) throw new Error(`${theme.slug}/theme.txt returned HTTP ${themeRes.status}`);
    theme.themeText = await themeRes.text();
    hydrateThemeConfig(theme);
  }));
}

function parseComponent(source, component, required = false) {
  const block = source.match(new RegExp(`\\+\\s*${component}\\s*\\{([\\s\\S]*?)\\}`));
  if (!block) {
    if (required) throw new Error(`theme.txt has no ${component} component`);
    return null;
  }
  const values = {};
  for (const line of block[1].split("\n")) {
    const property = line.match(/^\s*([a-z_]+)\s*=\s*(?:"([^"]*)"|([^\s#]+))/);
    if (property) values[property[1]] = property[2] ?? property[3];
  }
  return values;
}

function parseComponents(source, component) {
  const blocks = [];
  const expression = new RegExp(`\\+\\s*${component}\\s*\\{([\\s\\S]*?)\\}`, "g");
  for (const match of source.matchAll(expression)) {
    const values = {};
    for (const line of match[1].split("\n")) {
      const property = line.match(/^\s*([a-z_]+)\s*=\s*(?:"([^"]*)"|([^\s#]+))/);
      if (property) values[property[1]] = property[2] ?? property[3];
    }
    blocks.push(values);
  }
  return blocks;
}

function hydrateThemeConfig(theme) {
  const desktop = theme.themeText.match(/^\s*desktop-image:\s*"([^"]+)"/m);
  if (!desktop) throw new Error(`${theme.slug}/theme.txt has no desktop-image`);
  theme.desktopImage = desktop[1];
  theme.desktopScaleMethod = theme.themeText.match(/^\s*desktop-image-scale-method:\s*"?([^"\s]+)"?/m)?.[1] || "stretch";
  theme.bootMenus = parseComponents(theme.themeText, "boot_menu");
  if (!theme.bootMenus.length) throw new Error(`${theme.slug}/theme.txt has no boot_menu component`);
  theme.bootMenu = theme.bootMenus[0];
  theme.progressBar = parseComponent(theme.themeText, "progress_bar");
  theme.labels = parseComponents(theme.themeText, "label");
  theme.images = parseComponents(theme.themeText, "image");
}

function grubCoordinate(value, total, fallback = 0) {
  if (!value) return fallback;
  return value.endsWith("%") ? Number.parseFloat(value) * total / 100 : Number.parseFloat(value);
}

function styledBoxHtml(theme, pattern, x, y, width, height, edge = 8) {
  if (!pattern) return "";
  const asset = (part) => `./${encodeURIComponent(theme.slug)}/${pattern.replace("*", part).split("/").map(encodeURIComponent).join("/")}`;
  const middleWidth = Math.max(0, width - edge * 2);
  const middleHeight = Math.max(0, height - edge * 2);
  const image = (part, px, py, pw, ph) => `<image href="${asset(part)}" x="${px}" y="${py}" width="${pw}" height="${ph}" preserveAspectRatio="none"/>`;
  return image("nw", x, y, edge, edge) + image("n", x + edge, y, middleWidth, edge) + image("ne", x + width - edge, y, edge, edge)
    + image("w", x, y + edge, edge, middleHeight) + image("c", x + edge, y + edge, middleWidth, middleHeight) + image("e", x + width - edge, y + edge, edge, middleHeight)
    + image("sw", x, y + height - edge, edge, edge) + image("s", x + edge, y + height - edge, middleWidth, edge) + image("se", x + width - edge, y + height - edge, edge, edge);
}

function actualPreviewHtml(theme, lazy = false) {
  const selected = Math.max(0, Math.min(theme.menu.selected || 0, theme.menu.entries.length - 1));
  const clipId = `menu-${theme.slug.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const menuLayers = (theme.bootMenus || [theme.bootMenu]).map((menu, layerIndex) => {
    const left = grubCoordinate(menu.left, 1920);
    const top = grubCoordinate(menu.top, 1080);
    const width = grubCoordinate(menu.width, 1920, 960);
    const height = grubCoordinate(menu.height, 1080, 540);
    const itemHeight = Number.parseFloat(menu.item_height) || 52;
    const spacing = Number.parseFloat(menu.item_spacing) || 0;
    const padding = Number.parseFloat(menu.item_padding) || 0;
    const configuredFont = menu.item_font || "Unifont Regular 16";
    const fontSize = Number.parseFloat(configuredFont.match(/(\d+)(?!.*\d)/)?.[1]) || 16;
    const fontFamily = configuredFont.replace(/\s+(?:Regular|Bold|Italic)?\s*\d+$/i, "");
    const normalColor = menu.item_color || "#ffffff";
    const selectedColor = menu.selected_item_color === "inherit" ? normalColor : (menu.selected_item_color || normalColor);
    const rows = theme.menu.entries.map((entry, index) => {
      const y = top + index * (itemHeight + spacing);
      if (y >= top + height) return "";
      const rowStyle = index === selected ? menu.selected_item_pixmap_style : menu.item_pixmap_style;
      const rowBox = styledBoxHtml(theme, rowStyle, left, y, width, itemHeight);
      return `${rowBox}<text x="${left + padding}" y="${y + itemHeight * 0.67}" fill="${escapeHtml(index === selected ? selectedColor : normalColor)}" font-family="${escapeHtml(fontFamily)}, monospace" font-size="${fontSize}">${escapeHtml(entry)}</text>`;
    }).join("");
    const frame = styledBoxHtml(theme, menu.menu_pixmap_style, left, top, width, height);
    return `${frame}<g clip-path="url(#${clipId}-${layerIndex})">${rows}</g><clipPath id="${clipId}-${layerIndex}"><rect x="${left}" y="${top}" width="${width}" height="${height}"/></clipPath>`;
  }).join("");
  const imageLayers = (theme.images || []).map((component) => {
    if (!component.file) return "";
    const x = grubCoordinate(component.left, 1920);
    const y = grubCoordinate(component.top, 1080);
    const path = component.file.split("/").map(encodeURIComponent).join("/");
    return `<image href="./${encodeURIComponent(theme.slug)}/${path}" x="${x}" y="${y}"/>`;
  }).join("");
  const labels = (theme.labels || []).map((label) => {
    const labelLeft = grubCoordinate(label.left, 1920);
    const labelTop = grubCoordinate(label.top, 1080);
    const labelWidth = grubCoordinate(label.width, 1920);
    const labelFont = label.font || "Unifont Regular 16";
    const labelSize = Number.parseFloat(labelFont.match(/(\d+)(?!.*\d)/)?.[1]) || 16;
    const labelFamily = labelFont.replace(/\s+(?:Regular|Bold|Italic)?\s*\d+$/i, "");
    const anchor = label.align === "center" ? "middle" : label.align === "right" ? "end" : "start";
    const labelX = label.align === "center" ? labelLeft + labelWidth / 2 : label.align === "right" ? labelLeft + labelWidth : labelLeft;
    return `<text x="${labelX}" y="${labelTop + labelSize}" text-anchor="${anchor}" fill="${escapeHtml(label.color || "#ffffff")}" font-family="${escapeHtml(labelFamily)}, monospace" font-size="${labelSize}">${escapeHtml(label.text || "")}</text>`;
  }).join("");
  let progress = "";
  if (theme.progressBar) {
    const bar = theme.progressBar;
    const barLeft = grubCoordinate(bar.left, 1920);
    const barWidth = grubCoordinate(bar.width, 1920, 500);
    const barHeight = grubCoordinate(bar.height, 1080, 4);
    const barTop = bar.top ? grubCoordinate(bar.top, 1080) : 1080 - grubCoordinate(bar.bottom, 1080) - barHeight;
    progress = `<rect x="${barLeft}" y="${barTop}" width="${barWidth}" height="${barHeight}" fill="${escapeHtml(bar.bg_color || "#000000")}" stroke="${escapeHtml(bar.border_color || "#ffffff")}" stroke-width="1"/><rect x="${barLeft}" y="${barTop}" width="${barWidth * 0.62}" height="${barHeight}" fill="${escapeHtml(bar.fg_color || "#ffffff")}"/>`;
  }
  const desktopImage = theme.desktopImage.split("/").map(encodeURIComponent).join("/");
  return `<div class="actual-screen">
    <img class="actual-preview scale-${escapeHtml(theme.desktopScaleMethod)}" src="./${encodeURIComponent(theme.slug)}/${desktopImage}" alt="${escapeHtml(theme.title)} GRUB boot screen preview"${lazy ? ' loading="lazy"' : ""}>
    <svg class="actual-menu" viewBox="0 0 1920 1080" aria-hidden="true">
      ${imageLayers}${menuLayers}${labels}${progress}
    </svg>
  </div>`;
}

function uniqueTags(themes) {
  const set = new Set();
  themes.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
  return Array.from(set).sort();
}

function renderTags() {
  const tags = ["all", ...uniqueTags(state.themes)];
  const container = $("#tags");
  container.innerHTML = tags
    .map((t) => `<button class="tag${t === state.filter ? " active" : ""}" data-tag="${t}">${t === "all" ? "all" : "#" + t}</button>`)
    .join("");
  $$(".tag", container).forEach((el) =>
    el.addEventListener("click", () => { state.filter = el.dataset.tag; renderTags(); renderGrid(); })
  );
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.themes.filter((t) => {
    const matchesTag = state.filter === "all" || (t.tags || []).includes(state.filter);
    const matchesQuery = !q || t.title.toLowerCase().includes(q) || t.tagline.toLowerCase().includes(q) || (t.tags || []).some((tag) => tag.includes(q));
    return matchesTag && matchesQuery;
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function entriesHtml(m, cls = "") {
  return m.entries.map((e, i) => `<li class="${cls}${i === m.selected ? " sel" : ""}">${escapeHtml(e)}</li>`).join("");
}

function maintenanceOverlay(label = "🔧 Under Maintenance") {
  return `<div class="maintenance-overlay"><span>${label}</span></div>`;
}

function mockMiku(t) {
  const m = t.menu;
  return `
    <div class="grub g-miku">
      <div class="g-miku-frame">
        <div class="g-miku-corners"><i></i><i></i><i></i><i></i></div>
        <div class="g-miku-title">${escapeHtml(m.title)}</div>
        <ul class="g-miku-list">${entriesHtml(m)}</ul>
        <div class="g-miku-bar"><span></span></div>
        <div class="g-miku-meta"><span>SYS::OK</span><span>${escapeHtml(m.timeout)}</span></div>
      </div>
    </div>`;
}

function mockPenguin(t) {
  const m = t.menu;
  const tux = ["   .--.", "  |o_o |", "  |:_/ |", " //   \\ \\", "(|     | )", "/'\\_   _/`\\", "\\___)=(___/"].join("\n");
  return `
    <div class="grub g-penguin">
      <div class="g-pen-bar"><span class="d r"></span><span class="d y"></span><span class="d g"></span><span class="t">${escapeHtml(m.title)}</span></div>
      <div class="g-pen-body">
        <pre class="g-pen-tux">${tux}</pre>
        <div class="g-pen-menu">
          <div class="g-pen-prompt">$ select-os --timeout=${escapeHtml(m.timeout)}</div>
          <ul>${entriesHtml(m)}</ul>
          <div class="g-pen-hint">↑/↓ move · ↵ boot</div>
        </div>
      </div>
    </div>`;
}

function mockNes(t) {
  const m = t.menu;
  const items = m.entries.map((e, i) => `<li class="${i === m.selected ? "sel" : ""}"><span>${i === m.selected ? "►" : " "}</span>${escapeHtml(e)}</li>`).join("");
  return `
    <div class="grub g-nes">
      <div class="g-nes-screen">
        <div class="g-nes-logo">GRUB-NES</div>
        <div class="g-nes-title">${escapeHtml(m.title)}</div>
        <ul>${items}</ul>
        <div class="g-nes-blink">${escapeHtml(m.timeout)}</div>
      </div>
    </div>`;
}

function mockNimbus(t) {
  const m = t.menu;
  const icons = ["◐", "◑", "◒", "◓"];
  const items = m.entries.map((e, i) => `
    <div class="g-nim-app ${i === m.selected ? "sel" : ""}">
      <div class="g-nim-icon">${icons[i % icons.length]}</div>
      <div class="g-nim-label">${escapeHtml(e)}</div>
    </div>`).join("");
  return `
    <div class="grub g-nimbus" style="position:relative">
      ${maintenanceOverlay()}
      <div class="g-nim-top">${escapeHtml(m.title)} · ${escapeHtml(m.timeout)}</div>
      <div class="g-nim-dock">${items}</div>
    </div>`;
}

function mockStreet(t) {
  const m = t.menu;
  return `
    <div class="grub g-street">
      <div class="g-st-glitch">${escapeHtml(m.title)}</div>
      <ul class="g-st-list">${entriesHtml(m)}</ul>
      <div class="g-st-foot">
        <span class="g-st-tag">NET//OK</span>
        <span class="g-st-tick">${escapeHtml(m.timeout)}</span>
      </div>
    </div>`;
}

function mockGas(t) {
  const m = t.menu;
  const items = m.entries.map((e, i) => `
    <div class="g-gas-cell ${i === m.selected ? "sel" : ""}">
      <div class="g-gas-num">0${i + 1}</div>
      <div class="g-gas-name">${escapeHtml(e)}</div>
      <div class="g-gas-bar"><span style="width:${20 + i * 20}%"></span></div>
    </div>`).join("");
  return `
    <div class="grub g-gas" style="position:relative">
      ${maintenanceOverlay()}
      <div class="g-gas-head"><span>${escapeHtml(m.title)}</span><span class="g-gas-time">${escapeHtml(m.timeout)}</span></div>
      <div class="g-gas-row">${items}</div>
    </div>`;
}

function mockBmw(t) {
  const m = t.menu;
  const items = m.entries.map((e, i) => `
    <div class="g-bmw-row ${i === m.selected ? "sel" : ""}">
      <div class="g-bmw-gear">G${i + 1}</div>
      <div class="g-bmw-name">${escapeHtml(e)}</div>
      <div class="g-bmw-rpm"><span style="width:${30 + i * 18}%"></span></div>
      <div class="g-bmw-kmh">${80 + i * 40}<small>km/h</small></div>
    </div>`).join("");
  return `
    <div class="grub g-bmw">
      <div class="g-bmw-top">
        <span class="g-bmw-badge">M</span>
        <span class="g-bmw-title">${escapeHtml(m.title)}</span>
        <span class="g-bmw-time">${escapeHtml(m.timeout)}</span>
      </div>
      <div class="g-bmw-grid">${items}</div>
      <div class="g-bmw-hud"><span>ABS</span><span>DSC</span><span>SPORT+</span><span>● REC</span></div>
    </div>`;
}

function mockCelebrate(t) {
  const m = t.menu;
  const hats = ["⌬", "★", "✦", "☠", "♔"];
  const items = m.entries.map((e, i) => `
    <li class="${i === m.selected ? "sel" : ""}">
      <span class="g-cel-hat">${hats[i % hats.length]}</span>
      <span class="g-cel-bottle"></span>
      <span class="g-cel-name">${escapeHtml(e)}</span>
    </li>`).join("");
  return `
    <div class="grub g-celebrate" style="position:relative">
      ${maintenanceOverlay()}
      <ul class="g-cel-list">${items}</ul>
      <div class="g-cel-title">${escapeHtml(m.title)}</div>
      <div class="g-cel-sub">— ${escapeHtml(m.timeout)} —</div>
    </div>`;
}

function mockBen(t) {
  const m = t.menu;
  const items = m.entries.map((e, i) => {
    const angle = (360 / m.entries.length) * i - 90;
    return `<div class="g-ben-slot ${i === m.selected ? "sel" : ""}" style="transform:rotate(${angle}deg) translate(110px) rotate(${-angle}deg)">${escapeHtml(e.split(" · ")[0])}</div>`;
  }).join("");
  return `
    <div class="grub g-ben" style="position:relative">
      ${maintenanceOverlay()}
      <div class="g-ben-dial">
        <div class="g-ben-core">⏣</div>
        ${items}
      </div>
      <div class="g-ben-foot">
        <span>${escapeHtml(m.title)}</span>
        <span class="g-ben-timer">${escapeHtml(m.timeout)}</span>
      </div>
    </div>`;
}

function mockNoir(t) {
  const m = t.menu;
  const items = m.entries.map((e, i) => `
    <li class="${i === m.selected ? "sel" : ""}">
      <span class="g-noir-num">№ 0${i + 1}</span>
      <span class="g-noir-text">${escapeHtml(e)}</span>
    </li>`).join("");
  return `
    <div class="grub g-noir">
      <div class="g-noir-rain"></div>
      <div class="g-noir-chapter">${escapeHtml(m.title)}</div>
      <ul class="g-noir-list">${items}</ul>
      <div class="g-noir-foot">
        <span class="g-noir-stamp">CONFIDENTIAL</span>
        <span>${escapeHtml(m.timeout)}</span>
      </div>
    </div>`;
}

const mocks = { miku: mockMiku, penguin: mockPenguin, nes: mockNes, nimbus: mockNimbus, street: mockStreet, gas: mockGas, bmw: mockBmw, celebrate: mockCelebrate, ben: mockBen, noir: mockNoir };

function grubMockHtml(theme) {
  const fn = mocks[theme.layout] || mockMiku;
  return fn(theme);
}

function statusBadge(theme) {
  if (theme.status === "maintenance") {
    return `<span class="badge badge-maintenance">🔧 Maintenance</span>`;
  }
  return `<span class="badge badge-working">✅ Working</span>`;
}

function renderGrid() {
  const items = filtered();
  const grid = $("#theme-grid");
  if (!items.length) {
    grid.innerHTML = `<p class="loading">No configs match. Try clearing the filter.</p>`;
    return;
  }
  grid.innerHTML = items.map((t) => {
    const num = String(state.themes.indexOf(t) + 1).padStart(2, "0");
    return `
      <article class="card${t.status === "maintenance" ? " card-maintenance" : ""}" data-slug="${t.slug}">
        <p class="card-head">${num} // <b>${escapeHtml(t.title.toUpperCase())}</b></p>
        <div class="card-preview">${actualPreviewHtml(t, true)}</div>
        <div class="card-meta">
          <span class="name">${escapeHtml(t.tagline)} ${t.status === "maintenance" ? statusBadge(t) : ""}</span>
          <span class="cmd">sudo ./install.sh ${t.slug}</span>
        </div>
      </article>`;
  }).join("");
  $$(".card", grid).forEach((card) =>
    card.addEventListener("click", () => openModal(card.dataset.slug))
  );
}

async function openModal(slug) {
  const theme = state.themes.find((t) => t.slug === slug);
  if (!theme) return;
  const modal = $("#theme-modal");
  $("[data-field=title]", modal).textContent = theme.title;
  $("[data-field=layout]", modal).textContent = `${theme.layoutLabel} · ${theme.font}`;
  $("[data-field=tagline]", modal).textContent = theme.tagline;
  $("[data-field=cmd]", modal).textContent = `sudo ./install.sh ${theme.slug}`;
  $("[data-field=preview]", modal).innerHTML = `
    <div class="actual-preview-wrap">${actualPreviewHtml(theme)}</div>`;
  $("[data-field=preview]", modal).firstElementChild.dataset.slug = theme.slug;
  $("[data-field=preview]", modal).firstElementChild.classList.add("card");
  const txtEl = $("[data-field=theme-txt]", modal);
  txtEl.textContent = "Loading…";
  try {
    const res = await fetch(`./${theme.slug}/theme.txt`, { cache: "no-cache" });
    txtEl.textContent = res.ok ? await res.text() : "(theme.txt not found)";
  } catch { txtEl.textContent = "(theme.txt not found)"; }
  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "");
}

function wireModal() {
  const modal = $("#theme-modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.matches("[data-close]")) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  });
}

function wireSearch() {
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); });
}

function updateCtaCount() {
  $("#cta-count").textContent = `browse ${state.themes.length}`;
}

(async function init() {
  wireModal();
  wireSearch();
  try {
    await loadThemes();
    renderTags();
    renderGrid();
    updateCtaCount();
  } catch (error) {
    console.error(error);
    $("#theme-grid").innerHTML = `<p class="loading">Could not load the theme catalog. Serve this directory over HTTP and try again.</p>`;
  }
})();
