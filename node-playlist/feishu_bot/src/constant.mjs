import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 获取 constant.json 的完整路径
 * @returns {string} 绝对路径
 */
export const getConstantJsonPath = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, 'constant.json');
};

/**
 * 读取 constant.json 内容
 * @returns {Promise<object>} 解析后的 JSON 对象
 */
export const readConstantJson = async () => {
  const constantPath = getConstantJsonPath();
  try {
    const content = await fs.readFile(constantPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('读取 constant.json 失败:', err.message);
    }
    return {};
  }
};

/**
 * 写入数据到 constant.json（自动合并原有内容）
 * @param {object} data - 要写入的 JSON 数据
 */
export const writeConstantJson = async (data) => {
  if (typeof data !== 'object' || data === null) {
    throw new Error('写入数据必须是 JSON 对象');
  }

  const constantPath = getConstantJsonPath();
  const existingData = await readConstantJson();
  const finalData = Object.assign(existingData, data);

  await fs.writeFile(constantPath, JSON.stringify(finalData, null, 2), 'utf8');
  console.log('成功写入 constant.json:', finalData);
};
