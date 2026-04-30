const saveBtn = document.getElementById('saveBtn');
const container = document.getElementById('tui-image-editor-container');

console.log('📝 editor.js loaded');
console.log('✓ saveBtn:', saveBtn);
console.log('✓ container:', container);
console.log('✓ window.electronAPI:', window.electronAPI);

// Monitor script loading
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Content Loaded');
  console.log('✓ window.fabric:', typeof window.fabric);
  console.log('✓ window.tui:', typeof window.tui);
  console.log('✓ window.tui?.ImageEditor:', typeof window.tui?.ImageEditor);
});

window.addEventListener('load', () => {
  console.log('✅ Window load event fired');
  console.log('✓ window.tui after load:', typeof window.tui);
  console.log('✓ window.tui?.ImageEditor after load:', typeof window.tui?.ImageEditor);
});

let editorInstance = null;
let currentImageDataUrl = null;
let saveLock = false;

function normalizeDataUrl(base64Image) {
  if (!base64Image) {
    return null;
  }

  return base64Image.startsWith('data:image')
    ? base64Image
    : `data:image/png;base64,${base64Image}`;
}

function setSaveEnabled(enabled) {
  saveBtn.disabled = !enabled;
  saveBtn.style.opacity = enabled ? '1' : '0.6';
  saveBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
}

function destroyEditor() {
  if (editorInstance && typeof editorInstance.destroy === 'function') {
    try {
      editorInstance.destroy();
    } catch (error) {
      console.warn('Failed to destroy editor instance:', error);
    }
  }

  editorInstance = null;
}

function initEditor(base64Image) {
  console.log('🎨 initEditor called with base64Image:', base64Image ? 'present' : 'missing');
  console.log('✓ window.tui:', window.tui);
  console.log('✓ window.tui?.ImageEditor:', window.tui?.ImageEditor);
  
  const imagePath = normalizeDataUrl(base64Image);
  if (!imagePath || !window.tui || !window.tui.ImageEditor) {
    console.error('❌ TOAST UI Image Editor is not available or image is invalid');
    setSaveEnabled(false);
    return;
  }

  destroyEditor();
  container.innerHTML = '';

  editorInstance = new window.tui.ImageEditor(container, {
    includeUI: {
      loadImage: {
        path: imagePath,
        name: 'clipboard-image',
      },
      menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'mask', 'filter'],
      initMenu: 'filter',
      menuBarPosition: 'bottom',
      uiSize: {
        width: '100%',
        height: 'calc(100vh - 56px)',
      },
    },
    cssMaxWidth: 1600,
    cssMaxHeight: 1200,
    selectionStyle: {
      cornerSize: 20,
      rotatingPointOffset: 70,
    },
    theme: {
      'header.logo.display': 'none',
    },
  });

  currentImageDataUrl = imagePath;
  setSaveEnabled(true);
}

function saveCurrentImage() {
  if (saveLock || !editorInstance) {
    return;
  }

  saveLock = true;

  try {
    const editedDataUrl = editorInstance.toDataURL();
    window.electronAPI.saveEditedImage(editedDataUrl);
  } catch (error) {
    console.error('Failed to export edited image:', error);
  } finally {
    setTimeout(() => {
      saveLock = false;
    }, 250);
  }
}

saveBtn.addEventListener('click', saveCurrentImage);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveCurrentImage();
  }
});

window.electronAPI.onLoadImage((base64Image) => {
  console.log('📬 onLoadImage event received');
  initEditor(base64Image);
});

// ============================================
// Override TUI Image Editor Default Buttons
// ============================================
function overrideTUIButtons() {
  // Override the "Download" button to save to disk
  const downloadBtn = document.querySelector('.tui-image-editor-download-btn');
  if (downloadBtn) {
    downloadBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!editorInstance) {
        console.warn('❌ Editor instance not available');
        return;
      }

      const dataUrl = editorInstance.toDataURL();
      const result = await window.electronAPI.saveImage(dataUrl);
      
      if (result.success) {
        console.log('💾 Image saved to:', result.path);
      } else {
        console.error('❌ Failed to save image:', result.error);
      }
    };
  }

  // Override the "Load" button to load from disk
  const loadBtn = document.querySelector('.tui-image-editor-load-btn');
  if (loadBtn) {
    loadBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editorInstance) {
        console.warn('❌ Editor instance not available');
        return;
      }

      const result = await window.electronAPI.loadImage();
      
      if (result.success && result.dataUrl) {
        console.log('🖼️ Loading image from disk...');
        editorInstance.loadImageFromURL(result.dataUrl, 'Loaded Image');
      } else if (!result.canceled) {
        console.error('❌ Failed to load image:', result.error);
      }
    };
  }

  // Ensure trash/delete buttons are functional
  const deleteBtn = document.querySelector('.tui-image-editor-delete-btn');
  if (deleteBtn && !deleteBtn._electronOverridden) {
    deleteBtn._electronOverridden = true;
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (editorInstance && typeof editorInstance.removeActiveObject === 'function') {
        editorInstance.removeActiveObject();
      }
    };
  }

  // Clear all objects button
  const clearBtn = document.querySelector('.tui-image-editor-clear-all-btn');
  if (clearBtn && !clearBtn._electronOverridden) {
    clearBtn._electronOverridden = true;
    clearBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (editorInstance && typeof editorInstance.clearObjects === 'function') {
        editorInstance.clearObjects();
      }
    };
  }

  console.log('✅ TUI buttons overridden for Electron');
}

// Call overrideTUIButtons after editor initializes, with retries
let buttonOverrideAttempts = 0;
const maxButtonOverrideAttempts = 20;

function tryOverrideTUIButtons() {
  if (buttonOverrideAttempts >= maxButtonOverrideAttempts) {
    console.warn('⚠️ Could not find TUI buttons after 20 attempts');
    return;
  }

  const downloadBtn = document.querySelector('.tui-image-editor-download-btn');
  const loadBtn = document.querySelector('.tui-image-editor-load-btn');

  if (downloadBtn || loadBtn) {
    overrideTUIButtons();
  } else {
    buttonOverrideAttempts++;
    setTimeout(tryOverrideTUIButtons, 200);
  }
}

// Watch for editor initialization and try to override buttons
const originalInitEditor = initEditor;
initEditor = function(base64Image) {
  originalInitEditor(base64Image);
  buttonOverrideAttempts = 0;
  setTimeout(tryOverrideTUIButtons, 500);
};

setSaveEnabled(false);
