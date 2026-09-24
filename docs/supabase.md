# Supabase 环境

2026-09-24 经用户确认创建 Travelagent 独立项目。

| 项目 | 当前值 |
| --- | --- |
| 组织 | Sherlock3rd's Org |
| 项目名 | Travelagent |
| 项目 ref | xqardnobmoaxosjqwiwh |
| 区域 | ap-southeast-1（新加坡） |
| API 地址 | https://xqardnobmoaxosjqwiwh.supabase.co |
| 控制台 | https://supabase.com/dashboard/project/xqardnobmoaxosjqwiwh |
| 创建时报价 | Free / 0 USD 每月；不代表未来超额用量或套餐变更的承诺 |

## 已验证

- 项目 ACTIVE_HEALTHY。
- 数据库 SELECT 查询成功。
- npm run check:cloud 使用本机 .env 的 publishable key 访问 Auth settings，HTTP 200。
- 创建后 security advisors 无告警，public schema 无业务表。
- .env 被 Git 忽略，没有把 service_role/secret key 放入代码或浏览器。

## 尚未实现

旅行业务数据、账户与权限、多人留言、跨设备同步尚未接入。网页当前仅保存到浏览器；不能把项目健康或 API 连通视为业务同步完成。

后续确认访问范围后，再建设数据表、RLS 和同步冲突处理。不复用其他项目业务表。
