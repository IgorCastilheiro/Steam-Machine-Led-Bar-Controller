/**
 * Steam Machine LED Bar Controller - Renderer Process
 * Handles all UI interactions and communicates with the backend via ledApi.
 *
 * Sliders only write to sysfs on release (not while dragging) to prevent
 * overwhelming the kernel driver.
 *
 * @author Igor Castilheiro
 * @year 2026
 */

const LED_COUNT = 17;

// Track the system's power state safely
let isLedsOn = true;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    await initStatusBar();
    initTabs();
    initControlTab();
    initProfilesTab();
    initLedStatusStrip();
});

async function initStatusBar() {
    const statusBar = document.getElementById('status-bar');
    try {
        const detected = await window.ledApi.detectLeds();
        if (detected.length === 0) {
            statusBar.textContent = 'No valve-leds detected! Running in preview mode.';
        } else {
            statusBar.textContent = `Detected ${detected.length} / ${LED_COUNT} LEDs`;
        }
    } catch (e) {
        statusBar.textContent = 'Error detecting LEDs: ' + e.message;
    }
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            tabBtns.forEach((b) => b.classList.remove('active'));
            tabContents.forEach((c) => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupSlider(sliderId, valSpanId, onRelease) {
    const slider = document.getElementById(sliderId);
    const valSpan = document.getElementById(valSpanId);

    slider.addEventListener('input', () => {
        valSpan.textContent = slider.value;
    });

    slider.addEventListener('change', () => {
        onRelease(parseInt(slider.value, 10));
        resetPowerButtonToOnState();
    });
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 0, 0];
}

/**
 * Returns the current brightness value from the slider.
 */
function getCurrentBrightness() {
    return parseInt(document.getElementById('all-brightness').value, 10);
}

// Effects that support speed (delay) control
const SPEED_EFFECTS = ['rainbow', 'breath', 'patrol', 'demo'];

// Effects that allow individual LED color control
const INDIVIDUAL_COLOR_EFFECTS = ['manual', 'breath'];

// Effects that support brightness control
const BRIGHTNESS_EFFECTS = ['rainbow', 'breath', 'patrol', 'demo', 'normal', 'manual'];

/**
 * Shows or hides the Color Settings card, Brightness and Speed sliders
 * based on the active effect.
 * Color Settings is only visible when "Solid" (manual) is selected.
 * Brightness slider is only visible when the active effect supports it.
 * Speed slider is only visible when the active effect supports delay control.
 */
function updateControlVisibility() {
    const colorCard = document.getElementById('color-settings-card');
    colorCard.style.display = activeEffect === 'manual' ? 'flex' : 'none';

    const brightnessBlock = document.getElementById('brightness-slider-block');
    brightnessBlock.style.display = BRIGHTNESS_EFFECTS.includes(activeEffect) ? 'flex' : 'none';

    const speedBlock = document.getElementById('speed-slider-block');
    speedBlock.style.display = SPEED_EFFECTS.includes(activeEffect) ? 'flex' : 'none';

    // Toggle clickable state on LED indicators
    const isClickable = INDIVIDUAL_COLOR_EFFECTS.includes(activeEffect);
    for (let i = 0; i < LED_COUNT; i++) {
        const dot = document.getElementById(`led-dot-${i}`);
        if (dot) {
            dot.classList.toggle('clickable', isClickable);
        }
    }
}

/**
 * Reverts the power toggle back to a red "Turn Off" look automatically
 * if the user interacts with colors, effects, or sliders.
 */
function resetPowerButtonToOnState() {
    isLedsOn = true;
    const turnOffBtn = document.getElementById('btn-turn-off');
    if (turnOffBtn) {
        turnOffBtn.textContent = 'Turn Off';
        turnOffBtn.classList.remove('btn-success');
        turnOffBtn.classList.add('btn-danger');
    }
}

// ---------------------------------------------------------------------------
// Tab: Control
// ---------------------------------------------------------------------------

let activeEffect = null;

function initControlTab() {
    // Effect buttons
    document.querySelectorAll('.effect-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            // Highlight active effect
            document.querySelectorAll('.effect-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            activeEffect = btn.dataset.effect;
            updateControlVisibility();
            resetPowerButtonToOnState();
            if (btn.dataset.effect === 'manual') {
                window.ledApi.setAllManual();
            } else {
                window.ledApi.applyDriverEffect(btn.dataset.effect);
            }
        });
    });

    // Brightness (writes on release)
    setupSlider('all-brightness', 'all-brightness-val', (val) => {
        window.ledApi.setAllBrightness(val);
    });

    // Speed slider (delay inverted: slider 0=slow/delay20, slider 20=fast/delay0)
    setupSlider('all-speed', 'all-speed-val', (val) => {
        const delay = 20 - val;
        window.ledApi.setAllDelay(delay);
    });

    // Apply color picker
    document.getElementById('btn-apply-color').addEventListener('click', () => {
        const [r, g, b] = hexToRgb(document.getElementById('all-color').value);
        window.ledApi.applySolidColor(r, g, b, getCurrentBrightness());
        resetPowerButtonToOnState();
    });

    // Quick color buttons
    document.querySelectorAll('.color-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const r = parseInt(btn.dataset.r, 10);
            const g = parseInt(btn.dataset.g, 10);
            const b = parseInt(btn.dataset.b, 10);
            window.ledApi.applySolidColor(r, g, b, getCurrentBrightness());
            resetPowerButtonToOnState();
        });
    });

    // Manual rainbow
    document.getElementById('btn-manual-rainbow').addEventListener('click', () => {
        window.ledApi.applyRainbow(getCurrentBrightness());
        resetPowerButtonToOnState();
    });

    // Gradient
    document.getElementById('btn-apply-gradient').addEventListener('click', () => {
        const start = hexToRgb(document.getElementById('gradient-start').value);
        const end = hexToRgb(document.getElementById('gradient-end').value);
        window.ledApi.applyGradient(start, end, getCurrentBrightness());
        resetPowerButtonToOnState();
    });

    // Dynamic Turn On / Turn Off Toggling Switch Engine Logic
    document.getElementById('btn-turn-off').addEventListener('click', function() {
        if (isLedsOn) {
            // Shut off hardware LEDs
            document.querySelectorAll('.effect-btn').forEach((b) => b.classList.remove('active'));
            activeEffect = null;
            window.ledApi.turnOffAll();

            // Transition UI element to Green "Turn On" state
            this.textContent = 'Turn On';
            this.classList.remove('btn-danger');
            this.classList.add('btn-success');
            isLedsOn = false;
        } else {
            // Apply current color custom value to wake LEDs up
            const [r, g, b] = hexToRgb(document.getElementById('all-color').value);
            window.ledApi.applySolidColor(r, g, b, getCurrentBrightness());

            // Revert interface to Red "Turn Off" state
            this.textContent = 'Turn Off';
            this.classList.remove('btn-success');
            this.classList.add('btn-danger');
            isLedsOn = true;
        }
    });
}

// ---------------------------------------------------------------------------
// Tab: Profiles
// ---------------------------------------------------------------------------

let selectedProfile = null;

function initProfilesTab() {
    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const name = document.getElementById('profile-name').value.trim();
        if (!name) {
            setProfileStatus('Please enter a profile name.');
            return;
        }
        await window.ledApi.saveProfile(name);
        setProfileStatus(`Profile '${name}' saved.`);
        document.getElementById('profile-name').value = '';
        await refreshProfilesList();
    });

    document.getElementById('btn-load-profile').addEventListener('click', async () => {
        if (!selectedProfile) {
            setProfileStatus('No profile selected.');
            return;
        }
        const result = await window.ledApi.loadProfile(selectedProfile);
        if (result) {
            setProfileStatus(`Profile '${selectedProfile}' loaded.`);
            resetPowerButtonToOnState();
        } else {
            setProfileStatus('Failed to load profile.');
        }
    });

    document.getElementById('btn-delete-profile').addEventListener('click', async () => {
        if (!selectedProfile) {
            setProfileStatus('No profile selected.');
            return;
        }
        const result = await window.ledApi.deleteProfile(selectedProfile);
        if (result) {
            setProfileStatus(`Profile '${selectedProfile}' deleted.`);
            selectedProfile = null;
            await refreshProfilesList();
        } else {
            setProfileStatus('Failed to delete profile.');
        }
    });

    refreshProfilesList();
}

async function refreshProfilesList() {
    const list = document.getElementById('profiles-list');
    list.innerHTML = '';
    selectedProfile = null;

    try {
        const profiles = await window.ledApi.listProfiles();
        for (const name of profiles) {
            const item = document.createElement('div');
            item.className = 'profile-item';
            item.textContent = name;
            
            // Single click handles visual selection state tracking
            item.addEventListener('click', () => {
                list.querySelectorAll('.profile-item').forEach((el) => el.classList.remove('selected'));
                item.classList.add('selected');
                selectedProfile = name;
            });

            // Double click instantly triggers the load action execution pipeline
            item.addEventListener('dblclick', async () => {
                // Ensure selection context matches the double-clicked target element
                list.querySelectorAll('.profile-item').forEach((el) => el.classList.remove('selected'));
                item.classList.add('selected');
                selectedProfile = name;

                // Fire the underlying native hardware connection loading pipeline
                const result = await window.ledApi.loadProfile(name);
                if (result) {
                    setProfileStatus(`Profile '${name}' loaded via shortcut.`);
                    resetPowerButtonToOnState();
                } else {
                    setProfileStatus('Failed to load profile.');
                }
            });

            list.appendChild(item);
        }
    } catch (e) {
        console.error('Error loading profiles:', e);
    }
}


// Global scope status tracking definition helper 
function setProfileStatus(text) {
    document.getElementById('profile-status').textContent = text;
}

// ---------------------------------------------------------------------------
// LED Status Strip
// ---------------------------------------------------------------------------

let ledStatusInterval = null;

/**
 * Builds the 17 LED indicator elements and starts periodic refresh.
 * Each LED has a hidden color input for individual color control.
 */
function initLedStatusStrip() {
    const strip = document.getElementById('led-status-strip');
    for (let i = 0; i < LED_COUNT; i++) {
        const dot = document.createElement('div');
        dot.className = 'led-indicator inactive';
        dot.id = `led-dot-${i}`;
        dot.dataset.index = i;
        dot.title = `LED ${i}`;

        const label = document.createElement('span');
        label.className = 'led-index';
        label.textContent = i;
        dot.appendChild(label);

        // Hidden color picker for individual LED control
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'led-color-picker';
        picker.id = `led-picker-${i}`;
        picker.value = '#ff0000';
        picker.addEventListener('input', () => {
            const [r, g, b] = hexToRgb(picker.value);
            window.ledApi.setLedColor(i, r, g, b);
        });
        dot.appendChild(picker);

        // Click to open color picker only in allowed effects
        dot.addEventListener('click', () => {
            if (INDIVIDUAL_COLOR_EFFECTS.includes(activeEffect)) {
                picker.click();
            }
        });

        strip.appendChild(dot);
    }

    refreshLedStatus();
    ledStatusInterval = setInterval(refreshLedStatus, 20);
}

/**
 * Reads the current state of all 17 LEDs and updates the strip indicators.
 */
async function refreshLedStatus() {
    try {
        const states = await window.ledApi.getAllLedStates();
        for (const state of states) {
            const dot = document.getElementById(`led-dot-${state.index}`);
            if (!dot) continue;

            const [r, g, b] = state.color;
            const color = `rgb(${r}, ${g}, ${b})`;

            if (state.enabled && state.effect !== 'off') {
                dot.style.backgroundColor = color;
                dot.style.setProperty('--led-color', color);
                dot.classList.add('active');
                dot.classList.remove('inactive');
            } else {
                dot.style.backgroundColor = '#333';
                dot.style.removeProperty('--led-color');
                dot.classList.remove('active');
                dot.classList.add('inactive');
            }

            dot.title = `LED ${state.index} | ${state.enabled ? 'ON' : 'OFF'} | rgb(${r},${g},${b}) | ${state.effect}`;
        }
    } catch (e) {
        console.error('Failed to refresh LED status:', e);
    }
}
