---
name: nastech-ops
description: 运维 NasTech Agent 的实战 skill。适用于用户提到“运维 nastech”“排查 nastech 问题”“gateway 异常”“平台掉线”“cron 不执行”“profile 配置混乱”“skills 或 tools 不生效”“想让其他 agent 帮忙维护 nastech”时使用。基于 nastech-agent 源码和官方命令入口，优先做检查、定位、修复、验证四步，不凭感觉瞎改。
---

# NasTech Ops

这个 skill 是给其他 agent 拿来运维 NasTech Agent 的。

重点不是泛泛介绍 NasTech 是啥。
重点是：
- 先判断问题在哪
- 再动手修
- 修完要验证
- 不能上来就重装一把梭

## 适用场景

当用户出现这些诉求时，用这个 skill：
- 运维 nastech
- gateway 起不来、老掉线、重启后异常
- 某个平台收不到消息
- cron 不执行
- profile 切换后配置错乱
- tools / skills / mcp 不生效
- 想让另一个 agent 接管 NasTech 的排查和维护
- 想做 NasTech 的日常健康检查

不适用：
- 只是想了解 NasTech 概念
- 只是想看源码架构，不需要运维动作
- 只是想创建普通 skill

## 设计模式

本 skill 主要采用：
- Reviewer：先看现状，再下判断
- Operator：按检查、修复、验证顺序执行
- Inversion：先排除配置和状态问题，再怀疑代码
- Generator（轻度）：必要时产出巡检报告、修复建议、运维命令清单

## Gotchas

- 不要一上来就重装 NasTech
- 不要没看 `nastech status`、`nastech doctor`、`nastech gateway status` 就乱猜
- 不要把“平台配置问题”和“服务进程问题”混为一谈
- 不要默认所有改动都该落到源码仓库，运维问题很多只在 `~/.nastech/` 配置层
- 不要修改用户的外部平台配置或对外发送内容，除非用户明确要求
- 如果涉及重启、安装、卸载、修改系统级服务，要先确认影响范围
- 修完必须验证，不能只说“理论上应该好了”

## 运维总流程

复制这份清单并持续更新：

```text
处理进度：
- [ ] 步骤 1：确认问题范围
- [ ] 步骤 2：读取当前状态
- [ ] 步骤 3：定位归因
- [ ] 步骤 4：实施修复
- [ ] 步骤 5：验证结果
- [ ] 步骤 6：输出结论和后续建议
```

## 步骤 1：确认问题范围

先把问题归到下面某一类，别一锅炖：

1. **基础健康类**
   - NasTech 能不能正常跑
   - 模型和认证有没有问题
   - 配置文件是否缺项或过期

2. **Gateway / 平台类**
   - gateway 进程是否活着
   - 某个平台是否已连接
   - 重启后是否恢复

3. **配置类**
   - `config.yaml`、`.env`、profile 配置是否冲突
   - 新版本选项是否没迁移

4. **能力加载类**
   - tools / skills / MCP / plugins 不生效
   - platform toolsets 配置不对

5. **调度与自动化类**
   - cron 不执行
   - webhook 触发失效
   - pairing / auth / memory provider 状态异常

6. **源码或扩展类**
   - 新平台适配器异常
   - 本地改过 NasTech 源码后行为不对

如果用户没说清楚，也别磨叽。先按最常见的基础健康类 + gateway 类检查。

## 步骤 2：读取当前状态

优先跑这些命令，按需增减：

```bash
nastech status --all
nastech doctor
nastech config path
nastech config env-path
nastech config check
nastech gateway status
nastech profile list
nastech skills list
nastech tools list
nastech cron list --all
nastech auth list
```

如果问题更具体，再继续：

```bash
nastech gateway restart
nastech gateway start
nastech gateway stop
nastech config show
nastech config migrate
nastech sessions list
nastech memory status
nastech webhook list
nastech profile show <name>
```

补充说明：
- `nastech status --all` 适合先看全局健康度
- `nastech doctor` 适合看依赖、配置和常见错误
- `nastech gateway status` 适合确认服务是否真在跑
- `nastech config check` 和 `nastech config migrate` 适合版本升级后排查配置漂移
- `nastech profile list` / `nastech profile show` 适合排查 profile 切换导致的问题

## 步骤 3：定位归因

按这个顺序判断，效率更高：

### A. 先看是不是配置问题

常见信号：
- `nastech doctor` 报缺依赖或缺配置
- `nastech config check` 报 missing / outdated
- 换 profile 后问题才出现
- 某功能之前好好的，升级后坏了

处理思路：
- 先看 `config.yaml` 路径是否对
- 再看 `.env` 是否缺关键变量
- 再跑 `nastech config migrate`
- 必要时对比不同 profile 的配置差异

### B. 再看是不是服务进程问题

常见信号：
- `nastech gateway status` 显示没运行
- 重启后短暂恢复，随后又挂
- 某平台偶发掉线，但配置没变

处理思路：
- 先 `nastech gateway restart`
- 再看状态是否恢复
- 如果恢复不了，再去查日志或源码入口

### C. 再看是不是认证或外部依赖问题

常见信号：
- 模型调用失败
- OAuth / API key 过期
- 某 provider 总是 unavailable

处理思路：
- `nastech auth list`
- `nastech status --all`
- 必要时重新登录或补凭据

### D. 最后才怀疑源码改动或平台适配器

常见信号：
- 只在自定义平台或自定义分支里出错
- 官方命令正常，但某扩展平台不正常
- 改完仓库代码后开始出错

处理思路：
- 去源码仓库核对 CLI 命令入口、平台注册、配置映射
- 优先看 `nastech_cli/main.py`、`gateway/run.py`、对应 platform adapter 文件
- 不要一开始就把锅甩给模型或网络

## 步骤 4：实施修复

### 4.1 安全修复

优先做低风险动作：

```bash
nastech config migrate
nastech gateway restart
nastech doctor --fix
```

如果只是状态漂移、配置缺项、服务假死，这一层常常就够了。

### 4.2 配置修复

当命令输出已经明确指向配置问题时：
- 编辑 `config.yaml`
- 补齐 `.env`
- 修正 profile 的模型、provider、toolsets、platform 配置
- 修正 skills 或 MCP 配置

注意：
- 改前先读当前文件
- 改后立刻重新检查，不要连续乱改三四处

### 4.3 Gateway / 平台修复

如果是平台连接问题：
- 检查对应平台是否在配置里启用
- 检查 gateway 是否已重启并成功加载平台
- 检查 platform toolsets 是否限制了关键工具
- 如果是新增平台或自定义适配器，核对源码里的平台枚举、注册逻辑和 adapter 文件

### 4.4 源码层修复

只有在确定是源码问题时才做：
- 在本地源码仓库里改
- 优先最小修复
- 改完跑最小验证命令
- 记录影响文件和原因

如果当前环境里存在多个仓库副本，优先使用用户当前实际运行的那个，不要改错仓库。

## 步骤 5：验证结果

至少做一层验证，最好两层：

### 基础验证

```bash
nastech doctor
nastech status --all
nastech gateway status
```

### 针对性验证

按问题类型补：
- gateway 问题：重启后再次看 `nastech gateway status`
- cron 问题：`nastech cron list --all`，必要时手动 run 一次目标任务
- profile 问题：`nastech profile show <name>` 或切 profile 后复测
- skills / tools 问题：`nastech skills list`、`nastech tools list`
- memory / auth 问题：`nastech memory status`、`nastech auth list`

如果无法直接验证，也要明确说清楚哪部分还没验证，不准装。

## 常用命令速查

### 健康检查

```bash
nastech status --all
nastech doctor
nastech doctor --fix
nastech dump
```

### 配置

```bash
nastech config
nastech config path
nastech config env-path
nastech config check
nastech config migrate
nastech config edit
nastech model
nastech setup
```

### Gateway

```bash
nastech gateway run
nastech gateway start
nastech gateway stop
nastech gateway restart
nastech gateway status
nastech gateway setup
```

### Profiles

```bash
nastech profile list
nastech profile show <name>
nastech profile create <name> --clone
nastech -p <name> gateway status
nastech -p <name> skills list
```

### Skills / Tools

```bash
nastech skills list
nastech skills check
nastech skills update
nastech tools list
nastech tools enable <name>
nastech tools disable <name>
```

### 调度与自动化

```bash
nastech cron list --all
nastech cron status
nastech cron run <job_id>
nastech webhook list
```

### 认证与记忆

```bash
nastech auth list
nastech auth add
nastech auth reset <provider>
nastech memory status
```

## 输出模板

最终汇报至少包含这些：

```markdown
# NasTech 运维结果

## 问题范围
- ...

## 排查动作
1. ...
2. ...
3. ...

## 定位结论
- 根因：...
- 影响范围：...

## 修复动作
- ...

## 验证结果
- 已验证：...
- 未验证：...

## 后续建议
1. ...
2. ...
```

## 给其他 agent 的执行要求

如果你是另一个 coding agent，拿到这个 skill 后要遵守：

1. 先跑检查命令，再下结论
2. 没有证据，不要说“应该是”
3. 小步修改，改一处验一处
4. 涉及服务重启、安装、卸载、系统级变更时，先确认风险
5. 涉及对外发送消息、触发真实外部动作时，先征求用户确认
6. 修完要汇报，不要默默结束

## 参考依据

本 skill 基于这些实际来源整理：
- `~/Documents/coding/github/nastech-agent/nastech_cli/main.py` 中的 CLI 命令入口
- `~/Documents/coding/github/nastech-agent/skills/autonomous-ai-agents/nastech-agent/SKILL.md`
- `~/Documents/coding/github/nastech-agent/website/docs/reference/cli-commands.md`
- `~/Documents/coding/github/nastech-agent/website/docs/reference/profile-commands.md`
- `~/Documents/coding/github/nastech-agent/website/docs/reference/faq.md`

如果后续 NasTech CLI 命令变了，要同步更新这个 skill，别让它过期。
