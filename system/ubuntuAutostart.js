const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SERVICE_NAME = 'futuredrive.service';
const SERVICE_DIR = path.join(os.homedir(), '.config', 'systemd', 'user');
const SERVICE_PATH = path.join(SERVICE_DIR, SERVICE_NAME);
const DEFAULT_APPIMAGE_NAME = 'FutureDrive-1.2.2.AppImage';

function resolveAppImagePath(execPath = '') {
  if (execPath && fs.existsSync(execPath)) {
    return execPath;
  }

  const cwdCandidate = path.join(process.cwd(), DEFAULT_APPIMAGE_NAME);
  if (fs.existsSync(cwdCandidate)) {
    return cwdCandidate;
  }

  return execPath || DEFAULT_APPIMAGE_NAME;
}

function buildServiceContent(execPath) {
  const resolvedExec = resolveAppImagePath(execPath);
  const escapedExec = resolvedExec.replace(/"/g, '\\"');

  return [
    '[Unit]',
    'Description=FutureDrive Application',
    'After=graphical-session.target',
    '',
    '[Service]',
    'Type=simple',
    `ExecStart="${escapedExec}"`,
    'Restart=on-failure',
    'RestartSec=3',
    '',
    '[Install]',
    'WantedBy=default.target',
    ''
  ].join('\n');
}

function canManageUserService() {
  return process.platform === 'linux';
}

async function writeServiceFile(execPath) {
  await fs.promises.mkdir(SERVICE_DIR, { recursive: true });
  const content = buildServiceContent(execPath);
  await fs.promises.writeFile(SERVICE_PATH, content, 'utf8');
  return content;
}

function runSystemctl(args) {
  execFileSync('systemctl', ['--user', ...args], { stdio: 'pipe' });
}

async function syncUbuntuAutostart(enabled, execPath) {
  if (!canManageUserService()) {
    return { success: true, skipped: true, reason: 'not_linux' };
  }

  try {
    if (!enabled) {
      try {
        runSystemctl(['disable', '--now', SERVICE_NAME]);
      } catch (_) {}

      if (fs.existsSync(SERVICE_PATH)) {
        await fs.promises.unlink(SERVICE_PATH);
      }

      return { success: true, enabled: false, path: SERVICE_PATH };
    }

    const content = await writeServiceFile(execPath);
    runSystemctl(['daemon-reload']);
    runSystemctl(['enable', '--now', SERVICE_NAME]);

    return {
      success: true,
      enabled: true,
      path: SERVICE_PATH,
      verified: fs.existsSync(SERVICE_PATH) && fs.readFileSync(SERVICE_PATH, 'utf8') === content
    };
  } catch (error) {
    return { success: false, error: error.message, path: SERVICE_PATH };
  }
}

module.exports = {
  SERVICE_NAME,
  SERVICE_PATH,
  resolveAppImagePath,
  syncUbuntuAutostart
};
