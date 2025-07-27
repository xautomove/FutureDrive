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

const { Text, Title, Paragraph } = Typography;

const LICENSE_URL = 'https://future.automoves.cn/license';
const LEGAL_URL = 'https://future.automoves.cn/legal';

const localVersion = '1.0.7';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/xautomove/FutureDrive/releases';

const AboutModal = ({ visible, onClose }) => {
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
      title: '保存新版本',
      defaultPath: path.join(remote.app.getPath('downloads'), filename)
    });
    if (!savePath) return;

    const writer = fs.createWriteStream(savePath);
    let received = 0;
    let total = 0;
    let hideLoading = message.loading('正在下载...', 0);

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
          hideLoading = message.loading(`下载进度：${((received / total) * 100).toFixed(1)}%`, 0);
        }
      });
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      hideLoading();
      message.success('下载完成');
      shell.showItemInFolder(savePath);
    } catch (e) {
      hideLoading();
      message.error('下载失败: ' + e.message);
    }
  }

  const handleCheckUpdate = async () => {
    let hideLoading;
    try {
      hideLoading = message.loading('正在检查更新...', 0);
      const { data } = await axios.get(GITHUB_RELEASES_URL, { timeout: 10000 });
      if (!Array.isArray(data) || data.length === 0) {
        hideLoading();
        message.info('未找到可用的版本信息');
        return;
      }
      const latest = data[0];
      const latestVersion = latest.tag_name.replace(/^v/, '');
      if (compareVersion(localVersion, latestVersion) >= 0) {
        hideLoading();
        message.success('当前已是最新版本');
        return;
      }
      const asset = latest.assets.find(a => a.name.endsWith('.AppImage'));
      if (!asset) {
        hideLoading();
        message.error('未找到可用的安装包');
        return;
      }
      hideLoading();
      Modal.confirm({
        title: '发现新版本',
        content: `检测到新版本 v${latestVersion}，是否下载更新？`,
        okText: '下载',
        cancelText: '取消',
        onOk: () => downloadAndOpen(asset.browser_download_url, asset.name)
      });
    } catch (e) {
      hideLoading && hideLoading();
      message.error('检查更新失败: ' + e.message);
    }
  };

  return (
    <Modal
      title="关于 FutureDrive"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      className="about-modal"
    >
      <div className="about-content">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="version-section">
            <Title level={3}>FutureDrive 自动驾驶</Title>
            <Space>
              <Text strong>版本 1.0.7 免费版</Text>
              <Button 
                type="primary" 
                icon={<SyncOutlined />} 
                onClick={handleCheckUpdate}
              >
                检查更新
              </Button>
            </Space>
          </div>

          <div className="company-info">
            <Paragraph>
              <Text strong>开发团队：</Text> FutureDrive 自动驾驶团队
            </Paragraph>
            <Paragraph>
              <Text strong>公司：</Text> 安徽灵元机器人科技有限公司
            </Paragraph>
            <Paragraph>
              <Text strong>联系方式：</Text> php300@qq.com
            </Paragraph>
          </div>

          <div className="legal-section">
            <Space direction="vertical" size="small">
              <Tooltip title="点击查看许可协议">
                <Text 
                  className="clickable-text"
                  onClick={() => handleOpenUrl(LICENSE_URL)}
                >
                  许可协议
                </Text>
              </Tooltip>
              <Tooltip title="点击查看法律声明">
                <Text 
                  className="clickable-text"
                  onClick={() => handleOpenUrl(LEGAL_URL)}
                >
                  法律免责声明
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