import { useState, useEffect } from 'react';

/**
 * 自定义 Hook: 使用 localStorage 持久化状态
 * @param {string} key - localStorage 的键名
 * @param {*} initialValue - 初始值
 * @returns {[*, Function]} 返回 [状态值, 设置状态的函数]
 */
export const useLocalStorage = (key, initialValue) => {
  // 从 localStorage 读取初始值
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // 当状态改变时，更新 localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

