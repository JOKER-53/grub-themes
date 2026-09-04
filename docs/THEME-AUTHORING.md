# Theme authoring

This project treats each GRUB theme as the source of truth. The website preview is derived from the theme files; it must not be a separate approximation.

## Theme folder

Every installable theme needs this minimum structure:

```text
my_theme/
├── theme.txt
├── background.png
├── fonts/
│   └── MyFont-20.pf2
└── box/
    ├── sel_c.png
    ├── sel_n.png
    ├── sel_ne.png
    ├── sel_e.png
    ├── sel_se.png
    ├── sel_s.png
    ├── sel_sw.png
    ├── sel_w.png
    └── sel_nw.png
```

A layered theme can additionally provide `overlay.png`, normal-item slices, menu-frame slices, icons, and other GRUB-compatible raster assets.

## Preserve supplied artwork

Do not bake menu UI, dimming, color grading, or generated artwork into a supplied background. Keep the original background byte-for-byte unchanged and place custom interface artwork in a transparent PNG:

```text
+ image {
    left = 0
    top = 0
    file = "overlay.png"
}
```

Place the image component before labels and menus so the interactive content is drawn above it. The current layered themes use a 1920×1080 overlay matching their source backgrounds.

## Creating visibly different layouts

Moving the same menu is not sufficient. Give each theme a distinct composition using a deliberate combination of:

- transparent interface artwork tailored to the empty space in its background;
- different menu dimensions, position, row height, padding, and spacing;
- `menu_pixmap_style` for a full menu frame;
- `item_pixmap_style` for every normal row;
- `selected_item_pixmap_style` for the active row;
- multiple overlapping `boot_menu` components when a shadow or graphical layer is needed;
- independent labels for headings, status information, instructions, and timeout text;
- `image` components for logos, dividers, dashboards, and decorative structures;
- a progress bar or timeout label appropriate to the theme.

GRUB's boot menu itself remains a vertical list. A horizontal dock can be decorative, but it must not be represented as an interactive horizontal selector in the preview.

## Styled boxes

GRUB styled boxes use nine PNG slices with a shared wildcard pattern:

```text
nw  n  ne
w   c  e
sw  s  se
```

Example:

```text
+ boot_menu {
    left = 5%
    top = 25%
    width = 36%
    height = 45%
    item_font = "VT323 Regular 24"
    item_color = "#b98f9c"
    selected_item_color = "#ffffff"
    item_height = 54
    item_padding = 18
    item_spacing = 12
    menu_pixmap_style = "box/frame_*.png"
    item_pixmap_style = "box/item_*.png"
    selected_item_pixmap_style = "box/sel_*.png"
    scrollbar = false
}
```

All nine files referenced by a wildcard must exist. The validation script checks this.

## Fonts

Every font named by `font`, `item_font`, or `selected_item_font` must be bundled as a PF2 file in the theme's `fonts/` directory. The internal PF2 family and size must match the string used in `theme.txt`.

## Website manifest

Add the theme to `themes.json`. Important fields are:

- `slug`: exact directory name and installer argument;
- `background`: browser fallback image path;
- `layoutLabel`: short description of the actual composition;
- `menu.entries`: representative preview entries;
- `menu.selected`: selected preview row;
- `status`: `working` or `maintenance`.

The browser parser currently mirrors GRUB desktop images, multiple image and boot-menu components, labels, progress bars, menu frames, normal-item boxes, and selected-item boxes.

## Regenerate and validate

Run these after changing a theme or manifest entry:

```bash
node tools/generate-catalog.mjs
bash tests/validate.sh
git diff --check
```

`catalog.generated.js` must be committed with the source changes. It allows `index.html` to work when opened directly rather than through a web server.

The validation checks backgrounds, referenced image components, styled-box slices, bundled fonts, manifest paths, installer syntax, JavaScript syntax, and catalog freshness. It does not install a theme or modify the computer's GRUB configuration.

## Review checklist

- Supplied background remains byte-identical.
- Menu occupies genuinely usable negative space in the artwork.
- Text remains readable without dimming the entire background.
- Normal and selected entries are distinguishable.
- Every referenced file is stored inside the theme directory.
- Website preview comes from `theme.txt` and matches the GRUB composition.
- `catalog.generated.js` is current.
- `bash tests/validate.sh` passes.
- No installer or reboot command is used during code-level validation.

GRUB theme syntax reference: <https://www.gnu.org/software/grub/manual/grub/html_node/Theme-file-format.html>
