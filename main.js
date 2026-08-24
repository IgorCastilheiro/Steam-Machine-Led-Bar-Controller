/**
 * Steam Machine LED Bar Controller - Electron Main Process
 * Handles window creation and IPC communication with the backend.
 *
 * @author Igor Castilheiro
 * @year 2026
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const LedBarController = require('./led-backend');

let mainWindow;
const controller = new LedBarController();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'Steam LED Bar Controller',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    
    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);
}

app.disableHardwareAcceleration();
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    app.quit();
});

// ---------------------------------------------------------------------------
// IPC Handlers - Bridge between renderer and led-backend
// ---------------------------------------------------------------------------

// Detect LEDs
ipcMain.handle('detect-leds', () => {
    return controller.detectLeds();
});

// Get single LED state
ipcMain.handle('get-led-state', (_, index) => {
    return controller.leds[index].getState();
});

// Set effect on single LED
ipcMain.handle('set-led-effect', (_, index, effect) => {
    return controller.leds[index].setEffect(effect);
});

// Set enabled on single LED
ipcMain.handle('set-led-enabled', (_, index, enabled) => {
    return controller.leds[index].setEnabled(enabled);
});

// Set brightness on single LED
ipcMain.handle('set-led-brightness', (_, index, value) => {
    return controller.leds[index].setBrightness(value);
});

// Set color on single LED
ipcMain.handle('set-led-color', (_, index, r, g, b) => {
    return controller.leds[index].setColor(r, g, b);
});

// Set breath level on single LED
ipcMain.handle('set-led-breath-level', (_, index, value) => {
    return controller.leds[index].setBreathLevel(value);
});

// Set breath offset on single LED
ipcMain.handle('set-led-breath-offset', (_, index, value) => {
    return controller.leds[index].setBreathOffset(value);
});

// Set brightness scale on single LED
ipcMain.handle('set-led-brightness-scale', (_, index, value) => {
    return controller.leds[index].setBrightnessScale(value);
});

// Set color shift on single LED
ipcMain.handle('set-led-color-shift', (_, index, value) => {
    return controller.leds[index].setColorShift(value);
});

// Set delay on single LED
ipcMain.handle('set-led-delay', (_, index, value) => {
    return controller.leds[index].setDelay(value);
});

// Set patrol num on single LED
ipcMain.handle('set-led-patrol-num', (_, index, value) => {
    return controller.leds[index].setPatrolNum(value);
});

// Bulk operations
ipcMain.handle('set-all-effect', (_, effect) => {
    return controller.setAllEffect(effect);
});

ipcMain.handle('set-all-enabled', (_, enabled) => {
    return controller.setAllEnabled(enabled);
});

ipcMain.handle('set-all-manual', () => {
    return controller.setAllManual();
});

ipcMain.handle('set-all-brightness', (_, value) => {
    return controller.setAllBrightness(value);
});

ipcMain.handle('set-all-color', (_, r, g, b) => {
    return controller.setAllColor(r, g, b);
});

ipcMain.handle('set-all-breath-level', (_, value) => {
    return controller.setAllBreathLevel(value);
});

ipcMain.handle('set-all-delay', (_, value) => {
    return controller.setAllDelay(value);
});

ipcMain.handle('turn-off-all', () => {
    return controller.turnOffAll();
});

// Presets
ipcMain.handle('apply-rainbow', () => {
    return controller.applyRainbow();
});

ipcMain.handle('apply-solid-color', (_, r, g, b) => {
    return controller.applySolidColor(r, g, b);
});

ipcMain.handle('apply-gradient', (_, startColor, endColor) => {
    return controller.applyGradient(startColor, endColor);
});

ipcMain.handle('apply-driver-effect', (_, effect) => {
    return controller.applyDriverEffect(effect);
});

// Profiles
ipcMain.handle('save-profile', (_, name) => {
    return controller.saveProfile(name);
});

ipcMain.handle('load-profile', (_, name) => {
    return controller.loadProfile(name);
});

ipcMain.handle('list-profiles', () => {
    return controller.listProfiles();
});

ipcMain.handle('delete-profile', (_, name) => {
    return controller.deleteProfile(name);
});
