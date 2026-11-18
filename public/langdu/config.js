/**
 * 站点配置（自动区分本地开发与线上部署）
 */
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

window.APP_CONFIG = {
  // 线上走 shangjiehaoke 的 Cloudflare Worker；本地走同源 /api/aliyun-token
  tokenUrl: isLocal ? '/api/aliyun-token' : 'https://api.shangjiehaoke.com/api/aliyun-token',

  // 阿里云实时语音识别网关（上海地域）
  aliyunGateway: 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',

  // 由后端接口随 Token 一并返回
  appkey: '',

  // 默认识别方式：'aliyun' 阿里云 / 'demo' 演示模式
  defaultAsr: 'aliyun',
};
