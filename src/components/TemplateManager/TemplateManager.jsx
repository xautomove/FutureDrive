import React, { useState, useEffect } from 'react';
import { Modal, Button, message } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import templateManager from '../../controller/gui/TemplateManager';
import fileController from '../../controller/gui/FileController';
import path from 'path';
import './TemplateManager.css';
import { useI18n } from '../../context/I18nContext';

const { shell } = window.require ? window.require('electron') : require('electron');

const TemplateManager = ({ visible, onClose, onApplyTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = () => {
    setLoading(true);
    try {
      const templateList = templateManager.getTemplateList();
      setTemplates(templateList);
    } catch (error) {
      message.error(t('templateManager.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (template) => {
    try {
      const templateData = await templateManager.loadTemplate(template.fileName);
      if (onApplyTemplate) {
        onApplyTemplate(templateData);
        onClose();
        message.success(t('templateManager.applied', { name: template.name }));
      }
    } catch (error) {
      message.error(t('templateManager.applyFailed', { msg: error.message }));
    }
  };

  const handleImportTemplate = async () => {
    try {
      const result = await fileController.selectFile({
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });

      if (!result.success) {
        return;
      }

      const templateDir = templateManager.getTemplateDir();
      const fileName = path.basename(result.filePath);
      const targetPath = path.join(templateDir, fileName);

      if (fileController.fileExists(targetPath)) {
        Modal.confirm({
          title: t('templateManager.fileExistsTitle'),
          content: t('templateManager.fileExistsContent', { name: fileName }),
          okText: t('templateManager.overwrite'),
          cancelText: t('templateManager.cancel'),
          onOk: async () => {
            try {
              const copyResult = fileController.copyFile(result.filePath, targetPath);
              if (!copyResult.success) {
                message.error(t('templateManager.importFailedX', { msg: copyResult.error }));
                return;
              }

              loadTemplates();
              message.success(t('templateManager.importSuccess'));
            } catch (error) {
              message.error(t('templateManager.importFailedX', { msg: error.message }));
            }
          }
        });
        return;
      }

      const copyResult = fileController.copyFile(result.filePath, targetPath);
      if (!copyResult.success) {
        message.error(t('templateManager.importFailedX', { msg: copyResult.error }));
        return;
      }

      loadTemplates();
      message.success(t('templateManager.importSuccess'));
    } catch (error) {
      message.error(t('templateManager.importFailedX', { msg: error.message }));
    }
  };

  return (
    <div>
      <Modal
        className="template-manager-modal"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('templateManager.title')}</span>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button
              key="market"
              type="default"
              onClick={() => shell.openExternal('https://market.automoves.cn/')}
              style={{ marginLeft: 8 }}
            >
              {t('templateManager.market')}
            </Button>,
          <Button 
            key="import" 
            type="primary" 
            icon={<ImportOutlined />}
            onClick={handleImportTemplate}
          >
            {t('templateManager.importTemplate')}
          </Button>
        ]}
      >
        <div className="template-list">
          {templates.map((template, index) => (
            <div key={index} className="template-item">
              <div className="template-info">
                <div className="template-header">
                  <span className="template-name">{template.name}</span>
                  <span className="template-version">v{template.version}</span>
                </div>
                <span className="template-description" title={template.description}>{template.description}</span>
                <span className="template-date">{new Date(template.created).toLocaleString()}</span>
              </div>
              <Button 
                type="primary" 
                size="small"
                onClick={() => handleApplyTemplate(template)}
              >
                {t('templateManager.apply')}
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default TemplateManager; 