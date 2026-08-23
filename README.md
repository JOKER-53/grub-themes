# JOKER53's GRUB

> A curated collection of GRUB2 boot-menu themes for Linux, with a one-command interactive installer.

[![ShellCheck](https://github.com/KADHIRAVANEG/grub-themes/actions/workflows/shellcheck.yml/badge.svg)](https://github.com/KADHIRAVANEG/grub-themes/actions/workflows/shellcheck.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Preview every theme before touching your bootloader →** [kadhiravaneg.github.io/grub-themes](https://kadhiravaneg.github.io/grub-themes/)

```bash
git clone https://github.com/KADHIRAVANEG/grub-themes.git gorgeous-grub
cd gorgeous-grub
sudo ./install.sh
```

Pick a theme from the dropdown, reboot, enjoy.

---

## What you get

Each theme ships its own `background_ui.png` (pre-rendered with real fonts via Python/PIL) and a hand-written `theme.txt`:

| #  | Slug          | Vibe                                                        | Status |
| -- | ------------- | ----------------------------------------------------------- | ------ |
| 01 | `miku`        | Centered cyan hologram panel, vocaloid energy               | ✅ |
| 02 | `penguin`     | ASCII Tux terminal, classic GNU/Linux feel                  | ✅ |
| 03 | `nes`         | 8-bit cartridge select screen, PRESS START                  | ✅ |
| 04 | `street`      | Cyberpunk right-rail terminal, magenta neon glitch          | ✅ |
| 05 | `noir`        | Spider-Noir comic panel, halftone rain, hard-boiled menu    | ✅ |
| 06 | `bmw`         | Cinematic automotive HUD, telemetry bars and throttle       | ✅ |
| 07 | `nimbus`      | macOS-style bottom dock under a soft animated sky           | 🔧 |
| 08 | `gas_station` | Retro pump display, warm lo-fi sunset strip                 | 🔧 |
| 09 | `celebrate`   | Hand-drawn line catalog, every OS a different hat           | 🔧 |
| 10 | `ben`         | Ben 10 Omnitrix dial selector, green plasma core            | 🔧 |

✅ = fully working | 🔧 = in progress

---

## How it works

`install.sh`:

1. Detects your GRUB layout (`/boot/grub` on Debian/Ubuntu/Arch, `/boot/grub2` on Fedora/RHEL).
2. Runs pre-flight checks — verifies GRUB is installed, `theme.txt` exists and is non-empty, and `/boot` has enough free space before writing anything.
3. Backs up `/etc/default/grub` → `/etc/default/grub.gorgeous.bak` **on first run only**.
4. Copies the chosen theme into `/boot/grub/themes/<slug>/`.
5. Upserts these keys in `/etc/default/grub`:
   - `GRUB_THEME=/boot/grub/themes/<slug>/theme.txt`
   - `GRUB_TIMEOUT=15`
   - `GRUB_GFXMODE=1920x1080x32`
   - `GRUB_GFXPAYLOAD_LINUX=keep`
   - `GRUB_TERMINAL_OUTPUT=gfxterm`
6. Regenerates GRUB config with `update-grub` or `grub[2]-mkconfig`.

---

## Commands

```bash
sudo ./install.sh                  # interactive dropdown
sudo ./install.sh miku             # install specific theme by slug
sudo ./install.sh -t 10            # set boot timeout to 10 seconds
sudo ./install.sh -t 10 miku       # set timeout AND install theme
sudo ./install.sh -l               # list all themes
sudo ./install.sh -u               # restore original /etc/default/grub
sudo ./install.sh -u --purge       # restore config AND delete theme files
sudo ./install.sh -h               # help
```

---

## Requirements

- GRUB2 installed (`update-grub`, `grub-mkconfig`, or `grub2-mkconfig` on `$PATH`)
- `bash` 4+, `sed`, `find`, `cp`, `install`, `df`, `du`
- Root — writes to `/etc/default/grub` and `/boot/`
- Python 3 + Pillow (`pip install Pillow`) — only needed to regenerate `background_ui.png`

---

## Tested on

Debian, Ubuntu, Arch, Manjaro, Fedora, CachyOS.

---

## Troubleshooting

**Theme looks pixelated or screen goes blank**
GRUB_GFXMODE=1920x1080x32
Edit `/etc/default/grub`, replace with your resolution, then `sudo update-grub`.

**Windows or other OS entries disappeared**
Make sure `GRUB_DISABLE_OS_PROBER=true` is not set in `/etc/default/grub`.
```bash
sudo pacman -S os-prober        # Arch/CachyOS
sudo apt install os-prober      # Debian/Ubuntu
sudo dnf install os-prober      # Fedora
```

**Theme doesn't appear with Secure Boot enabled**
Graphical GRUB themes require `gfxterm` which can conflict with Secure Boot. See your distro's docs.

**"no themes found" error**
Run from the cloned repo root:
```bash
cd gorgeous-grub
sudo ./install.sh
```

**"/boot has insufficient space"**
```bash
sudo pacman -Sc      # Arch/CachyOS
sudo apt autoremove  # Debian/Ubuntu
sudo dnf autoremove  # Fedora
```

---

## Browse before you install

The repo root is a self-contained static site served via GitHub Pages.

Run locally:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Add your own theme

```bash
mkdir my-theme
# drop background.png (1920×1080) into the folder
# write theme.txt — see GRUB Theme Reference:
# https://www.gnu.org/software/grub/manual/grub/html_node/Theme-file-format.html
```

Register in gallery by adding an entry to `themes.json`, then:
```bash
sudo ./install.sh my-theme
```

---

## Undo

```bash
sudo ./install.sh -u               # restore /etc/default/grub
sudo ./install.sh -u --purge       # restore + delete theme files from /boot
```

---

## Repo layout
.
├── install.sh # interactive installer
├── README.md
├── LICENSE
├── index.html # GitHub Pages gallery
├── styles.css
├── app.js
├── themes.json # gallery manifest
├── fonts/ # source TTF + converted pf2 fonts
├── miku/ # theme folders
├── penguin/
├── nes/
├── street/
├── noir/
├── bmw/
├── nimbus/
├── gas_station/
├── celebrate/
└── ben/

---

## License

MIT for the code (`install.sh`, static site). See [LICENSE](./LICENSE).
Background artwork belongs to respective artists — see each theme folder for attribution.
PRs welcome.
