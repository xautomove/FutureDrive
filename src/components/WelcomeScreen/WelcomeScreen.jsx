import React from 'react';
import { Button, Tooltip } from 'antd';
import { DeleteOutlined, RocketOutlined } from '@ant-design/icons';
import './WelcomeScreen.css';
import { useI18n } from '../../context/I18nContext';

const WelcomeScreen = ({ recentProjects, onOpenProject, onCreateProject }) => {
  const { t } = useI18n();
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
            <span>{t('welcome.title')}</span>
          </div>
          <div className="welcome-subtitle">
          {t('welcome.subtitle')}
          </div>
        </div>
        <div className="welcome-btns">
          <Button type="primary" size="large" className="welcome-btn" onClick={() => onOpenProject()}>
            {t('welcome.openProject')}
          </Button>
          <Button size="large" className="welcome-btn" onClick={onCreateProject}>
            {t('welcome.newProject')}
          </Button>
        </div>
        <div className="welcome-recent">
          <div className="welcome-recent-header">
            <h4>{t('welcome.recentTitle')}</h4>
            {recentProjects.length > 0 && (
              <Tooltip title={t('welcome.clearRecent')}>
                <DeleteOutlined 
                  className="clear-recent-icon"
                  onClick={handleClearRecent}
                />
              </Tooltip>
            )}
          </div>
          <ul className="welcome-recent-list">
            {recentProjects.length === 0 && <li className="no-recent">{t('welcome.noRecent')}</li>}
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
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 16, textAlign: 'center', color: '#888', fontSize: 14, zIndex: 10 }}>
        {t('welcome.company')}
      </div>
    </div>
  );
};

export default WelcomeScreen; 