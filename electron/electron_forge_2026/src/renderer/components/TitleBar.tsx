import { useEffect, useState } from 'react';

/**
 * Custom TitleBar component with platform-specific styling
 *
 * Windows: Controls on the right, standard minimize/maximize/close buttons
 * macOS: When using custom frame (frame:false), shows traffic light style buttons on right
 *
 * Note: For macOS native look, consider using frame: true in window config
 */
export const TitleBar = () => {
  const [platform, setPlatform] = useState<'windows' | 'macos'>('windows');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Get platform from main process
    window.App.invoke('app.platform').then((result) => {
      if (result.ok && result.data) {
        setPlatform(result.data);
      }
    });

    // Get initial maximized state
    window.App.invoke('window.is-maximized').then((result) => {
      if (result.ok && typeof result.data === 'boolean') {
        setIsMaximized(result.data);
      }
    });
  }, []);

  const handleMinimize = () => {
    window.App.invoke('window.minimize');
  };

  const handleMaximize = async () => {
    await window.App.invoke('window.maximize');
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.App.invoke('window.close');
  };

  // macOS-specific styling
  const isMac = platform === 'macos';

  return (
    <div
      className={`fixed top-0 left-0 right-0 flex items-center px-4 z-[99999] ${isMac ? 'h-8 justify-start' : 'h-6 justify-end'}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-1.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {isMac ? (
          // macOS style - circular traffic light buttons
          <>
            <button
              onClick={handleClose}
              className="w-3 h-3 rounded-full hover:brightness-90 transition-all"
              style={{ backgroundColor: '#ff5f57' }}
              title="关闭"
              type="button"
            />
            <button
              onClick={handleMinimize}
              className="w-3 h-3 rounded-full hover:brightness-90 transition-all"
              style={{ backgroundColor: '#febc2e' }}
              title="最小化"
              type="button"
            />
            <button
              onClick={handleMaximize}
              className="w-3 h-3 rounded-full hover:brightness-90 transition-all"
              style={{ backgroundColor: '#28c840' }}
              title={isMaximized ? '还原' : '最大化'}
              type="button"
            />
          </>
        ) : (
          // Windows style - square/rounded buttons
          <>
            {/* Minimize */}
            <button
              onClick={handleMinimize}
              className="w-8 h-6 flex items-center justify-center hover:bg-neutral-800 transition-colors"
              title="最小化"
              type="button"
            >
              <svg
                className="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>minimize</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            {/* Maximize/Restore */}
            <button
              onClick={handleMaximize}
              className="w-8 h-6 flex items-center justify-center hover:bg-neutral-800 transition-colors"
              title={isMaximized ? '还原' : '最大化'}
              type="button"
            >
              {isMaximized ? (
                <svg
                  className="w-3.5 h-3.5 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>restore</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 4h8a4 4 0 014 4v8M4 8v8a4 4 0 004 4h8"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>maximize</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8a4 4 0 014-4h8a4 4 0 014 4v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"
                  />
                </svg>
              )}
            </button>

            {/* Close */}
            <button
              onClick={handleClose}
              className="w-8 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
              title="关闭"
              type="button"
            >
              <svg
                className="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>close</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
