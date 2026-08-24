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

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    await initStatusBar();
    initTabs();
    initControlTab();
    initProfilesTab();
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
    });
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 0, 0];
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
            window.ledApi.applyDriverEffect(btn.dataset.effect);
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
        window.ledApi.applySolidColor(r, g, b);
    });

    // Quick color buttons
    document.querySelectorAll('.color-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const r = parseInt(btn.dataset.r, 10);
            const g = parseInt(btn.dataset.g, 10);
            const b = parseInt(btn.dataset.b, 10);
            window.ledApi.applySolidColor(r, g, b);
        });
    });

    // Manual rainbow
    document.getElementById('btn-manual-rainbow').addEventListener('click', () => {
        window.ledApi.applyRainbow();
    });

    // Gradient
    document.getElementById('btn-apply-gradient').addEventListener('click', () => {
        const start = hexToRgb(document.getElementById('gradient-start').value);
        const end = hexToRgb(document.getElementById('gradient-end').value);
        window.ledApi.applyGradient(start, end);
    });

    // Turn off
    document.getElementById('btn-turn-off').addEventListener('click', () => {
        document.querySelectorAll('.effect-btn').forEach((b) => b.classList.remove('active'));
        activeEffect = null;
        window.ledApi.turnOffAll();
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
        setProfileStatus(result ? `Profile '${selectedProfile}' loaded.` : 'Failed to load profile.');
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
            item.addEventListener('click', () => {
                list.querySelectorAll('.profile-item').forEach((el) => el.classList.remove('selected'));
                item.classList.add('selected');
                selectedProfile = name;
            });
            list.appendChild(item);
        }
    } catch (e) {
        console.error('Error loading profiles:', e);
    }
}

function setProfileStatus(text) {
    document.getElementById('profile-status').textContent = text;
}
