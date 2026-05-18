export default async function(context: any) {
  const win = context.win;
  if (!win) return;
  
  let attempts = 0;
  const interval = setInterval(async () => {
    if (win.isDestroyed() || attempts > 30) {
      clearInterval(interval);
      return;
    }
    attempts++;
    try {
      const rect = await win.webContents.executeJavaScript(`
        (function() {
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.src.includes('challenges.cloudflare.com')) {
             const rect = iframe.getBoundingClientRect();
             if (rect.width > 0 && rect.height > 0) {
               return { x: Math.round(rect.x + rect.width / 4), y: Math.round(rect.y + rect.height / 2) };
             }
          }
          return null;
        })()
      `);
      if (rect) {
         console.log('[Plugin: AutoSolve] Found Turnstile, clicking at', rect);
         // Stop after a successful find to prevent spamming while the page navigates
         clearInterval(interval);
         
         win.webContents.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y });
         setTimeout(() => {
           if (!win.isDestroyed()) {
             win.webContents.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
             win.webContents.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
           }
         }, 150);
      }
    } catch (e) { }
  }, 2000);
  
  // Return disposer to host
  return () => clearInterval(interval);
}
