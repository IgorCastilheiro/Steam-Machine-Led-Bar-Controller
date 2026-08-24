# Steam Machine LED Bar Controller

<img width="1275" height="711" alt="Screenshot_20260824_190645" src="https://github.com/user-attachments/assets/b8fb08c1-9bab-4c9b-87cc-77c84a3d4f79" />
<img width="480" height="848" alt="SteamMachine2" src="https://github.com/user-attachments/assets/0d2a8ec1-6971-4f54-ba80-c920ef8da6da" />
<img width="480" height="848" alt="SteamMachine" src="https://github.com/user-attachments/assets/84da5667-47ce-4952-a529-f09ec5267099" />


An Electron desktop application to control the LED bar on the Steam Machine.
Controls the 17 valve-leds via `/sys/class/leds/valve-leds[*]`.

## Features

- Control all 17 individual LEDs (valve-leds[0] through valve-leds[16])
- Set brightness for each LED or all at once
- Set RGB color via `multi_intensity`
- Enable/disable LEDs
- Driver effects: rainbow, breath, patrol, normal, demo, factory
- Manual color presets: solid color, gradient, rainbow
- Breathing effect control (breath level, breath offset)
- Save and load LED profiles
- Safe slider control (writes only on release, not while dragging)
- Async lock to prevent concurrent sysfs writes that crash the driver

## Requirements

- Linux x86_64 (SteamOS / Steam Machine)
- `valve-leds` present in `/sys/class/leds/`
- Node.js 18+ (only for building, not needed to run the built app)


## Installation

### 1. Install udev rules (one-time, requires sudo)

```bash
sudo cp 99-valve-leds.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
```

You may need to reboot for the rules to take full effect.

### 2. Get Node.js (if not installed)

Install Node.js using the official method from https://nodejs.org/en/download:

```bash
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash

# In lieu of restarting the shell:
. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:
nvm install 24

# Verify installation:
node -v
npm -v
```

### 3. Install dependencies and run

```bash
npm install
npm start
```

### 4. Build a distributable (optional)

```bash
npm run dist
```

This creates a self-contained AppImage in `dist/` to run the binary directly.

## Project Structure

```
├── 99-valve-leds.rules      # Udev rules for non-root LED access
├── README.md
└── electron/
    ├── package.json          # Node/Electron config + build scripts
    ├── main.js               # Electron main process + IPC handlers
    ├── preload.js            # Secure bridge (contextBridge)
    ├── led-backend.js        # Sysfs backend (read/write valve-leds)
    ├── index.html            # UI layout
    ├── renderer.js           # UI logic (sliders write on release only)
    └── styles.css            # Dark theme styling
```

## Important Notes

- Hex attributes (breath_level, brightness_scale, etc.) are read/written in hex format
- The delay range is 0-20 only — values outside this range can crash the driver
- Rapid writes to sysfs can crash the kernel driver — the app uses 50ms delays between writes and an async lock to serialize operations
- Sliders only write to sysfs on release (not while dragging) to prevent flooding the driver

## License

MIT License
