const fs = window.require('fs');
const path = window.require('path');

class HardwareController {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.hardwareDir = path.join(projectPath, 'Hardware');
    this.configPath = path.join(this.hardwareDir, 'config.json');
  }

  ensureHardwareDir() {
    if (!fs.existsSync(this.hardwareDir)) {
      fs.mkdirSync(this.hardwareDir, { recursive: true });
    }
  }

  readConfig() {
    this.ensureHardwareDir();
    if (!fs.existsSync(this.configPath)) {
      return { devices: [] };
    }
    try {
      const content = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return { devices: [] };
    }
  }

  writeConfig(config) {
    this.ensureHardwareDir();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  addDevice(device) {
    const config = this.readConfig();
    config.devices = config.devices || [];
    config.devices.push(device);
    this.writeConfig(config);
  }

  async getDriverList() {
    try {
      const response = await fetch('http://127.0.0.1:8080/api/driver/list');
      const data = await response.json();
      if (Array.isArray(data)) {
        return data;
      }
      throw new Error('数据格式错误');
    } catch (e) {
      return [
        // {
        //   brand: '诚科',
        //   model: 'IMUA1',
        //   driver_url: 'http://example.com/driverA1',
        //   version: '1.0.0',
        //   topic:'/imu_raw'
        // },
        // {
        //   brand: '禾赛',
        //   model: 'P40',
        //   driver_url: 'http://example.com/driverB1',
        //   version: '2.1.3',
        //   topic:'/points_raw'
        // }
      ];
    }
  }
}

export default HardwareController; 