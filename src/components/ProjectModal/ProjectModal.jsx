import React, { useState } from 'react';
import { Modal, Form, Input, Button, message, Space } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import './ProjectModal.css';
import { log } from '../../assets/js/utils';

const { TextArea } = Input;
const { dialog } = window.require('@electron/remote');
const fs = window.require('fs');
const path = window.require('path');

const ProjectModal = ({ visible, onClose, onCreate, onOpenProject }) => {
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
        message.error('项目目录已存在');
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

      message.success('项目创建成功');
      onCreate(projectDir);
      resetForm();
      onClose();

      try {
        log(`正在打开项目: ${projectDir}`, 'INFO');
        
        onOpenProject(projectDir);
      } catch (error) {
        log(`打开项目失败: ${error.message}`, 'ERROR');
        message.error('打开项目失败');
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      message.error(error.message || '项目创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const projectName = form.getFieldValue('name');
      if (!projectName) {
        message.warning('请先填写项目名称');
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
      message.error('选择目录失败');
    }
  };

  return (
    <Modal
      title="新建项目"
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
          label="项目名称"
          rules={[
            { required: true, message: '请输入项目名称' },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: '项目名称只能包含字母、数字、下划线和连字符' }
          ]}
        >
          <Input placeholder="请输入项目名称" />
        </Form.Item>

        <Form.Item
          name="description"
          label="项目描述"
        >
          <TextArea
            placeholder="请输入项目描述"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>

        <Form.Item
          label="项目保存位置"
          required
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="path"
              noStyle
              rules={[{ required: true, message: '请选择项目保存位置' }]}
            >
              <Input
                style={{ width: 'calc(100% - 80px)' }}
                placeholder="请选择项目保存位置"
                readOnly
              />
            </Form.Item>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleSelectPath}
              className="select-path-button"
            >
              浏览
            </Button>
          </Space.Compact>
        </Form.Item>

        <Form.Item className="form-footer">
          <Button style={{ marginRight: '10px' }} onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            onClick={handleCreate}
            loading={loading}
          >
            创建项目
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectModal; 