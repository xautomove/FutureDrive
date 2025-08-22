import React from 'react';
import { Modal, Button, Typography, Space, Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { shell } from 'electron';
import './AboutModal.css';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { remote } from 'electron';
import { message } from 'antd';
import { useI18n } from '../../context/I18nContext';

const { Text, Title, Paragraph } = Typography;

const LICENSE_URL = 'https://future.automoves.cn/license';
const LEGAL_URL = 'https://future.automoves.cn/legal';

const localVersion = '1.1.0';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/xautomove/FutureDrive/releases';

const AboutModal = ({ visible, onClose }) => {
  const { t } = useI18n();
  const handleOpenUrl = async (url) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error('打开链接失败:', error);
    }
  };

  function compareVersion(v1, v2) {
    const a1 = v1.split('.').map(Number);
    const a2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(a1.length, a2.length); i++) {
      const n1 = a1[i] || 0, n2 = a2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  async function downloadAndOpen(url, filename) {
    const { dialog } = remote;
    const savePath = dialog.showSaveDialogSync({
      title: t('about.checkUpdate'),
      defaultPath: path.join(remote.app.getPath('downloads'), filename)
    });
    if (!savePath) return;

    const writer = fs.createWriteStream(savePath);
    let received = 0;
    let total = 0;
    let hideLoading = message.loading(t('about.downloading'), 0);

    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });
      total = Number(response.headers['content-length']) || 0;
      response.data.on('data', chunk => {
        received += chunk.length;
        if (total) {
          hideLoading();
          hideLoading = message.loading(t('about.downloadProgress', { percent: ((received / total) * 100).toFixed(1) }), 0);
        }
      });
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      hideLoading();
      message.success(t('about.downloadDone'));
      shell.showItemInFolder(savePath);
    } catch (e) {
      hideLoading();
      message.error(t('about.downloadFailed', { msg: e.message }));
    }
  }

  const handleCheckUpdate = async () => {
    let hideLoading;
    try {
      hideLoading = message.loading(t('about.checkingUpdate'), 0);
      const { data } = await axios.get(GITHUB_RELEASES_URL, { timeout: 10000 });
      if (!Array.isArray(data) || data.length === 0) {
        hideLoading();
        message.info(t('about.noReleaseInfo'));
        return;
      }
      const latest = data[0];
      const latestVersion = latest.tag_name.replace(/^v/, '');
      if (compareVersion(localVersion, latestVersion) >= 0) {
        hideLoading();
        message.success(t('about.isLatest'));
        return;
      }
      const asset = latest.assets.find(a => a.name.endsWith('.AppImage'));
      if (!asset) {
        hideLoading();
        message.error(t('about.noInstaller'));
        return;
      }
      hideLoading();
      Modal.confirm({
        title: t('about.newVersionTitle'),
        content: t('about.newVersionContent', { version: latestVersion }),
        okText: t('about.download'),
        cancelText: t('about.cancel'),
        onOk: () => downloadAndOpen(asset.browser_download_url, asset.name)
      });
    } catch (e) {
      hideLoading && hideLoading();
      message.error(t('about.checkFailed', { msg: e.message }));
    }
  };

  return (
    <Modal
      title={t('about.modalTitle')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      className="about-modal"
    >
      <div className="about-content">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="version-section">
            <Title level={3}>{t('about.productTitle')}</Title>
            <Space>
              <Text strong>{t('about.versionFree', { version: localVersion })}</Text>
              <Button 
                type="primary" 
                icon={<SyncOutlined />} 
                onClick={handleCheckUpdate}
              >
                {t('about.checkUpdate')}
              </Button>
            </Space>
          </div>

          <div className="company-info">
            <Paragraph>
              <Text strong>{t('about.teamLabel')}</Text> {t('about.teamValue')}
            </Paragraph>
            <Paragraph>
              <Text strong>{t('about.companyLabel')}</Text> {t('about.companyValue')}
            </Paragraph>
            <Paragraph>
              <Text strong>{t('about.contactLabel')}</Text> {t('about.contactValue')}
            </Paragraph>
          </div>

          <div className="legal-section">
            <Space direction="vertical" size="small">
              <Tooltip title={t('about.licenseTip')}>
                <Text 
                  className="clickable-text"
                  onClick={() => handleOpenUrl(LICENSE_URL)}
                >
                  {t('about.license')}
                </Text>
              </Tooltip>
              <Tooltip title={t('about.legalTip')}>
                <Text 
                  className="clickable-text"
                  onClick={() => handleOpenUrl(LEGAL_URL)}
                >
                  {t('about.legal')}
                </Text>
              </Tooltip>
            </Space>
          </div>
        </Space>
      </div>
    </Modal>
  );
};

export default AboutModal; 