const fs = require('fs');
const os = require('os');
const path = require('path');

const AUTOSTART_FILENAME = 'FutureDrive.desktop';

function getAutostartDesktopPath() {
  return path.join(os.homedir(), '.config', 'autostart', AUTOSTART_FILENAME);
}

async function syncUbuntuAutostart(enabled, execPath) {
  if (process.platform !== 'linux') {
    return { success: false, skipped: true, reason: 'not_linux' };
  }

  const autostartDir = path.dirname(getAutostartDesktopPath());
  const desktopPath = getAutostartDesktopPath();

  try {
    await fs.promises.mkdir(autostartDir, { recursive: true });

    if (!enabled) {
      if (fs.existsSync(desktopPath)) {
        await fs.promises.unlink(desktopPath);
      }
      return { success: true, path: desktopPath, enabled: false };
    }

    const desktopContent = [
      '[Desktop Entry]',
      'Type=Application',
      'Version=1.0',
      'Name=FutureDrive',
      'Comment=FutureDrive startup launcher',
      `Exec="${execPath}"`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true'
    ].join('\n');

    await fs.promises.writeFile(desktopPath, `${desktopContent}\n`, 'utf8');
    const savedContent = await fs.promises.readFile(desktopPath, 'utf8');

    return {
      success: true,
      path: desktopPath,
      enabled: true,
      verified: savedContent.includes(`Exec="${execPath}"`)
    };
  } catch (error) {
    return { success: false, error: error.message, path: desktopPath };
  }
}

module.exports = {
  getAutostartDesktopPath,
  syncUbuntuAutostart
};
