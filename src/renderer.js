/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

console.log(
  '👋 This message is being logged by "renderer.js", included via webpack',
);

// Lấy reference tới các pane
const textPane = document.getElementById('text-pane');
const imagePane = document.getElementById('image-pane');
const copyBtn = document.querySelector('.toolbar .icon-btn:last-child');
let toastTimer = null;

const autoResize = (el) => {
  if (!el) {
    return;
  }

  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

function bindTextareaAutoResize(textarea) {
  if (!textarea || textarea.dataset.autosizeBound === '1') {
    return;
  }

  textarea.dataset.autosizeBound = '1';
  textarea.addEventListener('input', () => autoResize(textarea));
  autoResize(textarea);
}

function bindAllTextareasAutoResize() {
  document.querySelectorAll('.text-card textarea').forEach((textarea) => {
    bindTextareaAutoResize(textarea);
  });
}

// Recompute textarea sizes on window resize (keeps the 75vh cap responsive)
window.addEventListener('resize', () => {
  document.querySelectorAll('.text-card textarea').forEach((ta) => {
    // Force recompute
    ta.dataset.autosizeBound = '0';
    bindTextareaAutoResize(ta);
  });
});


function saveScrollPositions() {
  if (textPane) {
    localStorage.setItem('text-pos', String(textPane.scrollTop));
  }
  if (imagePane) {
    localStorage.setItem('img-pos', String(imagePane.scrollTop));
  }
}

function restoreScrollPositions() {
  if (textPane) {
    const textPos = Number.parseInt(localStorage.getItem('text-pos') || '0', 10);
    textPane.scrollTop = Number.isNaN(textPos) ? 0 : textPos;
  }

  if (imagePane) {
    const imgPos = Number.parseInt(localStorage.getItem('img-pos') || '0', 10);
    imagePane.scrollTop = Number.isNaN(imgPos) ? 0 : imgPos;
  }
}

function addMarker() {
  const markerText = '--- Historical Marker [Viewed here last] ---';

  if (textPane) {
    const textMarker = document.createElement('div');
    textMarker.className = 'historical-marker';
    textMarker.textContent = markerText;
    textPane.prepend(textMarker);
  }

  if (imagePane) {
    const imageMarker = document.createElement('div');
    imageMarker.className = 'historical-marker';
    imageMarker.textContent = markerText;
    imagePane.prepend(imageMarker);
  }
}

textPane?.addEventListener('scroll', saveScrollPositions);
imagePane?.addEventListener('scroll', saveScrollPositions);

window.electronAPI?.on('app-visibility', (event, state) => {
  if (state === 'show') {
    document.body.classList.add('show-app');
    return;
  }

  if (state === 'hide') {
    document.body.classList.remove('show-app');
  }
});

function getFirstSelectedOrActiveCard() {
  return document.querySelector('.card.selected') || document.querySelector('.card.active-cursor');
}

function showToast(message) {
  let toast = document.querySelector('.app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1100);
}

function copyCardToSystemClipboard(card) {
  if (!card) {
    showToast('No item selected');
    return;
  }

  if (card.classList.contains('text-card')) {
    const textarea = card.querySelector('textarea');
    const textValue = textarea?.value ?? '';
    window.electronAPI?.send('write-clipboard-text', textValue);
    showToast('Copied text');
    return;
  }

  if (card.classList.contains('image-card')) {
    const img = card.querySelector('img');
    if (!img || !img.src.startsWith('data:image')) {
      showToast('Image is not local data');
      return;
    }
    const base64Data = img.src.split(',')[1];
    window.electronAPI?.send('write-clipboard-image', base64Data);
    showToast('Copied image');
  }
}

function getAutoPastePayload(card) {
  if (!card) {
    return null;
  }

  if (card.classList.contains('text-card')) {
    const textarea = card.querySelector('textarea');
    return {
      type: 'text',
      data: textarea?.value ?? '',
    };
  }

  if (card.classList.contains('image-card')) {
    const img = card.querySelector('img');
    const dataUrl = img?.src || '';
    return {
      type: 'image',
      data: dataUrl,
    };
  }

  return null;
}

function handleAutoPaste(e) {
  const card = e.currentTarget;
  const payload = getAutoPastePayload(card);

  if (!payload || !payload.data) {
    return;
  }

  window.electronAPI?.autoPasteItem(payload.data, payload.type);
  showToast(`Pasted ${payload.type}`);
}

// Lắng nghe sự kiện clipboard text mới từ main process
window.electronAPI?.on('new-clipboard-text', (event, text) => {
  console.log('📝 Nhận được text mới:', text);
  
  // Tạo thẻ text-card mới
  const textCard = document.createElement('div');
  textCard.className = 'card text-card';
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.placeholder = 'Đoạn text bạn copy sẽ nằm ở đây.';
  
  textCard.appendChild(textarea);
  bindTextareaAutoResize(textarea);
  
  // Prepend vào đầu text-pane
  textPane.prepend(textCard);
});

// Lắng nghe sự kiện clipboard image mới từ main process
window.electronAPI?.on('new-clipboard-image', (event, imageData) => {
  console.log('🖼️ Nhận được ảnh mới');
  
  // Tạo thẻ image-card mới
  const imageCard = document.createElement('div');
  imageCard.className = 'card image-card';
  
  const img = document.createElement('img');
  img.src = `data:image/png;base64,${imageData}`;
  img.alt = 'Ảnh Copy';
  
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Double-click to Paste | Ctrl + Click to Edit';
  
  imageCard.appendChild(img);
  imageCard.appendChild(hint);
  
  // Prepend vào đầu image-pane
  imagePane.prepend(imageCard);
});

window.electronAPI?.on('image-edit-updated', (event, payload) => {
  const { editId, imageData } = payload || {};
  if (!editId || !imageData) {
    return;
  }

  const safeEditId = CSS.escape(editId);
  const targetCard = document.querySelector(`.image-card[data-edit-id="${safeEditId}"]`);
  if (!targetCard) {
    console.log('⚠️ Không tìm thấy card ảnh cần cập nhật:', editId);
    return;
  }

  const img = targetCard.querySelector('img');
  if (!img) {
    return;
  }

  img.src = `data:image/png;base64,${imageData}`;
  if (imagePane && targetCard.parentElement === imagePane) {
    imagePane.prepend(targetCard);
  }
  targetCard.classList.remove('flash-update');
  void targetCard.offsetWidth;
  targetCard.classList.add('flash-update');
  setTimeout(() => {
    targetCard.classList.remove('flash-update');
  }, 500);
  showToast('Updated image');
});

// ============================================
// APPLE-STYLE MULTIPLE SELECTION LOGIC
// ============================================

let lastClickedCard = null; // Lưu vị trí click cuối cùng (cho Shift+Click range)
let currentActiveCursor = null; // Lưu vị trí con trỏ hiện tại

// Hàm lấy tất cả cards từ cả hai pane
function getAllCards() {
  return Array.from(document.querySelectorAll('.card'));
}

// Hàm lấy chỉ số của một card trong danh sách toàn bộ cards
function getCardIndex(card) {
  return getAllCards().indexOf(card);
}

// Hàm xóa class .selected từ tất cả cards
function clearAllSelections() {
  getAllCards().forEach(card => card.classList.remove('selected'));
}

// Hàm xóa class .active-cursor từ card hiện tại
function removeActiveCursor() {
  if (currentActiveCursor) {
    currentActiveCursor.classList.remove('active-cursor');
  }
}

// Hàm set .active-cursor cho một card
function setActiveCursor(card) {
  removeActiveCursor();
  currentActiveCursor = card;
  card.classList.add('active-cursor');
  // Cuộn card vào view nếu cần
  card.scrollIntoView({ behavior: 'auto', block: 'nearest' });
}

// Hàm chọn cards trong một khoảng (từ idx1 đến idx2)
function selectRange(idx1, idx2) {
  const allCards = getAllCards();
  const start = Math.min(idx1, idx2);
  const end = Math.max(idx1, idx2);
  
  for (let i = start; i <= end; i++) {
    if (allCards[i]) {
      allCards[i].classList.add('selected');
    }
  }
}

// Click handler cho các cards
function handleCardClick(e) {
  const card = e.currentTarget;
  
  // Shift + Click: Range selection
  if (e.shiftKey) {
    if (lastClickedCard) {
      clearAllSelections();
      const idx1 = getCardIndex(lastClickedCard);
      const idx2 = getCardIndex(card);
      selectRange(idx1, idx2);
    } else {
      card.classList.add('selected');
    }
    setActiveCursor(card);
  }
  // Regular Click: Single selection
  else {
    clearAllSelections();
    card.classList.add('selected');
    setActiveCursor(card);
  }
  
  lastClickedCard = card;
}

// Keyboard handler cho Ctrl+A: Select All clipboard items contextually (unless in textarea)
function handleCtrlA(e) {
  // If user is typing in a textarea/input, let them select text
  if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
    return;
  }

  // Prevent default Ctrl+A behavior
  e.preventDefault();

  // Get currently selected cards
  const currentlySelected = document.querySelectorAll('.card.selected');
  const allCards = getAllCards();

  // If no cards are selected, select all cards
  if (currentlySelected.length === 0) {
    allCards.forEach(card => card.classList.add('selected'));
    console.log('✓ Chọn tất cả clipboard items');
    return;
  }

  // Determine context based on first selected card
  const firstSelectedCard = currentlySelected[0];
  const isImageSelected = firstSelectedCard.classList.contains('image-card');

  // Clear all selections first
  allCards.forEach(card => card.classList.remove('selected'));

  // Select based on context
  if (isImageSelected) {
    // Select only image cards
    const imageCards = document.querySelectorAll('.card.image-card');
    imageCards.forEach(card => card.classList.add('selected'));
    console.log(`✓ Chọn tất cả ${imageCards.length} image items`);
  } else {
    // Select only text cards
    const textCards = document.querySelectorAll('.card.text-card');
    textCards.forEach(card => card.classList.add('selected'));
    console.log(`✓ Chọn tất cả ${textCards.length} text items`);
  }
}

// Keyboard handler cho arrow keys & escape
function handleKeyDown(e) {
  // Check for Ctrl+A
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    handleCtrlA(e);
    return;
  }

  // Guard: Skip if user is typing in textarea or input
  const isInTextInput = document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT';

  // Handle Ctrl+C / Cmd+C (Copy) - but not if inside textarea
  if (!isInTextInput && (e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    const selectedCards = document.querySelectorAll('.card.selected');
    if (selectedCards.length === 0) {
      showToast('No items selected');
      return;
    }

    // If only 1 card selected, use the original single-item copy
    if (selectedCards.length === 1) {
      copyCardToSystemClipboard(selectedCards[0]);
      return;
    }

    // Multiple items selected - copy as HTML for rich-text editors
    const htmlParts = [];
    selectedCards.forEach((card) => {
      if (card.classList.contains('text-card')) {
        const textarea = card.querySelector('textarea');
        const textValue = textarea?.value ?? '';
        // Escape HTML special characters
        const escaped = textValue
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        htmlParts.push(`<p>${escaped}</p>`);
      } else if (card.classList.contains('image-card')) {
        const img = card.querySelector('img');
        if (img && img.src.startsWith('data:image')) {
          htmlParts.push(`<img src="${img.src}" style="max-width: 100%; height: auto;" />`);
        }
      }
    });

    if (htmlParts.length > 0) {
      const combinedHTML = htmlParts.join('<br/>');
      window.electronAPI?.copyMultipleAsHTML(combinedHTML);
      showToast(`Copied ${selectedCards.length} items as HTML`);
    } else {
      showToast('No valid items to copy');
    }
    return;
  }

  // Handle Delete key (Delete) - but not if inside textarea
  if (!isInTextInput && e.key === 'Delete') {
    e.preventDefault();
    const selectedCards = document.querySelectorAll('.card.selected');
    if (selectedCards.length === 0) {
      showToast('No items selected');
      return;
    }

    selectedCards.forEach(card => card.remove());
    showToast(`Deleted ${selectedCards.length} item(s)`);
    return;
  }

  const allCards = getAllCards();
  
  if (allCards.length === 0) return;
  
  // Escape: Xóa tất cả selections
  if (e.key === 'Escape') {
    clearAllSelections();
    removeActiveCursor();
    lastClickedCard = null;
    console.log('✓ Bỏ chọn tất cả');
    return;
  }
  
  // Arrow Down
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    
    if (!currentActiveCursor) {
      // Nếu chưa có cursor, đặt ở card đầu tiên
      setActiveCursor(allCards[0]);
      if (!e.shiftKey) clearAllSelections();
      allCards[0].classList.add('selected');
    } else {
      const currentIdx = getCardIndex(currentActiveCursor);
      if (currentIdx < allCards.length - 1) {
        const nextCard = allCards[currentIdx + 1];
        setActiveCursor(nextCard);
        
        if (e.shiftKey) {
          // Shift + Arrow: Bôi xanh
          nextCard.classList.add('selected');
        } else {
          // Regular Arrow: Single select
          clearAllSelections();
          nextCard.classList.add('selected');
        }
      }
    }
  }
  
  // Arrow Up
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    
    if (!currentActiveCursor) {
      // Nếu chưa có cursor, đặt ở card cuối cùng
      const lastCard = allCards[allCards.length - 1];
      setActiveCursor(lastCard);
      if (!e.shiftKey) clearAllSelections();
      lastCard.classList.add('selected');
    } else {
      const currentIdx = getCardIndex(currentActiveCursor);
      if (currentIdx > 0) {
        const prevCard = allCards[currentIdx - 1];
        setActiveCursor(prevCard);
        
        if (e.shiftKey) {
          // Shift + Arrow: Bôi xanh
          prevCard.classList.add('selected');
        } else {
          // Regular Arrow: Single select
          clearAllSelections();
          prevCard.classList.add('selected');
        }
      }
    }
  }
}

// Handler cho Ctrl + Click vào image để edit
function handleImageCtrlClick(e) {
  if ((e.ctrlKey || e.metaKey) && e.currentTarget.classList.contains('image-card')) {
    e.preventDefault();
    
    // Lấy phần tử img trong image-card
    const imgElement = e.currentTarget.querySelector('img');
    if (!imgElement) return;
    
    const imageSrc = imgElement.src;
    
    // Kiểm tra xem có phải base64 không
    if (imageSrc.startsWith('data:image')) {
      // Lấy dữ liệu base64 từ src
      const base64Data = imageSrc.split(',')[1];
      const editId = e.currentTarget.dataset.editId || `edit_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      e.currentTarget.dataset.editId = editId;
      
      console.log('📤 Gửi ảnh để edit');
      // Gửi sang main process với channel 'open-to-edit'
      window.electronAPI?.send('open-to-edit', {
        type: 'image',
        data: base64Data,
        editId
      });
    }
  }
}

function handleImageDoubleClick(e) {
  const payload = getAutoPastePayload(e.currentTarget);
  if (!payload || !payload.data) {
    return;
  }

  window.electronAPI?.autoPasteItem(payload.data, payload.type);
  showToast(`Pasting ${payload.type}...`);
}

// Handler cho right-click context menu
function handleCardContextMenu(e) {
  e.preventDefault();
  const card = e.currentTarget;
  
  // Select the right-clicked card if not already selected
  if (!card.classList.contains('selected')) {
    clearAllSelections();
    card.classList.add('selected');
  }
  
  // Generate a unique ID for the card (use index if no explicit ID)
  const allCards = getAllCards();
  const cardIndex = allCards.indexOf(card);
  const itemId = card.dataset.itemId || `card_${cardIndex}`;
  
  window.electronAPI?.showContextMenu(itemId);
}

// Thêm event listeners sau khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Fallback: luôn để UI sẵn sàng hiển thị khi window được show từ Main
  document.body.classList.add('show-app');

  restoreScrollPositions();
  addMarker();
  bindAllTextareasAutoResize();

  // Thêm click handler cho các cards hiện có
  function attachCardListeners() {
    getAllCards().forEach(card => {
      card.removeEventListener('click', handleCardClick);
      card.addEventListener('click', handleCardClick);
      card.removeEventListener('dblclick', handleImageDoubleClick);
      card.addEventListener('dblclick', handleImageDoubleClick);
      card.removeEventListener('contextmenu', handleCardContextMenu);
      card.addEventListener('contextmenu', handleCardContextMenu);

      const textarea = card.querySelector('textarea');
      if (textarea) {
        bindTextareaAutoResize(textarea);
      }
      
      // Thêm Ctrl+Click handler cho image-cards
      if (card.classList.contains('image-card')) {
        card.removeEventListener('click', handleImageCtrlClick);
        card.addEventListener('click', handleImageCtrlClick);
      }
    });
  }
  
  // Lần đầu attach listeners
  attachCardListeners();
  
  // Keyboard handler global
  document.addEventListener('keydown', handleKeyDown);

  // Handle context menu actions from main process
  window.electronAPI?.onMenuAction((action, id) => {
    if (action === 'select-all') {
      getAllCards().forEach(card => card.classList.add('selected'));
      showToast('All items selected');
    } else if (action === 'copy') {
      const selectedCard = document.querySelector('.card.selected');
      if (selectedCard) {
        copyCardToSystemClipboard(selectedCard);
      }
    } else if (action === 'delete') {
      document.querySelectorAll('.card.selected').forEach(card => {
        card.remove();
      });
      showToast('Items deleted');
    }
  });

  // Nút copy trên toolbar (removed - no toolbar anymore)
  // copyBtn?.addEventListener('click', () => {
  //   const card = getFirstSelectedOrActiveCard();
  //   copyCardToSystemClipboard(card);
  // });
  
  // Re-attach listeners khi có cards mới (từ clipboard)
  const observerConfig = { childList: true, subtree: true };
  
  const observer = new MutationObserver(() => {
    attachCardListeners();
    bindAllTextareasAutoResize();
  });
  
  observer.observe(textPane, observerConfig);
  observer.observe(imagePane, observerConfig);
});

console.log('✓ Apple-style multiple selection loaded');
