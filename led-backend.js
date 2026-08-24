/**
 * Steam Machine LED Bar Backend
 * Handles reading/writing to /sys/class/leds/valve-leds[*] files.
 *
 * Key safety rules:
 * - Always set effect to "manual" before writing color/brightness
 * - Write hex values for breath_level, breath_offset, brightness_scale, etc.
 * - Delay range is 0-20 only
 * - Never write to read-only files (trigger, max_brightness, etc.)
 * - Small delay between writes to avoid driver crashes
 * - Use a lock to prevent concurrent writes
 *
 * @author Igor Castilheiro
 * @year 2026
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LEDS_BASE_PATH = '/sys/class/leds';
const LED_COUNT = 17;
const LED_PREFIX = 'valve-leds';
const VALID_EFFECTS = ['patrol', 'breath', 'factory', 'normal', 'off', 'rainbow', 'demo', 'manual'];
const DELAY_MIN = 0;
const DELAY_MAX = 20;
const WRITE_DELAY_MS = 50;

/**
 * Simple async lock to prevent concurrent sysfs writes.
 */
class AsyncLock {
    constructor() {
        this._queue = [];
        this._locked = false;
    }

    async acquire() {
        return new Promise((resolve) => {
            if (!this._locked) {
                this._locked = true;
                resolve();
            } else {
                this._queue.push(resolve);
            }
        });
    }

    release() {
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            next();
        } else {
            this._locked = false;
        }
    }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a value that may be in hex (0x..) or decimal format.
 */
function parseHexValue(raw) {
    if (!raw || raw.trim() === '') return 0;
    raw = raw.trim();
    try {
        if (raw.startsWith('0x') || raw.startsWith('0X')) {
            return parseInt(raw, 16);
        }
        return parseInt(raw, 10) || 0;
    } catch {
        return 0;
    }
}

/**
 * Format a number as a hex string (e.g., 0x2b).
 */
function toHex(value) {
    return '0x' + Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Represents a single valve-leds[N] LED and its sysfs interface.
 */
class ValveLed {
    constructor(index, basePath = LEDS_BASE_PATH) {
        this.index = index;
        this.path = path.join(basePath, `${LED_PREFIX}[${index}]`);
    }

    _read(attribute) {
        const filepath = path.join(this.path, attribute);
        try {
            return fs.readFileSync(filepath, 'utf8').trim();
        } catch (e) {
            console.error(`Error reading ${filepath}: ${e.message}`);
            return '';
        }
    }

    _write(attribute, value) {
        const filepath = path.join(this.path, attribute);
        try {
            fs.writeFileSync(filepath, String(value));
            return true;
        } catch (e) {
            console.error(`Error writing ${filepath}: ${e.message}`);
            return false;
        }
    }

    exists() {
        try {
            return fs.statSync(this.path).isDirectory();
        } catch {
            return false;
        }
    }

    // -- Effect --
    getEffect() {
        return this._read('effect');
    }

    setEffect(effect) {
        if (!VALID_EFFECTS.includes(effect)) {
            console.error(`Invalid effect '${effect}'. Valid: ${VALID_EFFECTS}`);
            return false;
        }
        return this._write('effect', effect);
    }

    ensureManualMode() {
        if (this.getEffect() !== 'manual') {
            return this.setEffect('manual');
        }
        return true;
    }

    // -- Brightness --
    getBrightness() {
        return parseHexValue(this._read('brightness'));
    }

    setBrightness(value) {
        return this._write('brightness', String(clamp(value, 0, 255)));
    }

    getMaxBrightness() {
        const val = this._read('max_brightness');
        return val ? parseHexValue(val) : 255;
    }

    // -- Color (multi_intensity: R G B) --
    getColor() {
        const val = this._read('multi_intensity');
        if (val) {
            const parts = val.split(/\s+/);
            if (parts.length === 3) {
                return parts.map((p) => parseInt(p, 10) || 0);
            }
        }
        return [0, 0, 0];
    }

    setColor(r, g, b) {
        r = clamp(r, 0, 255);
        g = clamp(g, 0, 255);
        b = clamp(b, 0, 255);
        return this._write('multi_intensity', `${r} ${g} ${b}`);
    }

    // -- Enabled --
    getEnabled() {
        return this._read('enabled') === '1';
    }

    setEnabled(enabled) {
        return this._write('enabled', enabled ? '1' : '0');
    }

    // -- Breath level (hex) --
    getBreathLevel() {
        return parseHexValue(this._read('breath_level'));
    }

    setBreathLevel(value) {
        return this._write('breath_level', toHex(value));
    }

    // -- Breath offset (hex) --
    getBreathOffset() {
        return parseHexValue(this._read('breath_offset'));
    }

    setBreathOffset(value) {
        return this._write('breath_offset', toHex(value));
    }

    // -- Brightness scale (hex) --
    getBrightnessScale() {
        return parseHexValue(this._read('brightness_scale'));
    }

    setBrightnessScale(value) {
        return this._write('brightness_scale', toHex(value));
    }

    // -- Color shift (hex) --
    getColorShift() {
        return parseHexValue(this._read('color_shift'));
    }

    setColorShift(value) {
        return this._write('color_shift', toHex(value));
    }

    // -- Delay (hex, range 0-20) --
    getDelay() {
        return parseHexValue(this._read('delay'));
    }

    setDelay(value) {
        value = clamp(value, DELAY_MIN, DELAY_MAX);
        return this._write('delay', toHex(value));
    }

    // -- Patrol num (hex) --
    getPatrolNum() {
        return parseHexValue(this._read('patrol_num'));
    }

    setPatrolNum(value) {
        return this._write('patrol_num', toHex(value));
    }

    // -- Full state --
    getState() {
        return {
            index: this.index,
            effect: this.getEffect(),
            brightness: this.getBrightness(),
            color: this.getColor(),
            enabled: this.getEnabled(),
            breathLevel: this.getBreathLevel(),
            breathOffset: this.getBreathOffset(),
            brightnessScale: this.getBrightnessScale(),
            colorShift: this.getColorShift(),
            delay: this.getDelay(),
            patrolNum: this.getPatrolNum(),
        };
    }

    applyState(state) {
        if (state.effect !== undefined) this.setEffect(state.effect);
        if (state.enabled !== undefined) this.setEnabled(state.enabled);
        if (state.brightness !== undefined) this.setBrightness(state.brightness);
        if (state.color !== undefined) this.setColor(...state.color);
        if (state.breathLevel !== undefined) this.setBreathLevel(state.breathLevel);
        if (state.breathOffset !== undefined) this.setBreathOffset(state.breathOffset);
        if (state.brightnessScale !== undefined) this.setBrightnessScale(state.brightnessScale);
        if (state.colorShift !== undefined) this.setColorShift(state.colorShift);
        if (state.delay !== undefined) this.setDelay(state.delay);
        if (state.patrolNum !== undefined) this.setPatrolNum(state.patrolNum);
    }
}

/**
 * Controls all 17 valve-leds on the Steam Machine.
 */
class LedBarController {
    constructor(basePath = LEDS_BASE_PATH) {
        this.basePath = basePath;
        this.lock = new AsyncLock();
        this.leds = [];
        for (let i = 0; i < LED_COUNT; i++) {
            this.leds.push(new ValveLed(i, basePath));
        }

        this.profilesDir = path.join(
            process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
            'steam-led-controller'
        );
        fs.mkdirSync(this.profilesDir, { recursive: true });
    }

    detectLeds() {
        return this.leds.filter((led) => led.exists()).map((led) => led.index);
    }

    // -- Bulk operations with lock and delay --
    async setAllManual() {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setEffect('manual');
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async setAllBrightness(value) {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setBrightness(value);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async setAllColor(r, g, b) {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.ensureManualMode();
                led.setColor(r, g, b);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async setAllEnabled(enabled) {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setEnabled(enabled);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async setAllBreathLevel(value) {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setBreathLevel(value);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async setAllDelay(value) {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setDelay(value);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async setAllEffect(effect) {
        if (!VALID_EFFECTS.includes(effect)) {
            console.error(`Invalid effect '${effect}'.`);
            return;
        }
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setEffect(effect);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    // -- Presets --
    async applyRainbow(brightness = 255) {
        await this.lock.acquire();
        try {
            for (let i = 0; i < this.leds.length; i++) {
                const led = this.leds[i];
                const hue = i / LED_COUNT;
                const [r, g, b] = hsvToRgb(hue, 1.0, 1.0);
                led.setEffect('manual');
                led.setEnabled(true);
                led.setColor(r, g, b);
                led.setBrightness(brightness);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async applySolidColor(r, g, b, brightness = 255) {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setEffect('manual');
                led.setEnabled(true);
                led.setColor(r, g, b);
                led.setBrightness(brightness);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async applyGradient(startColor, endColor, brightness = 255) {
        await this.lock.acquire();
        try {
            for (let i = 0; i < this.leds.length; i++) {
                const led = this.leds[i];
                const ratio = i / Math.max(LED_COUNT - 1, 1);
                const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio);
                const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio);
                const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio);
                led.setEffect('manual');
                led.setEnabled(true);
                led.setColor(r, g, b);
                led.setBrightness(brightness);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async applyDriverEffect(effect) {
        if (!VALID_EFFECTS.includes(effect)) {
            console.error(`Invalid effect '${effect}'.`);
            return;
        }
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setEnabled(true);
                led.setEffect(effect);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    async turnOffAll() {
        await this.lock.acquire();
        try {
            for (const led of this.leds) {
                led.setEffect('off');
                led.setEnabled(false);
                await sleep(WRITE_DELAY_MS);
            }
        } finally {
            this.lock.release();
        }
    }

    // -- Profiles --
    saveProfile(name) {
        const profile = {
            name,
            leds: this.leds.map((led) => led.getState()),
        };
        const filepath = path.join(this.profilesDir, `${name}.json`);
        fs.writeFileSync(filepath, JSON.stringify(profile, null, 2));
        return filepath;
    }

    loadProfile(name) {
        const filepath = path.join(this.profilesDir, `${name}.json`);
        if (!fs.existsSync(filepath)) return false;
        const profile = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        for (const ledState of profile.leds || []) {
            const idx = ledState.index;
            if (idx >= 0 && idx < LED_COUNT) {
                this.leds[idx].applyState(ledState);
            }
        }
        return true;
    }

    listProfiles() {
        try {
            return fs
                .readdirSync(this.profilesDir)
                .filter((f) => f.endsWith('.json'))
                .map((f) => f.slice(0, -5))
                .sort();
        } catch {
            return [];
        }
    }

    deleteProfile(name) {
        const filepath = path.join(this.profilesDir, `${name}.json`);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            return true;
        }
        return false;
    }
}

/**
 * Convert HSV to RGB (all values 0-1 input, 0-255 output).
 */
function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

module.exports = LedBarController;
