// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

// Expose ipcRenderer to the renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Expose ipcRenderer.on for listening to events
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
  },
  // Expose ipcRenderer.send for sending messages to main
  send: (channel, ...args) => {
    ipcRenderer.send(channel, ...args);
  },
  onLoadImage: (callback) => {
    ipcRenderer.on('load-image', (_event, base64Image) => {
      callback(base64Image);
    });
  },
  saveEditedImage: (dataUrl) => {
    ipcRenderer.send('save-edited-image', dataUrl);
  },
  autoPasteItem: (data, type) => {
    ipcRenderer.send('auto-paste-item', data, type);
  },
  showContextMenu: (id) => {
    ipcRenderer.send('show-context-menu', id);
  },
  onMenuAction: (callback) => {
    ipcRenderer.on('context-menu-action', (_event, action, id) => {
      callback(action, id);
    });
  },
  saveImage: (dataUrl) => ipcRenderer.invoke('save-image-to-disk', dataUrl),
  loadImage: () => ipcRenderer.invoke('load-image-from-disk'),
  copyMultipleAsHTML: (htmlString) => ipcRenderer.send('copy-multiple-html', htmlString),
});