import React from 'react';
import { Button, Tooltip } from 'antd';
import { DeleteOutlined, RocketOutlined } from '@ant-design/icons';
import './WelcomeScreen.css';

const WelcomeScreen = ({ recentProjects, onOpenProject, onCreateProject }) => {
  const handleClearRecent = (e) => {
    e.stopPropagation();
    localStorage.removeItem('recentProjects');
    window.location.reload();
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-header">
          <div className="welcome-title">
            <RocketOutlined className="welcome-icon" />
            <span>欢迎使用 FutureDrive</span>
          </div>
          <div className="welcome-subtitle">
          连接 · 控制 · 调试 · 可视，一站式自动驾驶流程化解决方案
          </div>
        </div>
        <div className="welcome-btns">
          <Button type="primary" size="large" className="welcome-btn" onClick={() => onOpenProject()}>
            打开项目
          </Button>
          <Button size="large" className="welcome-btn" onClick={onCreateProject}>
            新建项目
          </Button>
        </div>
        <div className="welcome-recent">
          <div className="welcome-recent-header">
            <h4>最近打开的项目</h4>
            {recentProjects.length > 0 && (
              <Tooltip title="清空最近项目列表">
                <DeleteOutlined 
                  className="clear-recent-icon"
                  onClick={handleClearRecent}
                />
              </Tooltip>
            )}
          </div>
          <ul className="welcome-recent-list">
            {recentProjects.length === 0 && <li className="no-recent">暂无最近项目</li>}
            {recentProjects.map((proj, idx) => (
              <li key={idx}>
                <a href="#" onClick={e => { e.preventDefault(); onOpenProject(proj.path); }}>
                  {proj.name} <span className="project-path">({proj.path})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen; 