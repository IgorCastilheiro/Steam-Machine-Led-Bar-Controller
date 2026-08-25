/**
 * Steam Machine LED Bar Controller - Preload Script
 * Exposes safe IPC methods to the renderer process via contextBridge.
 *
 * @author Igor Castilheiro
 * @year 2026
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledApi', {
    // Detection
    detectLeds: () => ipcRenderer.invoke('detect-leds'),

    // Single LED
    getLedState: (index) => ipcRenderer.invoke('get-led-state', index),
    getAllLedStates: () => ipcRenderer.invoke('get-all-led-states'),
    setLedEffect: (index, effect) => ipcRenderer.invoke('set-led-effect', index, effect),
    setLedEnabled: (index, enabled) => ipcRenderer.invoke('set-led-enabled', index, enabled),
    setLedBrightness: (index, value) => ipcRenderer.invoke('set-led-brightness', index, value),
    setLedColor: (index, r, g, b) => ipcRenderer.invoke('set-led-color', index, r, g, b),
    setLedBreathLevel: (index, value) => ipcRenderer.invoke('set-led-breath-level', index, value),
    setLedBreathOffset: (index, value) => ipcRenderer.invoke('set-led-breath-offset', index, value),
    setLedBrightnessScale: (index, value) => ipcRenderer.invoke('set-led-brightness-scale', index, value),
    setLedColorShift: (index, value) => ipcRenderer.invoke('set-led-color-shift', index, value),
    setLedDelay: (index, value) => ipcRenderer.invoke('set-led-delay', index, value),
    setLedPatrolNum: (index, value) => ipcRenderer.invoke('set-led-patrol-num', index, value),

    // Bulk operations
    setAllEffect: (effect) => ipcRenderer.invoke('set-all-effect', effect),
    setAllEnabled: (enabled) => ipcRenderer.invoke('set-all-enabled', enabled),
    setAllManual: () => ipcRenderer.invoke('set-all-manual'),
    setAllBrightness: (value) => ipcRenderer.invoke('set-all-brightness', value),
    setAllColor: (r, g, b) => ipcRenderer.invoke('set-all-color', r, g, b),
    setAllBreathLevel: (value) => ipcRenderer.invoke('set-all-breath-level', value),
    setAllDelay: (value) => ipcRenderer.invoke('set-all-delay', value),
    turnOffAll: () => ipcRenderer.invoke('turn-off-all'),

    // Presets
    applyRainbow: (brightness) => ipcRenderer.invoke('apply-rainbow', brightness),
    applySolidColor: (r, g, b, brightness) => ipcRenderer.invoke('apply-solid-color', r, g, b, brightness),
    applyGradient: (startColor, endColor, brightness) => ipcRenderer.invoke('apply-gradient', startColor, endColor, brightness),
    applyDriverEffect: (effect) => ipcRenderer.invoke('apply-driver-effect', effect),

    // Profiles
    saveProfile: (name) => ipcRenderer.invoke('save-profile', name),
    loadProfile: (name) => ipcRenderer.invoke('load-profile', name),
    listProfiles: () => ipcRenderer.invoke('list-profiles'),
    deleteProfile: (name) => ipcRenderer.invoke('delete-profile', name),
});
