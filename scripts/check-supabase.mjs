import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try { loadEnvFile(resolve(root, '.env')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Supabase 尚未配置：填写 .env 中的 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY。');
  process.exitCode = 1;
} else {
  const target = new URL(url);
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co') || target.username || target.password || target.port || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('SUPABASE_URL 必须是所选项目的标准 HTTPS Supabase 地址。');
  }
  if (!key.startsWith('sb_publishable_')) throw new Error('只接受 publishable key，不接受 secret/service_role key。');
  const response = await fetch(new URL('/auth/v1/settings', target), {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Supabase API 检查失败：HTTP ${response.status}`);
  await response.json();
  console.log(`Supabase API 已连接：${target.origin}（HTTP ${response.status}）。此检查不代表业务表或云端同步已完成。`);
}
