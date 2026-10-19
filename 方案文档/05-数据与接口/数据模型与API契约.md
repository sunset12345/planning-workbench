# 数据模型与 API 契约

## 1. 推荐结构

前端 React + TypeScript；本地 Node.js 服务端；SQLite 保存业务数据、结构化正文、版本与索引；资源目录保存图片和原件。框架、包版本和数据库驱动在实施前锁定，不为方案增加多种并行栈。

浏览器 → 同源 API → 认证/权限 → 文档、图谱、导入、资源、搜索服务 → SQLite/文件目录。

数据库是业务权威来源；资源文件不可变，通过新资源版本替换引用。开发脚本、UI和导入器不直接写正文表，统一进入文档服务。

## 2. 最小实体

| 实体 | 核心字段 | 约束 |
| --- | --- | --- |
| Project | id, name, status, revision | 项目范围隔离 |
| Membership | projectId, userId, role | 联合唯一；用户存在于白名单 |
| System | id, projectId, name | 属于项目 |
| Feature | id, projectId, systemId, name | 系统与项目一致 |
| Document | id, projectId, ownerType/ownerId, title, schemaVersion, contentJson, revision, workflowStatus | owner 为系统或功能；正文唯一权威 |
| SectionIndex | id, documentId, categoryKey, fillStatus, order, title | 从正文重建，不允许独立修改正文 |
| BlockIndex | id, sectionId, documentId, text, subtype | 从正文重建，稳定定位 |
| Resource | id, projectId, hash, storageKey, originalName, mime, size, status | 生成安全存储键，不以用户文件路径落盘 |
| ResourceRef | resourceId, documentId, blockId, revision | 支持现行/历史引用保护 |
| Relation | id, projectId, fromType/fromId, toType/toId, relationType | 检查两端项目及可见性 |
| Revision | id, documentId, number, contentSnapshot, actorId, createdAt, summary, restoredFrom | 不可变快照 |
| ImportJob | id, projectId, ownerId, status, warnings, temporaryManifest | 预览与确认分离，临时产物有过期策略 |
| AuditEvent | id, actorId, action, objectId, outcome, timestamp | 不包含认证秘密 |
| Session | idHash, userId, authVersion, expiresAt | 不保存明文会话标识 |

用户显示名可作为审计快照，真正身份以稳定 userId 为准；删除白名单记录不改变历史修改人 ID。跨项目引用首版不支持，避免资源与权限边界复杂化。

## 3. 保存事务与一源多视图

一次保存：鉴权 → Schema/资源/ID 校验 → 检查 baseRevision → 在数据库事务内写正文、修订快照、章节/块索引和搜索投影 → 提交 → 返回新 revision。

索引、卡片和关系视图读取已提交状态。图谱的业务归属与显式关系单独存储，其修改也带版本检查；正文改标题只更新显示文本，不改变关系 ID。前端收到成功后失效相关查询缓存，不再维持独立“卡片正文”。

文档保存只能引用已验证成功上传的资源。资源先落临时目录，校验后转不可变正式对象；若随后数据库提交失败，留下无引用对象供延迟清理，不能导致已保存正文引用半文件。清理必须保留历史、导入任务和备份仍需的对象。

## 4. API 草案

所有 API 均以 `/api/v1` 为前缀；除登录与受限健康检查外，全部要求会话。

| 方法与路径 | 用途 | 权限/要点 |
| --- | --- | --- |
| POST /auth/login；POST /auth/logout；GET /me | 认证、退出、当前身份 | CSRF/速率限制，不回传哈希 |
| GET /projects | 授权项目列表 | 仅返回成员项目 |
| GET /projects/:id/graph | 图谱投影 | 项目读权限 |
| POST /projects/:id/relations | 建立显式关系 | 编辑权限，端点校验 |
| GET /projects/:id/documents | 卡片及目录数据 | 过滤、分页 |
| POST /projects/:id/documents | 按模板创建 | 编辑权限 |
| GET /documents/:id | 结构化正文及 revision | 对象级读权限 |
| PUT /documents/:id | 保存正文 | 编辑权限 + baseRevision |
| GET /documents/:id/revisions | 历史列表 | 对象级读权限 |
| GET /documents/:id/revisions/:revision | 历史快照 | 同样鉴权 |
| POST /documents/:id/restore | 恢复为新版本 | 编辑权限 + baseRevision |
| POST /projects/:id/resources | 上传资源 | 编辑权限、限额与格式检测 |
| GET /resources/:id/content | 原件或图片流 | 查资源实际项目权限 |
| POST /projects/:id/import-jobs | 创建转换预览任务 | 不直接发布正文 |
| GET /import-jobs/:id | 查看预览/差异 | 任务及项目权限 |
| POST /import-jobs/:id/confirm | 确认归属与新增/替换 | 再次鉴权；替换检查版本 |
| GET /projects/:id/search | 搜索 | 分页，命中稳定块 ID |
| POST /projects/:id/exports | 创建项目包 | 授权范围、审计 |
| GET /exports/:id/download | 下载导出产物 | 短期有效任务，仍需会话 |

搜索先用受控范围纯文本查询完成中文命中，再按实测考虑索引优化；不假定默认英文分词能完成中文词级检索。索引可重建但必须带正文 revision，不能展示不匹配版本的错误跳转。

## 5. 保存请求/响应示例

以下均为无认证信息的接口形状示例，ID 仅作占位。

```json
{
  "baseRevision": 12,
  "requestId": "EXAMPLE-REQUEST-ID",
  "schemaVersion": 1,
  "title": "示例功能",
  "content": {"type": "doc", "content": []}
}
```

成功：`200 { revision: 13, savedAt, requestId }`。冲突：`409 { code: "REVISION_CONFLICT", currentRevision: 13 }`，前端再获取有权访问的最新版进行比较。相同 requestId + 相同载荷返回原结果；相同 ID 不同载荷拒绝。

错误统一包含 code、message、requestId。401 未登录；403 无权限；404 不可访问或不存在（按统一防枚举策略）；413 超限；415 不支持格式；422 内容不合法；429 限速。服务端不能将异常堆栈、磁盘路径或认证配置发给前端。

## 6. 迁移约束

正文和项目包都有 schemaVersion；数据库迁移先备份，在副本测试后执行，失败回到旧应用与匹配数据。旧版不认识的块不能静默丢弃；保留原内容并以只读/不支持提示打开，或拒绝导入并给出原因。
