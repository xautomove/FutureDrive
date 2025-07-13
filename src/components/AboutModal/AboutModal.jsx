import React from 'react';
import { Modal, Button, Typography, Space, Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { shell } from 'electron';
import './AboutModal.css';

const { Text, Title, Paragraph } = Typography;

const LICENSE_URL = 'https://futuer.automoves.cn/license';
const LEGAL_URL = 'https://futuer.automoves.cn/legal';

const AboutModal = ({ visible, onClose }) => {
  const handleOpenUrl = async (url) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error('打开链接失败:', error);
    }
  };

  const handleCheckUpdate = () => {
    // TODO: 实现检查更新逻辑
    console.log('检查更新');
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
              <Text strong>版本 1.0.2 免费版</Text>
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
              <Text strong>公司：</Text> 浙江春贵科技有限公司
            </Paragraph>
            <Paragraph>
              <Text strong>联系方式：</Text> php300@qqcom
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