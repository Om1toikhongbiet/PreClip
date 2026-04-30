# PreClip - Advanced Clipboard Manager

A lightweight clipboard manager built with ElectronJS that monitors your system clipboard and allows you to easily manage, copy, edit, and paste multiple items from your clipboard history. Features a built-in image editor powered by TUI Image Editor.

## Features

✨ **Core Features:**
- 🖥️ **Real-time Clipboard Monitoring** - Automatically captures text and images from your clipboard
- 📋 **Dual-Pane View** - Separate panels for text and images for organized browsing
- 🎨 **Built-in Image Editor** - Edit images with crop, rotate, draw, shapes, text, and filters using TOAST UI
- 🔄 **Copy/Paste Back** - Copy any item back to your system clipboard with a single click
- 🔁 **Auto-Paste** - Double-click any item to automatically copy it to clipboard and paste into the active window
- 📸 **Multiple Item Copy** - Select multiple items (Ctrl+Click) and copy them all at once as formatted HTML to rich-text editors
- 💾 **File Save/Load** - Download edited images or load new images from disk within the editor
- ⌨️ **Keyboard Shortcuts** - Full keyboard navigation and selection
- 🎯 **Right-Click Context Menu** - Native context menu for quick actions
- 🚀 **Auto-Start** - Runs automatically when Windows boots (in production builds)
- 🎨 **Dark Theme** - VS Code-inspired dark interface

## Installation

### Option 1: Download Installer (Recommended)
1. Download the latest `.exe` installer from the [Releases](https://github.com/Om1toikhongbiet/PreClip/releases) page
2. Run the installer
3. PreClip will be added to your applications and can be launched from Start Menu

### Option 2: Build from Source

**Requirements:**
- Node.js v16+ 
- npm v7+

**Steps:**
```bash
# Clone the repository
git clone https://github.com/Om1toikhongbiet/PreClip.git
cd PreClip

# Install dependencies
npm install

# Start in development mode
npm start

# Build installer/package (Windows)
npm run make

# Or just package the app
npm run package
```

## How to Use

### Launch the App
- **First Time:** Run the installer or execute the `.exe` file
- **After Installation:** Press `Alt+Escape` to show/hide the clipboard manager window (in development)
- **Production:** Window appears automatically when triggered or on boot

### Basic Usage

1. **View Clipboard History:**
   - Left pane shows text items
   - Right pane shows image items
   - Items are listed from newest to oldest

2. **Copy Item Back to Clipboard:**
   - **Single Item:** Click the item directly to copy it to system clipboard
   - **Single Item (Keyboard):** Select item with arrow keys, press `Ctrl+C`
   - A toast notification confirms the copy

3. **Select Multiple Items:**
   - Hold `Ctrl` and click multiple items to select them
   - Selected items show a blue outline
   - Selection status: `Ctrl+A` (Select All), `Delete` (Remove), `Escape` (Deselect)

4. **Copy Multiple Items to Rich-Text Editors:**
   - Select multiple items (text and/or images)
   - Press `Ctrl+C`
   - Open MS Word, Google Docs, Notion, OneNote, etc.
   - Press `Ctrl+V` to paste all items in HTML format

5. **Right-Click Context Menu:**
   - Right-click any item for quick options:
     - **Select All** - Select all items in current view
     - **Copy** - Copy selected item(s)
     - **Delete** - Remove selected items

6. **Auto-Paste (Quick Paste):**
   - Double-click any text item OR
   - `Ctrl+Click` any image item
   - Window hides automatically
   - Item is copied to clipboard
   - `Ctrl+V` is sent to the active window (e.g., your text editor)
   - Notification shows: "Pasting..." → "Ctrl+V sent successfully!"

7. **Edit Images:**
   - `Ctrl+Click` on any image card to open the editor
   - Or right-click → select an option if available
   - Editor opens with the image loaded
   - Use tools to edit:
     - **Crop** - Adjust image dimensions
     - **Rotate** - Rotate 90°, flip horizontally/vertically
     - **Draw** - Freehand drawing with color picker
     - **Shapes** - Add circles, rectangles, lines
     - **Text** - Add text to image
     - **Filters** - Apply visual effects
   - **Save (Ctrl+S):** Saves edited image back to clipboard
   - **Download:** Save edited image to disk (shows file dialog)
   - **Load:** Load a new image from disk (shows file dialog)
   - Close to return to clipboard manager

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Escape` | Toggle window visibility (development mode) |
| `Ctrl+A` | Select all items |
| `Ctrl+C` | Copy selected item(s) to clipboard |
| `Delete` | Delete selected items |
| `Escape` | Deselect all items |
| `Ctrl+Click` | Select multiple items / Open image editor |
| `Ctrl+S` | Save edited image in editor |
| `↑ ↓` | Navigate between items |
| `Shift+↑ ↓` | Range selection |
| Double-Click | Auto-paste item (copy + send Ctrl+V) |

## Advanced Features

### Scroll Position Memory
- App remembers scroll positions in text and image panes
- Useful when browsing through large clipboard history



### HTML Clipboard Support
- Multiple items copied as HTML preserves formatting
- Compatible with: Microsoft Word, Google Docs, Notion, OneNote, etc.
- Text wrapped in `<p>` tags, images as `<img>` tags

### Offline Image Editing
- All TUI Image Editor libraries bundled locally
- No internet required for editing
- Fast and responsive

## Development

### Project Structure
```
PreClip/
├── src/
│   ├── main.js              # Main process (Electron backend)
│   ├── renderer.js          # Renderer process (UI logic)
│   ├── editor.js            # Image editor logic
│   ├── preload.js           # IPC bridge
│   ├── index.html           # Main window UI
│   ├── editor.html          # Editor window UI
│   ├── index.css            # Main styles
│   └── lib/                 # Local dependencies (TUI libs)
├── webpack.*.config.js      # Webpack configurations
├── forge.config.js          # Electron Forge config
├── package.json             # Dependencies
└── README.md                # This file
```

### Available Commands
```bash
npm start          # Start dev server with hot reload
npm run package    # Package app without installer
npm run make       # Build installer and distributable
npm run lint       # Run linter (currently not configured)
```

### IPC Channels (Main ↔ Renderer Communication)
- `new-clipboard-text` - New text detected
- `new-clipboard-image` - New image detected
- `write-clipboard-text` - Copy text to clipboard
- `write-clipboard-image` - Copy image to clipboard
- `copy-multiple-html` - Copy multiple items as HTML
- `save-edited-image` - Save edited image
- `load-image` - Load image into editor
- `save-image-to-disk` - Save image file dialog
- `load-image-from-disk` - Load image file dialog
- `show-context-menu` - Display context menu
- `auto-paste-item` - Copy and send Ctrl+V

## Troubleshooting

### App Won't Launch
- Ensure Windows 7 SP1+ (or newer)
- Try running as Administrator
- Check that port 9000 is not blocked (dev mode)

### Clipboard Not Monitoring
- Make sure the app window is not minimized in some build versions
- Check taskbar to see if app is running
- Restart the app

### Images Not Loading in Editor
- Verify all files in `src/lib/` exist (fabric.js, tui-*.js/css)
- Check DevTools console (Ctrl+Shift+I) for errors
- Ensure CSP meta tag in `editor.html` allows data: and blob: URLs

### Auto-Paste Not Working
- Some applications block external keyboard input for security
- Try in a different app (e.g., Notepad first)
- Check PowerShell execution policy on Windows

### Multiple Copy Not Working in Some Apps
- HTML clipboard support varies by application
- Use single-item copy for unsupported apps
- Notion, Word, Google Docs, OneNote all support HTML paste

## Configuration

### Auto-Start (Windows)
- Only enabled in production builds
- Uses `app.setLoginItemSettings({ openAtLogin: true })`
- Can be disabled in app settings (if added)

### Hot Keys
- Keyboard shortcuts defined in `src/renderer.js` (`handleKeyDown`)
- Can be customized by editing shortcut definitions

### Window Size
- Main window: 2/5 of screen width, full height
- Editor window: 90% of screen size
- Both respect Windows taskbar

## Performance

- **Memory:** ~80-150 MB (varies with clipboard history size)
- **CPU:** Minimal when idle, low polling interval (500ms)
- **Disk:** Downloaded libraries only (~5 MB)

## Security & Privacy

✅ **What PreClip Does:**
- Monitors your system clipboard for new items
- Stores clipboard history in memory only
- No data sent to external servers
- All code runs locally

✅ **What PreClip Doesn't Do:**
- Save clipboard history to disk (memory only)
- Upload data to cloud
- Track user activity
- Collect analytics

⚠️ **Important:**
- Clipboard may contain sensitive information (passwords, API keys, etc.)
- Use the Delete function to remove sensitive items
- Clear all data when needed

## License

MIT License - See [LICENSE](LICENSE) file for details

## Author

**Phạm Việt Thắng**
- GitHub: [Om1toikhongbiet](https://github.com/Om1toikhongbiet)

## Support & Feedback

- **Bug Reports:** Create an issue on GitHub
- **Feature Requests:** Open a discussion or issue
- **Questions:** Check FAQ or existing issues first

## Changelog

### v1.0.0 (2026-04-30)
- Initial release
- Clipboard monitoring with text & image support
- Dual-pane interface
- Built-in image editor with TOAST UI
- Keyboard shortcuts and context menu
- Multi-item HTML copy support
- File save/load in editor
- Auto-paste functionality
- Dark theme UI

## Future Roadmap

- [ ] Cloud sync option
- [ ] Custom keyboard shortcuts UI
- [ ] Image metadata display
- [ ] Search/filter clipboard history
- [ ] Clipboard history database with persistence
- [ ] macOS support
- [ ] Linux support
- [ ] Custom theme colors

---

**Enjoy managing your clipboard efficiently! 🎉**
