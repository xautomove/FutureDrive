import React, { useState } from 'react';
import { Modal, Form, Input, Button, message, Space } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import './ProjectModal.css';
import { log } from '../../assets/js/utils';
import { useI18n } from '../../context/I18nContext';

const { TextArea } = Input;
const { dialog } = window.require('@electron/remote');
const fs = window.require('fs');
const path = window.require('path');

const ProjectModal = ({ visible, onClose, onCreate, onOpenProject }) => {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    form.resetFields();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const projectDir = values.path;
      if (fs.existsSync(projectDir)) {
        message.error(t('projectModal.dirExists'));
        return;
      }

      fs.mkdirSync(projectDir, { recursive: true });

      const projectConfig = {
        name: values.name,
        description: values.description,
        path: projectDir,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      };

      const configPath = path.join(projectDir, `${values.name}.proj`);
      fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));

      message.success(t('projectModal.createSuccess'));
      onCreate(projectDir);
      resetForm();
      onClose();

      try {
        log(`正在打开项目: ${projectDir}`, 'INFO');
        
        onOpenProject(projectDir);
      } catch (error) {
        log(`打开项目失败: ${error.message}`, 'ERROR');
        message.error(t('projectModal.openFailed'));
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      message.error(error.message || t('projectModal.createFail'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const projectName = form.getFieldValue('name');
      if (!projectName) {
        message.warning(t('projectModal.fillNameWarn'));
        return;
      }
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        const projectPath = path.join(result.filePaths[0], projectName);
        form.setFieldsValue({ path: projectPath });
      }
    } catch (error) {
      console.error('选择目录失败:', error);
      message.error(t('projectModal.selectDirFail'));
    }
  };

  return (
    <Modal
      title={t('projectModal.title')}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
      className="project-modal"
    >
      <Form
        form={form}
        layout="vertical"
        className="project-form"
      >
        <Form.Item
          name="name"
          label={t('projectModal.name')}
          rules={[
            { required: true, message: t('projectModal.nameRequired') },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: t('projectModal.namePattern') }
          ]}
        >
          <Input placeholder={t('projectModal.nameRequired')} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('projectModal.description')}
        >
          <TextArea
            placeholder={t('projectModal.descriptionPlaceholder')}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>

        <Form.Item
          label={t('projectModal.saveLocation')}
          required
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="path"
              noStyle
              rules={[{ required: true, message: t('projectModal.chooseSaveLocation') }]}
            >
              <Input
                style={{ width: 'calc(100% - 80px)' }}
                placeholder={t('projectModal.chooseSaveLocation')}
                readOnly
              />
            </Form.Item>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleSelectPath}
              className="select-path-button"
            >
              {t('projectModal.browse')}
            </Button>
          </Space.Compact>
        </Form.Item>

        <Form.Item className="form-footer">
          <Button style={{ marginRight: '10px' }} onClick={handleClose}>{t('projectModal.cancel')}</Button>
          <Button
            type="primary"
            onClick={handleCreate}
            loading={loading}
          >
            {t('projectModal.create')}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectModal; 