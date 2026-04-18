import { BrowserWindow, ipcMain, screen } from 'electron';

// ============================================================================
// FAB Options
// ============================================================================

export interface FabCornerOffset {
  /** Corner position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' */
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Offset from the corner (default: 20) */
  offset?: number;
}

export interface FabOptions {
  id: string;
  /** HTML content for the FAB button */
  html: string;
  /** CSS styles for the FAB (inline) */
  styles?: string;
  /** Corner position with offset instead of x/y coordinates */
  corner: FabCornerOffset;
  /** Window width (default: 60) */
  width?: number;
  /** Window height (default: 60) */
  height?: number;
  /** Callback when FAB is clicked */
  onClick?: () => void;
  /** Callback when FAB is destroyed/closed */
  onClose?: () => void;
}

const collection = new Map<FabOptions['id'], BrowserWindow>();

// ============================================================================
// Create FAB
// ============================================================================

/**
 * Creates a floating action button (FAB) window with the given options.
 *
 * @param options - Configuration options for the FAB
 * @returns The created BrowserWindow instance
 */
export function createFab(options: FabOptions): BrowserWindow {
  const { id, html, styles, corner, width = 60, height = 60, onClick, onClose } = options;
  if (collection.has(id)) {
    return collection.get(id) as BrowserWindow;
  }

  // Build the HTML content with click handling
  const fullHtml = buildFabHtml(id, html, styles);

  // Calculate position from corner
  const { x, y } = calculatePositionFromCorner(corner, width, height);

  // Create the FAB window
  const fabWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the HTML content
  fabWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

  // Register IPC handler for click events
  const clickHandler = () => {
    if (onClick) {
      onClick();
    }
  };
  ipcMain.on(`fab-click-${id}`, clickHandler);

  // Handle window close
  fabWindow.on('closed', () => {
    // Remove the IPC handler
    ipcMain.removeListener(`fab-click-${id}`, clickHandler);

    // Call onClose callback if provided
    if (onClose) {
      onClose();
    }
  });
  collection.set(id, fabWindow);
  return fabWindow;
}

/**
 * Calculates the x/y position based on corner and offset.
 */
function calculatePositionFromCorner(
  corner: FabCornerOffset,
  width: number,
  height: number
): { x: number; y: number } {
  const offset = corner.offset ?? 20;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  let x: number;
  let y: number;

  switch (corner.corner) {
    case 'top-left':
      x = offset;
      y = offset;
      break;
    case 'top-right':
      x = screenWidth - width - offset;
      y = offset;
      break;
    case 'bottom-left':
      x = offset;
      y = screenHeight - height - offset;
      break;
    case 'bottom-right':
      x = screenWidth - width - offset;
      y = screenHeight - height - offset;
      break;
  }

  return { x, y };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the full HTML content for the FAB window.
 */
function buildFabHtml(fabId: string, content: string, styles?: string): string {
  const defaultStyles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    .fab-container {
      width: 100%;
      height: 100%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-app-region: no-drag;
    }
    .fab-container:hover {
      opacity: 0.9;
    }
    .fab-container:active {
      opacity: 0.8;
    }
  `;

  const clickScript = `
    <script>
      (function() {
        const container = document.querySelector('.fab-container');
        if (container) {
          container.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.electronAPI?.sendFabClick?.('${fabId}') ||
              require('electron').ipcRenderer.send('fab-click-${fabId}');
          });
        }
      })();
    </script>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    ${defaultStyles}
    ${styles || ''}
  </style>
</head>
<body>
  <div class="fab-container">
    ${content}
  </div>
  ${clickScript}
</body>
</html>
  `.trim();
}

/**
 * Closes a FAB window.
 */
export function closeFab(id: FabOptions['id']): void {
  const window = collection.get(id);
  if (window && !window.isDestroyed()) {
    window.close();
  }
}
