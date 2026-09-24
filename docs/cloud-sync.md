# 共享旅行云同步

## 当前行为

用户确认先公开、不增加验证，随后要求全部设备同步。一个公开共享工作区承载旅行信息、地图方案、事件、照片引用、清单、留言和攻略。任何获得链接的人都可查看及编辑；未配置用户身份或所有者隔离。

内容保存在独立 Supabase 项目 xqardnobmoaxosjqwiwh，前端由 GitHub Pages 托管。本地与公网访问同一工作区。服务器确认后才显示保存成功；页面可见时每 10 秒检查版本，返回页面、恢复网络及手动同步会立即检查。未发生变更返回 304，避免反复传输完整行程。

断网时缓存供查看，写入需连通服务器；保存失败保留表单和可导出的未保存草稿，不宣称已经同步。首次迁移前与服务器不同的本机内容也保存为可导出备份。旧静态页面只写本机的变化不会被自动上传覆盖服务器，请更新旧标签页。

并发保存使用服务器版本比较：不同字段或不同记录的变化自动合并；同一字段、删除对方正在修改的记录、相互冲突的排序拒绝覆盖并保留草稿。失败重试使用同一请求编号，避免响应丢失造成重复保存。打开编辑窗口时暂停自动刷新，提交时仍检查服务器版本。

## 数据与权限

- public.travel_workspaces：唯一 main 工作区、当前版本、完整 JSON、更新时间。
- public.travel_revisions：保留最近 100 个保存版本，包含请求编号，可由管理员核对和恢复。
- 两表均启用 RLS，anon/authenticated 不拥有直接访问权限，RPC 也仅 service_role 可执行。
- travel_save 为 SECURITY INVOKER；短事务内锁定工作区，检查预期版本、更新内容并写历史。
- travel-sync Edge Function 为有意公开的协作入口（verify_jwt=false），只操作固定工作区；校验来源、方法、2 MB 请求限制、文档模型及版本，服务端凭据只来自函数环境变量。
- 浏览器只有公开函数地址，没有 service_role 或 secret key。CORS 不能阻止非浏览器请求，不是身份验证。

## 部署与维护

数据库 DDL 记录在 supabase/schema.sql，对应远端 shared_travel_workspace 迁移，不能在已建立数据库上盲目重复执行。

运行 `node scripts/edge-bundle.mjs`，用生成的 .runtime/edge-bundle.json 作为 Supabase deploy_edge_function 的 files，entrypoint=index.ts，函数名 travel-sync。共享验证模型变化时同时更新函数。普通页面变更由 Pages 工作流发布。

后续如启用登录，需同时调整公开 Edge 入口及数据库访问规则；仅在网页添加口令不会限制现有公开数据接口。

## 验证

单元测试覆盖不同记录合并、同字段冲突、删除对编辑、排序、CAS 重试、请求幂等及 304。真实云端验证重复请求只保存一次、旧版本写入返回 409、非法文档返回 400、外站浏览器来源返回 403。两个独立来源浏览器完成清单双向勾选和留言共享，清理测试内容后逐字段与原资料核对一致（版本号除外）。

官方参考：[Edge 授权头](https://supabase.com/docs/guides/functions/auth-headers)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
