import { useEffect } from 'react';

/**
 * 自定义 Hook: 监听键盘快捷键
 * @param {string} targetKey - 目标按键 (例如: 'Space', 'Enter')
 * @param {Function} callback - 按键触发的回调函数
 * @param {Array} deps - 依赖数组
 */
export const useKeyboardShortcut = (targetKey, callback, deps = []) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 避免在输入框、文本域、按钮中触发
      if (e.target.matches('input, textarea, button')) {
        return;
      }
      
      if (e.code === targetKey) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
};

