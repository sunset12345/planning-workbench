# 策划技能

这套 Skill 用于理清当前功能需求，覆盖修订记录、可编辑导图、功能逻辑、配置字段、逐页 UI、多语言、音效，以及后续红点和业务打点。

默认面向研发阅读：优先说明类型、单值/list及数量约束、计算公式和UI状态；具体奖励与数值放配置附件或折叠示例。

正式策划案默认使用 HTML，并附同版本 `planning.json` 供未来工作台导入；统一归属和稳定 ID，导入并开始在线编辑后以工作台为维护入口。策划案及制作需求表不包含完成状态、完整度、审批、验收或待确认事项管理。

HTML：正文、UI 和字段表集中阅读，图示保留节点与连线源码及页内编辑入口；美术、UI、特效需求分别交付独立 Excel 并以超链接引用。可附 HTML 演示。

| 内容 | 入口 |
| --- | --- |
| 可编辑技能正文 | [SKILL.md](game-feature-planning/SKILL.md) |
| 可套用模板 | [功能策划案模板](game-feature-planning/assets/功能策划案模板.md) |
| 详细规范 | [交付细则与检查](game-feature-planning/references/交付细则与检查.md) |
| 文档与图示格式 | [HTML 文档与可编辑图示规范](game-feature-planning/references/HTML文档与可编辑图示规范.md) |
| 工作台适配 | [归属、稳定 ID、导入数据与维护入口](game-feature-planning/references/工作台适配与导入规范.md) |
| 分发文件 | [game-feature-planning.zip](发布包/game-feature-planning.zip) |

调用示例：

> 使用 $game-feature-planning，基于当前方案按统一格式整理 HTML 策划案，补齐 UI 逻辑和配置字段，导图及配置结构图保留源码和页内节点、连线编辑入口，未明确的规则在对应位置简短标注。

将发布包解压后，把完整的 `game-feature-planning/` 文件夹交给策划安装到其使用工具的技能目录。技能所需规范、模板和导图组件均包含在文件夹内，不依赖本仓库的策划案例。

修改技能时编辑 `game-feature-planning/` 源文件，再重新生成发布包；ZIP 是分发快照。
