const { app, BrowserWindow, clipboard ,screen, ipcMain, globalShortcut, nativeImage, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { exec } = require('node:child_process');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Đừng quên thêm 'screen' vào dòng require ở đầu file nhé:
// const { app, BrowserWindow, clipboard, screen } = require('electron');

let mainWindow;
let editorWindow = null;
const editSessions = new Map();
let suppressNextTextValue = null;
let suppressNextTextUntil = 0;
let suppressNextImageHash = null;
let suppressNextImageUntil = 0;
let activeEditId = null;
let saveShortcutRegistered = false;
let saveForwardingGuard = false;

function hashImageBuffer(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function sendPasteKeystroke() {
  const command = 'powershell.exe -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'^v\')"';
  exec(command, (error) => {
    if (error) {
      console.log('⚠️ Không gửi được Ctrl+V:', error.message);
    }
  });
}

function registerSaveShortcut() {
  if (saveShortcutRegistered) {
    return;
  }

  const ok = globalShortcut.register('CommandOrControl+S', () => {
    if (!activeEditId || saveForwardingGuard) {
      return;
    }

    saveForwardingGuard = true;
    globalShortcut.unregister('CommandOrControl+S');
    saveShortcutRegistered = false;

    const sendSaveCommand = 'powershell -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^s\')"';
    exec(sendSaveCommand, (error) => {
      if (error) {
        console.log('⚠️ Không forward được Ctrl+S:', error.message);
      }

      setTimeout(() => {
        saveForwardingGuard = false;
        registerSaveShortcut();
      }, 150);
    });
  });

  if (!ok) {
    console.log('⚠️ Không đăng ký được shortcut Ctrl+S macro');
    return;
  }

  saveShortcutRegistered = true;
}

function unregisterSaveShortcut() {
  if (!saveShortcutRegistered) {
    return;
  }

  try {
    globalShortcut.unregister('CommandOrControl+S');
  } catch (err) {
    console.log('⚠️ Không hủy được shortcut Ctrl+S macro:', err.message);
  }

  saveShortcutRegistered = false;
}

const createWindow = () => {
  // Lấy kích thước màn hình và work area hiện tại (tránh taskbar)
  const { workArea } = screen.getPrimaryDisplay();
  const { width, y } = workArea;
  const appWidth = Math.floor(width * (2 / 5)); // Chiếm 3/5 màn hình

  // Tạo cửa sổ ứng dụng
  mainWindow = new BrowserWindow({
    width: appWidth,
    height: workArea.height,
    x: width - appWidth, // Neo vào sát mép phải màn hình
    y: y,
    show: false, // Khởi động ẩn, chờ lệnh hiển thị
    skipTaskbar: true, // Không hiện icon ở taskbar
    frame: false, // Loại bỏ thanh tiêu đề (Nút X, -, [])
    alwaysOnTop: true, // Luôn nổi trên các ứng dụng khác
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false, // Tắt Node.js integration
      contextIsolation: true // Bật context isolation cho security
    },
  });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-visibility', 'hide');
      mainWindow.hide();
    }
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  
  // Bạn có thể giữ lại đoạn logic setInterval đọc clipboard ở dưới đoạn này
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // ============================================
  // Auto-start on Windows boot (production only)
  // ============================================
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
    console.log('✅ Auto-start enabled for production build');
  } else {
    console.log('ℹ️ Auto-start disabled in development mode');
  }

  // Đăng ký phím tắt toàn cục Alt+Escape để toggle cửa sổ
  const shortcutRegistered = globalShortcut.register('Alt+Escape', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.webContents.send('app-visibility', 'hide');
      mainWindow.hide();
      return;
    }

    // Hiệu ứng "nháy": opacity 0 -> 1 trong ~50ms
    mainWindow.setOpacity(0);
    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
    mainWindow.webContents.send('app-visibility', 'show');
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-visibility', 'show');
      }
    }, 10);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(1);
      }
    }, 50);
  });

  if (!shortcutRegistered) {
    console.log('❌ Không đăng ký được Alt+Escape');
  }

  // On OS X it's comm// --- BẮT ĐẦU ĐOẠN VIBE CODE ---
  let lastText = clipboard.readText();
  let lastImage = clipboard.readImage();
  
  // Tạo vòng lặp chạy ngầm, cứ 500ms kiểm tra clipboard 1 lần
  setInterval(() => {
    const currentText = clipboard.readText();
    const currentImage = clipboard.readImage();
    
    // Nếu thấy text mới khác text cũ thì gửi tới renderer
    if (currentText !== lastText && currentText !== '') {
      if (suppressNextTextValue && currentText === suppressNextTextValue && Date.now() <= suppressNextTextUntil) {
        console.log('🛑 Bỏ qua text poll trùng với item vừa auto-paste');
        lastText = currentText;
        suppressNextTextValue = null;
        suppressNextTextUntil = 0;
        return;
      }

      console.log('🚨 Bắt được text mới:', currentText);
      mainWindow.webContents.send('new-clipboard-text', currentText);
      lastText = currentText;
    }
    
    // Nếu thấy image mới thì gửi tới renderer
    if (!currentImage.isEmpty() && lastImage.toDataURL() !== currentImage.toDataURL()) {
      const currentImageHash = hashImageBuffer(currentImage.toPNG());

      if (suppressNextImageHash && currentImageHash === suppressNextImageHash && Date.now() <= suppressNextImageUntil) {
        console.log('🛑 Bỏ qua image poll trùng với ảnh vừa sửa');
        lastImage = currentImage;
        suppressNextImageHash = null;
        suppressNextImageUntil = 0;
        return;
      }

      console.log('🖼️ Bắt được ảnh mới');
      const imageData = currentImage.toPNG().toString('base64');
      mainWindow.webContents.send('new-clipboard-image', imageData);
      lastImage = currentImage;
    }
  }, 500); 
  // --- KẾT THÚC ĐOẠN VIBE CODE ---on to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ============================================
// IPC Handler: write clipboard (copy back)
// ============================================
ipcMain.on('write-clipboard-text', (event, text) => {
  if (typeof text !== 'string') {
    return;
  }
  clipboard.writeText(text);
  console.log('📋 Đã copy text về system clipboard');
});

ipcMain.on('write-clipboard-image', (event, base64Data) => {
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    return;
  }

  const image = nativeImage.createFromDataURL(`data:image/png;base64,${base64Data}`);
  if (image.isEmpty()) {
    console.log('❌ Ảnh copy-back không hợp lệ');
    return;
  }

  clipboard.writeImage(image);
  console.log('📋 Đã copy ảnh về system clipboard');
});

// ============================================
// IPC Handler: copy-multiple-html
// ============================================
ipcMain.on('copy-multiple-html', (event, htmlString) => {
  if (typeof htmlString !== 'string' || htmlString.length === 0) {
    console.log('❌ HTML string không hợp lệ');
    return;
  }

  // Write HTML to clipboard (works with rich-text editors like Word, Docs, Notion)
  clipboard.writeHTML(htmlString);
  console.log('📋 Đã copy multiple items as HTML:', htmlString.substring(0, 100) + '...');
});

// ============================================
// IPC Handler: auto-paste-item
// ============================================
ipcMain.on('auto-paste-item', (event, data, type) => {
  console.log('📌 [auto-paste-item] Nhận yêu cầu, type:', type);
  
  if (type === 'text' && typeof data === 'string') {
    clipboard.writeText(data);
    suppressNextTextValue = data;
    suppressNextTextUntil = Date.now() + 3000;
    console.log('📝 [auto-paste-item] Đã ghi text vào clipboard');
  } else if (type === 'image' && typeof data === 'string') {
    const imageDataUrl = data.startsWith('data:image') ? data : `data:image/png;base64,${data}`;
    const image = nativeImage.createFromDataURL(imageDataUrl);
    if (image.isEmpty()) {
      console.log('❌ Ảnh auto-paste không hợp lệ');
      return;
    }

    clipboard.writeImage(image);
    suppressNextImageHash = hashImageBuffer(image.toPNG());
    suppressNextImageUntil = Date.now() + 3000;
    console.log('🖼️ [auto-paste-item] Đã ghi image vào clipboard');
  } else {
    console.log('❌ auto-paste-item nhận type không hợp lệ');
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('🔄 [auto-paste-item] Đang minimize và hide window...');
    mainWindow.minimize();
    mainWindow.hide();
  }

  setTimeout(() => {
    console.log('⏱️ [auto-paste-item] Delay 300ms xong, giờ gửi Ctrl+V...');
    const script = `
      $wshell = New-Object -ComObject wscript.shell;
      Start-Sleep -Milliseconds 100;
      $wshell.SendKeys('^v');
    `;
    exec(`powershell.exe -NoProfile -Command "${script.replace(/\n/g, '')}"`, (error) => {
      if (error) {
        console.error('❌ Lỗi chạy PowerShell:', error.message);
      } else {
        console.log('✅ Đã bắn lệnh Ctrl+V ảo thành công!');
      }
    });
  }, 300);
});

// ============================================
// IPC Handler: open-to-edit
// ============================================
ipcMain.on('open-to-edit', (event, data) => {
  if (typeof data !== 'object' || data === null || data.type !== 'image' || !data.data) {
    console.log('❌ Dữ liệu ảnh không hợp lệ');
    return;
  }

  const editId = data.editId || `edit_${Date.now()}`;

  const loadImageIntoEditor = () => {
    if (!editorWindow || editorWindow.isDestroyed()) {
      return;
    }

    editorWindow.__editId = editId;
    editorWindow.webContents.send('load-image', data.data);
    editorWindow.show();
    editorWindow.focus();
  };

  if (editorWindow && !editorWindow.isDestroyed()) {
    if (editorWindow.webContents.isLoadingMainFrame()) {
      editorWindow.webContents.once('did-finish-load', loadImageIntoEditor);
    } else {
      loadImageIntoEditor();
    }
    return;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  editorWindow = new BrowserWindow({
    width: Math.floor(screenWidth * 0.9),
    height: Math.floor(screenHeight * 0.9),
    title: 'Image Editor',
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: EDITOR_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  editorWindow.__editId = editId;

  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  editorWindow.webContents.once('did-finish-load', loadImageIntoEditor);
  
  // Load the editor window using Webpack entry or fallback
  if (typeof EDITOR_WINDOW_WEBPACK_ENTRY !== 'undefined') {
    console.log('📦 Loading editor from Webpack entry:', EDITOR_WINDOW_WEBPACK_ENTRY);
    editorWindow.loadURL(EDITOR_WINDOW_WEBPACK_ENTRY);
  } else {
    console.log('⚠️ EDITOR_WINDOW_WEBPACK_ENTRY not defined, using fallback path');
    const editorPath = path.join(app.getAppPath(), 'src', 'editor.html');
    editorWindow.loadFile(editorPath);
  }
});

// ============================================
// IPC Handler: show-context-menu
// ============================================
ipcMain.on('show-context-menu', (event, itemId) => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Select All',
      click: () => {
        event.sender.send('context-menu-action', 'select-all', itemId);
      },
    },
    {
      label: 'Copy',
      click: () => {
        event.sender.send('context-menu-action', 'copy', itemId);
      },
    },
    { type: 'separator' },
    {
      label: 'Delete',
      click: () => {
        event.sender.send('context-menu-action', 'delete', itemId);
      },
    },
  ]);

  contextMenu.popup();
});

// ============================================
// IPC Handler: save-edited-image
// ============================================
ipcMain.on('save-edited-image', (event, editedBase64) => {
  if (typeof editedBase64 !== 'string' || !editedBase64.length) {
    console.log('❌ Dữ liệu ảnh đã sửa không hợp lệ');
    return;
  }

  const imageDataUrl = editedBase64.startsWith('data:image')
    ? editedBase64
    : `data:image/png;base64,${editedBase64}`;

  const nativeImg = nativeImage.createFromDataURL(imageDataUrl);
  if (nativeImg.isEmpty()) {
    console.log('❌ Không tạo được nativeImage từ ảnh đã sửa');
    return;
  }

  clipboard.writeImage(nativeImg);
  lastImage = nativeImg;
  suppressNextImageHash = hashImageBuffer(nativeImg.toPNG());
  suppressNextImageUntil = Date.now() + 3000;

  if (mainWindow && !mainWindow.isDestroyed() && editorWindow && !editorWindow.isDestroyed()) {
    const editId = editorWindow.__editId;
    if (editId) {
      const updatedBase64 = nativeImg.toPNG().toString('base64');
      mainWindow.webContents.send('image-edit-updated', {
        editId,
        imageData: updatedBase64,
      });
    }
  }

  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.close();
  }

  console.log('📋 Đã lưu ảnh đã sửa vào system clipboard và đóng editor');
});

// ============================================
// IPC Handler: save-image-to-disk
// ============================================
ipcMain.handle('save-image-to-disk', async (event, dataUrl) => {
  try {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'PNG Images', extensions: ['png'] },
        { name: 'JPEG Images', extensions: ['jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled) {
      return { success: false, path: null };
    }

    // Strip data URL header and convert to Buffer
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(result.filePath, buffer);
    console.log('💾 Saved image to:', result.filePath);
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('❌ Error saving image:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC Handler: load-image-from-disk
// ============================================
ipcMain.handle('load-image-from-disk', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, dataUrl: null };
    }

    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');

    // Detect MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('🖼️ Loaded image from:', filePath);
    return { success: true, dataUrl };
  } catch (error) {
    console.error('❌ Error loading image:', error);
    return { success: false, error: error.message };
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
