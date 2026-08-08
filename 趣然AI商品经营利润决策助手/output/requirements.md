# 趣然 AI 商品经营与利润决策助手 Requirements Contract

## Metadata

- work_type: feature
- workflow_mode: tech-constrained
- revision: 11
- source_prd: PRD详细版.md
- status: active
- derived_decision: 新品年龄使用批次业务截止日以保证历史重放确定性；跨周动作变化时继承现有主管审核边界，相同动作免重复审核，变化动作待主管确认后生效；稳定经营待办以 SPU/商品链接锚定，每周关联指向最近前序待办，并从该前序批次的不可变决策快照展示当时的主动作、关键依据、库存语境、经营状态与生命周期时间，不用当前周数据回填历史；清仓完成时间采用“运营提交、运营主管确认”双时间并以主管确认作为闭环条件；这些是阶段 5 与设计增量派生产品决策，不冒充用户原始事实

## External capability configuration

| Capability | Credential owner | Configuration actor | Surface | Scope | Lifecycle | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LiteLLM 网关服务 | 运维人员 | 运维人员 | deployment-secret | system | 运维负责部署、轮换与撤销 | MVP | REQ-F04-01、REQ-F04-02、REQ-F04-03 |
| 钉钉企业内部机器人单聊 | 运维/系统管理员 | 运维/系统管理员 | deployment-secret | system | 运维负责应用 Client ID/Secret、机器人编码配置、轮换、停用与失败告警 | MVP | REQ-F06-05、REQ-F07-02 |
| Admin 初始化与部署恢复材料 | 运维 | 运维 | deployment-secret | system | 按目标环境签发、限时、单次消费并在使用后轮换；原始值不落库、不入日志 | MVP | REQ-F09-01、REQ-F09-03 |
| Admin 安全通知通道 | 运维/安全责任岗位 | 运维 | deployment-secret | system | 主通道失败进入可追踪补偿，不得静默恢复 | MVP | REQ-F09-03、REQ-F09-06 |

## Capability prerequisites

| Prerequisite | Status | Owner | Evidence or deadline | Fallback | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 数据支持部门每周 SPU 经营表格 | ready | 数据支持部门 | 用户指定仓库根目录 `商品链接.xlsx` 为唯一当前真实验收源；生产 API→Worker→PostgreSQL 已解析为单期 10 个唯一 SPU，不含只用于历史价值说明的 SPU 515，并如实保留品退周期未校验及库存/14 日销量缺失 | 保留历史清单并提示本周无新批次，不虚构新结论；跨周行为以真实 PostgreSQL 持久化集成测试验证 | MVP | REQ-F01-01、REQ-F02-01 |
| LiteLLM 网关服务已存在 | ready | 运维人员 | 2026-08-05 使用当前系统级配置与真实 `商品链接.xlsx` 完成生产 API→Worker→LiteLLM→PostgreSQL 验证；7 条可执行建议经产品重试 API 后最新版本 7/7 为 `generated`，模型失败和越界版本独立保留且未改变固定决策或任务状态 | 使用结构化固定规则说明，继续开放审核和执行 | MVP | REQ-F04-01、REQ-F04-02 |
| 钉钉统一身份认证与双角色映射 | committed | 事业部负责人审批；唯一 Admin 配置；运维维护身份接入 | 当前 Client 凭据已真实取得 Access Token 且 OAuth 授权跳转成功；生产前必须证明稳定身份、企业作用域和至少两个可靠组织属性可得 | 认证失败或登录态失效时拒绝；认证成功但无唯一角色进入待处理；属性不足时拒绝授权 | MVP | REQ-F07-01、REQ-F07-03、REQ-F09-04、REQ-F09-05 |
| 钉钉企业内部机器人单聊 | ready | 运维/系统管理员 | 2026-08-05 当前 Client 凭据、已发布机器人与唯一真实公司 User ID 已经产品 API 手动协同及 Worker 每日催办两条链路验证；官方 `readStatus` 均为 `SUCCESS`、收件人数 1、当时未读，同日 Worker 重跑无重复记录 | 钉钉调用失败时保留产品内“待通知/通知失败”状态并允许人工补发，不得把接口受理或未读伪造为业务确认 | MVP | REQ-F06-02、REQ-F06-05、REQ-F07-02 |
| F09 生产启用配置 | committed | 运维、唯一 Admin、事业部负责人及治理责任岗位 | 上线前登记有效联系人、认可的审批证据类型、恢复审批/执行/通知岗位，并完成真实浏览器 + PostgreSQL + 钉钉身份闭环及恢复演练 | 任一适用门禁缺失时不得宣称第一版完成或开放无人承接的申请闭环 | MVP | REQ-F09-01—07 |

## Feature F01 · 数据导入与校验

### US-F01-01 · 导入每周经营数据

- Role: 运营
- Goal: 导入数据支持部门提供的 SPU 经营表格并看到校验结果
- Value: 在同一批次内形成可追溯、可重复处理的数据入口
- Stage: MVP
- Status: active

### REQ-F01-01 · 接收经营表并保证请求幂等

- Story: US-F01-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统接收 XLSX 经营表格，按商品链接识别 SPU；重复点击、网络重试或并发提交必须返回第一次成功建立的批次。

### REQ-F01-02 · 校验期间与字段并按影响降级

- Story: US-F01-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统校验业务期间、必要身份和经营字段；必要身份异常拒绝对应行，其他字段按依赖降级，表内汇总行不得参与 SPU 决策。

### AC-F01-01 · 产品场景 AC-1

- Parent: REQ-F01-01
- Priority: P0
- EARS:

```text
WHEN 运营选择玩具事业部、声明合法数据期间和批次业务截止日并导入可读经营表
THE SYSTEM SHALL 显示本次批次及其事业部、业务截止日、期间和校验摘要；首批期间显示为 2026-06-01 至 2026-06-30，并标识为上一个完整自然月。
```

### AC-F01-02 · 产品场景 AC-2

- Parent: REQ-F01-01
- Priority: P0
- EARS:

```text
WHEN 同一导入请求因重复点击、网络重试或并发提交而再次到达
THE SYSTEM SHALL 返回第一次成功建立的批次及其既有清单状态，不新增批次、建议或状态事件。
```

### AC-F01-03 · 产品场景 AC-3

- Parent: REQ-F01-02
- Priority: P0
- EARS:

```text
WHEN 批次声明的数据期间缺失、起止顺序非法或无法解释为本批次使用的完整自然月
THE SYSTEM SHALL 显示批次级期间错误，且不发布依赖该期间的行动清单。
```

### AC-F01-04 · 产品场景 AC-4

- Parent: REQ-F01-02
- Priority: P1
- EARS:

```text
WHEN  SPU 行存在字段错误
THE SYSTEM SHALL 显示字段及原始行位置，并按影响范围降级：SPU ID、链接名称、店铺、平台或责任运营任一缺失，或 SPU ID 在批次内重复时，该行不进入计算；上架日期、销售、利润、品退或库存字段异常只停止依赖该字段的分类、动作或补货判断，不删除其他仍可判定的结果。
```

## Feature F02 · SPU 经营指标计算

### US-F02-01 · 获得统一经营口径

- Role: 运营
- Goal: 查看每个 SPU 的统一销售、利润、品退与库存指标
- Value: 让后续固定规则使用同一数据口径
- Stage: MVP
- Status: active

### REQ-F02-01 · 读取月度销售额与经营准利润率

- Story: US-F02-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统读取数据批次所对应的上一个完整自然月净销售额，并直接采用表内经营准利润率，不按旧公式重算。

### REQ-F02-02 · 计算最近一周品退率

- Story: US-F02-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统按品退件数除以已销售件数计算最近一周滚动品退率，并保留统计期间。

### REQ-F02-03 · 计算库存可售天数

- Story: US-F02-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统按仓内库存与在途库存之和除以最近十四天平均日销量计算库存可售天数。

### AC-F02-01 · 产品场景 AC-5

- Parent: REQ-F02-01
- Priority: P0
- EARS:

```text
WHEN  SPU 明细含有效净销售额
THE SYSTEM SHALL 以扣除退款后的上一个完整自然月净销售额作为非新品销售分层指标，并显示实际期间。
```

### AC-F02-02 · 产品场景 AC-6

- Parent: REQ-F02-01
- Priority: P0
- EARS:

```text
WHEN  SPU 明细含表内“经营准利润率”
THE SYSTEM SHALL 直接采用该值作为上一个完整自然月利润率口径，并标明采用源表值而非旧公式重算。
```

### AC-F02-03 · 产品场景 AC-7

- Parent: REQ-F02-02
- Priority: P0
- EARS:

```text
WHEN 最近 7 天品退件数和已销售件数有效且已销售件数大于 0 
THE SYSTEM SHALL 显示按“品退件数÷已销售件数”得到的最近 7 天品退率及周期。
```

### AC-F02-05 · 产品场景 AC-9

- Parent: REQ-F02-03
- Priority: P0
- EARS:

```text
WHEN 仓内库存、在途库存和最近 14 天平均日销量均有效且日均销量大于 0 
THE SYSTEM SHALL 显示按“（仓内库存+在途库存）÷最近 14 天平均日销量”得到的库存可售天数及周期。
```

### AC-F02-04 · 产品场景 AC-8

- Parent: REQ-F02-02
- Priority: P0
- EARS:

```text
WHEN 最近 7 天品退数据缺失、分母为 0 或统计期间未经校验
THE SYSTEM SHALL 不得因该品退字段触发观察或依赖低品退率的加投，并应显示“品退数据未校验”或“无可计算销量”；不依赖品退率的利润清仓/止损仍可判定。
```

### AC-F02-06 · 产品场景 AC-10

- Parent: REQ-F02-03
- Priority: P0
- EARS:

```text
WHEN 仓内库存、在途库存或最近 14 天销量缺失、不可解析、为负，或最近 14 天平均日销量为 0 
THE SYSTEM SHALL 不得生成补货/不补货判断，并应显示对应的“库存数据不足”“库存数据异常”或“无近期销售”；止损/清仓派生的禁止补货不受影响。
```

## Feature F03 · 固定规则决策

### US-F03-01 · 获得确定性经营结论

- Role: 运营主管
- Goal: 按统一规则查看商品类型、经营动作与库存动作
- Value: 用同一利润标准拍板并避免经营动作与库存协同动作冲突
- Stage: MVP
- Status: active

### REQ-F03-01 · 判定 SPU 商品类型

- Story: US-F03-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统以批次业务截止日和上架日判定新品，再按上一个完整自然月净销售额判定大爆款、小爆款或淘汰品。

### REQ-F03-02 · 判定经营主动作

- Story: US-F03-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统按商品类型、经营准利润率和最近一周品退率，用固定阈值及清仓、止损、观察、加投、维持的优先级生成唯一经营主动作。

### REQ-F03-03 · 判定补货或禁补动作

- Story: US-F03-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统仅对非新品且未触发止损或清仓的 SPU 评估补货；止损或清仓必须同步生成禁补动作。

### AC-F03-01 · 产品场景 AC-11

- Parent: REQ-F03-01
- Priority: P0
- EARS:

```text
WHEN 上架日期有效
THE SYSTEM SHALL 先按批次业务截止日判定新品：未满 2 个自然月为新品；已满 2 个自然月后才使用上一个完整自然月净销售额分层，净销售额 ≥100,000 元为大爆款、≥20,000 且 <100,000 元为小爆款、<20,000 元为淘汰商品，并只显示一个商品类型。
```

### AC-F03-02 · 产品场景 AC-12

- Parent: REQ-F03-01
- Priority: P0
- EARS:

```text
WHEN 上架日期不可解析，或非新品缺少有效上一个完整自然月净销售额
THE SYSTEM SHALL 该 SPU 应显示无法完成的分类及对应缺失原因，且不生成依赖该分类的主动作。
```

### AC-F03-03 · 产品场景 AC-13

- Parent: REQ-F03-02
- Priority: P0
- EARS:

```text
WHEN 某主动作所依赖字段有效
THE SYSTEM SHALL 按版本化固定规则显示唯一动作：新品利润率 ≥-20% 加投、<-20% 观察；大爆款利润率 <0% 清仓、0%≤利润率<5% 止损、其余条件下品退率>1.5% 观察、利润率≥10%且品退率≤1.5% 加投；小爆款利润率<5% 清仓、5%≤利润率<10% 止损、其余条件下品退率>1.5% 观察、利润率≥15%且品退率≤1.5% 加投；淘汰商品清仓；未命中时维持。
```

### AC-F03-04 · 产品场景 AC-14

- Parent: REQ-F03-02
- Priority: P0
- EARS:

```text
WHEN 同一 SPU 同时满足多个主动作条件，或同一批次使用同一规则版本重算
THE SYSTEM SHALL 按“清仓＞止损＞观察＞加投＞维持”稳定保留同一个唯一主动作，且 AI 状态不改变结果。
```

### AC-F03-05 · 产品场景 AC-15

- Parent: REQ-F03-03
- Priority: P0
- EARS:

```text
WHEN 主动作是止损或清仓，或商品类型为新品
THE SYSTEM SHALL 对止损/清仓同步形成不可被补货覆盖的“禁止补货”动作；对新品不生成补货动作。
```

### AC-F03-06 · 产品场景 AC-16

- Parent: REQ-F03-03
- Priority: P0
- EARS:

```text
WHEN 非新品主动作不是止损或清仓且库存数据有效
THE SYSTEM SHALL 库存可售天数 <30 天应形成补货动作，≥30 天应显示不补货；加投与补货可同时存在并分别进入动作执行状态。
```

## Feature F04 · AI 建议解释

### US-F04-01 · 获得基于规则的可读建议

- Role: 运营
- Goal: 快速理解每条规则结论的对象、问题、依据和动作
- Value: 缩短从发现问题到准备执行的解释成本，同时不改变固定规则结论
- Stage: MVP
- Status: active

### REQ-F04-01 · 生成四要素建议与关键依据

- Story: US-F04-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统基于结构化规则结论生成具体对象、发现问题、关键依据和推荐动作，并显示触发指标、周期、阈值和数据限制。

### REQ-F04-02 · 阻止 AI 越界改写规则

- Story: US-F04-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统舍弃 AI 生成的冲突动作、输入中不存在的数值，以及当前数据粒度不支持的广告明细、评价/差评主题、退款/退货原因归因或 SKU 结论。

### REQ-F04-03 · AI 失败不阻塞并保护网关凭据

- Story: US-F04-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: LiteLLM 不可用时系统保留结构化四要素并开放审核执行；网关密钥由运维人员通过系统级部署密钥配置，普通用户不可见。

### AC-F04-01 · 产品场景 AC-17

- Parent: REQ-F04-01
- Priority: P0
- EARS:

```text
WHEN 固定规则生成建议
THE SYSTEM SHALL 无论 AI 解释成功、等待或失败，用户可见建议都应包含具体对象、发现问题、关键依据和推荐动作四部分。
```

### AC-F04-02 · 产品场景 AC-18

- Parent: REQ-F04-01
- Priority: P0
- EARS:

```text
WHEN 建议展示关键依据
THE SYSTEM SHALL 显示用于触发动作的指标值、统计周期、阈值、比较关系和数据限制。
```

### AC-F04-03 · 产品场景 AC-19

- Parent: REQ-F04-02
- Priority: P0
- EARS:

```text
WHEN  AI 返回与固定规则冲突、输入中不存在的数值、广告明细对象、评价/差评主题、退款/退货原因归因或 SKU 结论
THE SYSTEM SHALL 舍弃越界内容并继续显示固定规则字段，不改变商品类型、主动作、补货结论和阈值。
```

### AC-F04-04 · 产品场景 AC-20

- Parent: REQ-F04-03
- Priority: P0
- EARS:

```text
WHEN  LiteLLM 等待、超时、不可用或返回失败
THE SYSTEM SHALL 立即保留可审核、可执行的固定规则清单与结构化四要素，并将 AI 解释状态显示为等待或失败。
```

## Feature F05 · 行动清单

### US-F05-01 · 按优先级处理经营问题

- Role: 运营
- Goal: 在每周清单中筛选并查看可执行建议
- Value: 把分散数据转成同一利润标准下的行动入口
- Stage: MVP
- Status: active

### REQ-F05-01 · 每批次一份清单并保留历史

- Story: US-F05-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统为每个新的有效业务批次生成且仅生成一份行动清单；后续批次不得覆盖历史清单和状态。

### REQ-F05-02 · 固定排序并提供筛选

- Story: US-F05-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 清单按固定动作优先级和稳定次序排列，并允许按动作、店铺、责任运营、审核状态和执行状态筛选。

### REQ-F05-03 · 控制行动清单收录范围

- Story: US-F05-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 只有需处理的经营动作、补货或禁补进入行动清单；纯维持且无补货或禁补的 SPU 默认不进入清单。

### REQ-F05-04 · 跨批次续接同一 SPU 动作任务

- Story: US-F05-01
- Stage: MVP
- Revision: 5
- Status: active
- Behavior: 系统必须将每周不可变决策快照与跨批次执行任务分离；同一 SPU 的新决策与当前生效动作相同时沿用原任务和状态，不重复建任；动作变化时追加待主管确认的动作版本，确认后更新当前生效动作，历史不覆盖。

### REQ-F05-05 · 展示 SPU 待办关联、生命周期时间与经营状态筛选

- Story: US-F05-01
- Stage: MVP
- Revision: 8
- Status: active
- Behavior: 系统以 SPU/商品链接为经营待办锚点；当前批次存在历史经营待办时关联最近一条前序待办，并将其作为独立的历史建议快照展示，包括该前序批次当时的主动作、关键依据、库存语境、经营状态、来源批次和生命周期时间；当前任务继续展示首次产生时间、当前经营状态、经营动作执行时间及本周关联时间，行动清单和运营待办视图支持按经营状态筛选。

### AC-F05-01 · 产品场景 AC-21

- Parent: REQ-F05-01
- Priority: P0
- EARS:

```text
WHEN 一个批次完成固定规则决策
THE SYSTEM SHALL 显示且只显示一份归属于该批次的行动清单；清单是该批次建议和动作的投影，不建立可重复生成的第二套业务身份。
```

### AC-F05-02 · 产品场景 AC-22

- Parent: REQ-F05-01
- Priority: P0
- EARS:

```text
WHEN 新数据建立新批次和新清单
THE SYSTEM SHALL 历史批次清单及其审核、动作与结果记录应继续可见且不被覆盖。
```

### AC-F05-03 · 产品场景 AC-23

- Parent: REQ-F05-02
- Priority: P0
- EARS:

```text
WHEN 授权用户选择动作、店铺、责任运营、建议审核状态或动作执行状态中的任一筛选条件
THE SYSTEM SHALL 清单应只显示匹配建议，且筛选不改变原建议内容。
```

### AC-F05-04 · 产品场景 AC-24

- Parent: REQ-F05-02
- Priority: P0
- EARS:

```text
WHEN 行动清单首次打开
THE SYSTEM SHALL 建议应先按清仓、止损、观察、加投、补货的固定层级排列；同一动作内若规则版本已明确一个可解释且数据已校验的影响代理指标，则按该代理指标降序排列并显示所用指标；未明确代理或指标缺失时，使用稳定 SPU ID 或批次内生成序号保持确定顺序，AI 只解释优先级而不改变固定层级或代理结果。
```

### AC-F05-05 · 产品场景 AC-25

- Parent: REQ-F05-03
- Priority: P0
- EARS:

```text
WHEN  SPU 的唯一主动作是维持且没有补货或禁补动作
THE SYSTEM SHALL 该 SPU 默认不应出现在行动清单；数据完整得出的“不补货”不单独生成采购执行任务。
```

### AC-F05-06 · 产品场景 AC-45

- Parent: REQ-F05-04
- Priority: P0
- EARS:

```text
WHEN 同一 SPU 上一个有效批次的当前生效经营动作为“清仓”且新批次固定规则仍判定为“清仓”
THE SYSTEM SHALL 保留原经营任务 ID、审核结果、执行状态和责任人，不新建或重置清仓任务；新批次决策快照应关联该任务并追加“同动作续接”事件。
```

### AC-F05-07 · 产品场景 AC-46

- Parent: REQ-F05-04
- Priority: P0
- EARS:

```text
WHEN 同一 SPU 上一个有效批次的当前生效经营动作为“清仓”而新批次固定规则改为“观察”
THE SYSTEM SHALL 保留上周清仓决策、任务和已执行事实，在原稳定任务上追加“观察”动作版本并置为待运营主管确认；确认后将当前生效经营动作更新为“观察”，驳回时保持原生效动作。
```

### AC-F05-08 · 产品场景 AC-47

- Parent: REQ-F05-04
- Priority: P0
- EARS:

```text
WHEN 新批次对同一 SPU 生成经营动作与库存动作
THE SYSTEM SHALL 分别比较经营轨和库存轨的当前生效动作；同动作仅续接原任务，变化动作追加新版本并按审核结果激活、关闭或替换对应任务；两轨的批次关联与历史事件必须完整保留。
```

### AC-F05-09 · 产品场景 AC-48

- Parent: REQ-F05-05
- Priority: P0
- EARS:

```text
WHEN 当前批次中的 SPU/商品链接存在历史经营待办
THE SYSTEM SHALL 在当前经营待办中显示稳定任务 ID、首次产生时间、本周关联时间、当前经营状态和经营动作执行时间，并关联按业务时间倒序得到的最近一条前序待办；该前序待办必须从其原批次不可变决策快照独立展示当时的经营主动作、关键依据（触发指标、周期、阈值、比较关系与数据限制）、库存语境（仓内、在途、最近 14 天销量、库存可售天数与库存动作）、经营状态、来源批次、产生时间和执行时间，不得以当前批次数据或状态回填；尚未执行时执行时间明确显示“—”，不得用更新时间替代。
```

### AC-F05-10 · 产品场景 AC-49

- Parent: REQ-F05-05
- Priority: P0
- EARS:

```text
WHEN 授权用户在行动清单或运营待办视图选择经营状态
THE SYSTEM SHALL 只显示当前经营动作状态匹配的 SPU 待办，并在刷新或从建议详情返回后恢复该筛选；经营状态筛选不得被建议审核状态、库存协同状态或建议总览状态替代。
```

## Feature F06 · 审核与执行跟踪

### US-F06-01 · 审核经营建议

- Role: 运营主管
- Goal: 批准或驳回完整建议并查看冲突状态
- Value: 在动作执行前形成明确拍板记录
- Stage: MVP
- Status: active

### US-F06-02 · 执行并记录动作结果

- Role: 运营
- Goal: 统一负责经营动作、库存协同、相关人员钉钉通知及结果状态闭环
- Value: 由管理 SPU 的运营承担唯一执行责任，避免外部协同状态无人跟进
- Stage: MVP
- Status: active

### REQ-F06-01 · 整体审核建议

- Story: US-F06-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 运营主管对完整建议执行一次批准或驳回；只有批准才按角色激活动作，驳回保留原始规则与备注。

### REQ-F06-02 · 由责任运营统一闭环经营与协同动作

- Story: US-F06-02
- Stage: MVP
- Revision: 7
- Status: active
- Behavior: 管理该 SPU 的运营是产品内唯一执行责任人，负责更新经营动作及补货/禁补协同状态，并通过钉钉企业内部机器人单聊通知采购、仓库等相关人员、汇总外部反馈；收件人使用其所在公司的钉钉 User ID，经营动作与库存协同动作状态独立但保持同一建议关联，外部相关人员不作为本产品直接角色。

### REQ-F06-03 · 记录结果并防止并发覆盖

- Story: US-F06-02
- Stage: MVP
- Revision: 7
- Status: active
- Behavior: 责任运营记录经营和协同动作结果，运营主管确认需要主管复核的完成事实；状态更新使用版本保护，重复或过期提交不得覆盖已成功结果。

### REQ-F06-04 · 运营主管人工改判生效动作

- Story: US-F06-01
- Stage: MVP
- Revision: 4
- Status: active
- Behavior: 运营主管可在动作尚未开始执行时，将固定规则建议人工改判为其他经营动作；改判必须填写理由、重新确认库存动作并追加审计事件，原始规则结论与冻结证据不得覆盖。已进入执行的清仓任务必须先终止原任务，不得直接改写。

### REQ-F06-05 · 确认清仓完成时间并每日钉钉催办

- Story: US-F06-02
- Stage: MVP
- Revision: 8
- Status: active
- Behavior: 清仓动作跨周保持不变时沿用原稳定任务；责任运营填报实际清仓完成时间并提交运营主管确认，主管确认后任务才闭环。在主管确认的最终清仓完成时间为空前，系统每个自然日通过钉钉企业内部机器人单聊至多通知该 SPU 责任运营一次，动作终止、变更或完成确认后停止催办。责任运营显示名只有精确对应唯一非空活跃公司 User ID 时才允许发送；映射缺失或同名对应多个不同 User ID 时失败关闭并记录可补正错误，不得按配置时间任选收件人。

### AC-F06-01 · 产品场景 AC-26

- Parent: REQ-F06-01
- Priority: P0
- EARS:

```text
WHEN 运营主管通过一条待审核建议
THE SYSTEM SHALL 保存一次建议级“已通过”结果，并同时激活该建议内已原子生成的经营动作与补货/禁补协同动作项，统一置为该 SPU 责任运营待执行；不得在审核时二次创建动作项，主动作和补货/禁补不得产生相互矛盾的审核结果。
```

### AC-F06-02 · 产品场景 AC-27

- Parent: REQ-F06-01
- Priority: P0
- EARS:

```text
WHEN 运营主管填写非空驳回备注并驳回一条待审核建议
THE SYSTEM SHALL 保存建议级“已驳回”结果和驳回备注，不激活动作执行任务，并保留原始规则、数据和动作结论；通过建议时备注可选。
```

### AC-F06-03 · 产品场景 AC-28

- Parent: REQ-F06-02
- Priority: P0
- EARS:

```text
WHEN 运营更新加投、持续观察、SPU 整体推广止损或清仓动作
THE SYSTEM SHALL 只保存该经营动作的执行状态、时间、备注和动作结果；证据不足时，观察动作不得记录超出证据的具体优化项；外部相关人员反馈由责任运营核验后录入，不直接写入产品状态。
```

### AC-F06-04 · 产品场景 AC-29

- Parent: REQ-F06-02
- Priority: P0
- EARS:

```text
WHEN 责任运营需要推进补货或禁止补货协同动作
THE SYSTEM SHALL 允许责任运营通过钉钉企业内部机器人单聊通知相关人员，收件人必须是公司钉钉 User ID，并只由责任运营保存协同动作状态、时间、备注和经其核验的结果；禁止补货可记录为“相关方已确认禁补”或等价结果，钉钉接口受理不得自动等同于送达、已读或业务状态已确认。
```

### AC-F06-05 · 产品场景 AC-30

- Parent: REQ-F06-03
- Priority: P0
- EARS:

```text
WHEN 运营记录经营动作后的销售额、利润或库存结果
THE SYSTEM SHALL 把结果周期、记录时间、记录人、可用结果值和备注关联到原建议；补货/禁补相关反馈由责任运营核验并记录，外部相关人员不获得本产品登录权限或完整经营结果字段。
```

### AC-F06-06 · 产品场景 AC-31

- Parent: REQ-F06-03
- Priority: P0
- EARS:

```text
WHEN 两个操作基于同一旧状态并发提交，或同一状态变更因网络重试重复到达
THE SYSTEM SHALL 只接受第一个合法变更，后续提交显示冲突或既有结果及最新状态，不覆盖成功变更、不新增重复事件。
```

### AC-F06-07 · 产品场景 AC-42

- Parent: REQ-F06-04
- Priority: P0
- EARS:

```text
WHEN 运营主管对尚未进入执行的建议选择新经营动作、填写非空改判理由并重新确认库存动作
THE SYSTEM SHALL 保留原固定规则动作和证据为只读，生成新的“生效动作”版本，并记录改判人、时间、修改前后经营/库存动作和理由。
```

### AC-F06-08 · 产品场景 AC-43

- Parent: REQ-F06-04
- Priority: P0
- EARS:

```text
WHEN 运营主管将“清仓”改判为“加投”
THE SYSTEM SHALL 不得静默沿用规则派生的“禁止补货”；必须要求主管根据冻结库存与销量依据明确选择补货、不补货或不生成库存协同任务，再使改判生效。
```

### AC-F06-09 · 产品场景 AC-44

- Parent: REQ-F06-04
- Priority: P0
- EARS:

```text
WHEN 原清仓经营动作或其关联禁补动作已进入执行
THE SYSTEM SHALL 禁止直接改判，显示已执行的责任人、时间和状态，并要求主管先终止原经营与库存协同任务；终止和后续改判分别追加事件，不覆盖已发生执行事实。
```

### AC-F06-10 · 产品场景 AC-50

- Parent: REQ-F06-05
- Priority: P0
- EARS:

```text
WHEN 同一 SPU 的当前生效动作持续为“清仓”且责任运营确认清仓已经完成
THE SYSTEM SHALL 允许该 SPU 责任运营填写实际清仓完成时间和备注并提交运营主管确认，记录提交人、提交时间和任务版本；不得因新周批次重复创建清仓完成确认任务。
```

### AC-F06-11 · 产品场景 AC-51

- Parent: REQ-F06-05
- Priority: P0
- EARS:

```text
WHEN 运营主管确认责任运营提交的实际清仓完成时间
THE SYSTEM SHALL 记录确认人、确认时间和最终清仓完成时间，将清仓任务置为“已确认完成”并停止后续催办；主管退回时必须填写原因，任务进入“完成时间待修正”且不丢失原提交记录。
```

### AC-F06-12 · 产品场景 AC-52

- Parent: REQ-F06-05
- Priority: P0
- EARS:

```text
WHEN 当前生效动作仍为“清仓”且最终清仓完成时间尚未获得运营主管确认
THE SYSTEM SHALL 按 Asia/Shanghai 自然日向该 SPU 责任运营发送至多一次 OA 催办，并记录消息日期、接收人、发送结果和关联任务；只有责任运营显示名精确对应唯一非空活跃公司 User ID 时才允许发送，映射缺失或同名对应多个不同 User ID 时必须失败关闭且不得任选收件人；动作改判、终止或主管确认完成后立即停止，发送失败不得伪造已送达且应保留人工补发入口。
```

## Feature F07 · 权限隔离

### US-F07-01 · 按职责查看和操作

- Role: 运营
- Goal: 与运营主管在产品内完成全部业务操作，并以最小必要 OA 消息协调其他相关人员
- Value: 保持双角色权限边界，同时避免外部协同人员直接接触完整经营数据
- Stage: MVP
- Status: active

### REQ-F07-01 · 隔离运营与审核操作

- Story: US-F07-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 运营可见完整经营信息并处理经营动作，运营主管可见审核所需完整信息并负责建议审核。

### REQ-F07-02 · 限制外部协同人员访问并裁剪 OA 消息

- Story: US-F07-01
- Stage: MVP
- Revision: 7
- Status: active
- Behavior: 采购、仓库等相关人员不是本产品直接角色，不可登录或直接更新状态；系统仅通过 OA 发送完成协同所需的最小对象、动作和联系信息，最终状态由责任运营核验后录入。

### REQ-F07-03 · 使用钉钉认证并按审批结果映射业务角色

- Story: US-F07-01
- Stage: MVP
- Revision: 11
- Status: active
- Behavior: 系统使用钉钉作为统一身份认证入口，MVP 只由本机普通浏览器的点击操作发起 OAuth，不承诺扫码登录或钉钉客户端/工作台入口；已有唯一有效运营或运营主管角色时建立对应业务会话，认证成功但没有唯一有效角色时由 F09 接管为待处理，认证失败或登录态失效时拒绝；业务角色由事业部负责人审批、唯一 Admin 配置，运维只维护身份接入与恢复部署。

### AC-F07-01 · 产品场景 AC-32

- Parent: REQ-F07-01
- Priority: P0
- EARS:

```text
WHEN 运营查看建议
THE SYSTEM SHALL 显示其权限内的销售、利润、推广、品退、库存和完整建议，并只开放经营动作与经营结果记录能力，不开放审核能力。
```

### AC-F07-02 · 产品场景 AC-33

- Parent: REQ-F07-01
- Priority: P0
- EARS:

```text
WHEN 运营主管查看建议
THE SYSTEM SHALL 显示审核所需的完整经营信息，并只在建议级待审核状态开放一次通过或驳回操作。
```

### AC-F07-03 · 产品场景 AC-34

- Parent: REQ-F07-02
- Priority: P0
- EARS:

```text
WHEN 采购、仓库或其他外部协同人员尝试登录产品、打开建议链接或直接更新动作状态
THE SYSTEM SHALL 拒绝访问且不返回建议身份、状态或经营数据；相关反馈只能由该 SPU 责任运营核验后录入，系统记录运营为状态操作者并可在备注中保留外部反馈来源。
```

### AC-F07-04 · 产品场景 AC-35

- Parent: REQ-F07-02
- Priority: P0
- EARS:

```text
WHEN 系统向外部相关人员发送钉钉协同通知
THE SYSTEM SHALL 在钉钉企业内部机器人单聊消息正文中只包含完成协同所需的 SPU 标识/商品链接、协同动作、责任运营、要求反馈内容和产品内任务引用，不包含完整利润、推广、品退、售后、规则阈值或主管审核详情；协议外层只允许钉钉要求的机器人编码、公司 User ID、消息类型和消息参数。
```

### AC-F07-05 · 产品场景 AC-40

- Parent: REQ-F07-03
- Priority: P0
- EARS:

```text
WHEN 用户通过钉钉完成统一身份认证且唯一 Admin 已按事业部负责人审批结果为其配置唯一有效业务角色
THE SYSTEM SHALL 只从本机普通浏览器的“使用钉钉登录”点击入口建立与该钉钉身份关联的登录态，显示当前业务角色，并在页面、接口、错误和历史路径统一应用该角色的读取与操作权限；页面不展示未实现的扫码入口。
```

### AC-F07-06 · 产品场景 AC-41

- Parent: REQ-F07-03
- Priority: P0
- EARS:

```text
WHEN 钉钉认证失败或登录态失效
THE SYSTEM SHALL 拒绝进入业务页且不返回任何经营数据，并提供重新发起钉钉认证的恢复指引；认证成功但没有唯一有效角色时必须转入 AC-F09-07/08 的待处理闭环，不得自动赋予默认角色或降级为共享账号、业务账号密码登录。
```

## Feature F08 · 规则与数据溯源

### US-F08-01 · 追溯结论来源

- Role: 运营主管
- Goal: 查看建议使用的数据批次、规则版本、关键值和状态历史
- Value: 复核结论并在规则或数据变化后解释差异
- Stage: MVP
- Status: active

### REQ-F08-01 · 保存决策快照

- Story: US-F08-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统为每条建议保存业务批次、业务期间、规则版本、商品类型、关键输入值和输出动作，后续数据导入不得覆盖旧快照。

### REQ-F08-02 · 保存审核与动作事件

- Story: US-F08-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统追加记录建议审核、动作状态、结果更新、越权拒绝和并发冲突事件。

### AC-F08-01 · 产品场景 AC-36

- Parent: REQ-F08-01
- Priority: P0
- EARS:

```text
WHEN 任一建议被打开
THE SYSTEM SHALL 显示其导入批次、业务截止日、数据期间、规则版本、触发规则、原始关键值和生成时间。
```

### AC-F08-02 · 产品场景 AC-37

- Parent: REQ-F08-01
- Priority: P0
- EARS:

```text
WHEN 建议进入审核、执行或结果记录阶段
THE SYSTEM SHALL 继续显示生成该建议时固化的原始规则版本、触发规则和关键值，且不被当前规则、源表变化或后续状态更新覆盖。
```

### AC-F08-03 · 产品场景 AC-38

- Parent: REQ-F08-02
- Priority: P0
- EARS:

```text
WHEN 建议审核状态或任一动作状态成功变化
THE SYSTEM SHALL 在对应层级追加显示前后状态、操作者、时间和备注。
```

### AC-F08-04 · 产品场景 AC-39

- Parent: REQ-F08-02
- Priority: P1
- EARS:

```text
WHEN 授权用户查看历史建议
THE SYSTEM SHALL 显示完整且按角色裁剪的建议审核记录、各动作记录和结果记录；已驳回、部分执行、并发冲突与 AI 失败不得删除既有成功事件。
```

## Feature F09 · Admin 管理后台与业务角色配置

### US-F09-01 · 安全初始化、登录与恢复唯一 Admin

- Role: 唯一 Admin
- Goal: 使用独立管理身份完成初始化、登录、凭据换新和两级恢复
- Value: 不依赖默认账号、共享凭据或直接修改数据库维持管理能力
- Stage: MVP
- Status: active

### US-F09-02 · 按审批结果维护唯一业务角色

- Role: 唯一 Admin
- Goal: 核验身份与审批依据并维护运营或运营主管角色
- Value: 让每次授权、变更、停用和恢复唯一、正确、立即撤销旧权限且可追溯
- Stage: MVP
- Status: active

### US-F09-03 · 获得有人承接的待处理路径

- Role: 待授权业务用户
- Goal: 在钉钉身份已确认但没有唯一角色时看到真实状态与下一步
- Value: 不再停在无人处理的登录死路，并在授权后进入正确工作台
- Stage: MVP
- Status: active

### REQ-F09-01 · 唯一 Admin 一次性初始化

- Story: US-F09-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统无 Admin 时，使用限定环境、版本和有效期的一次性 setup 材料完成唯一 Admin 创建、TOTP 实码验证和恢复码保存确认；创建、材料消费和初始化审计原子完成。

### REQ-F09-02 · 本地密码与强制动态码认证

- Story: US-F09-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: Admin 使用独立用户名、密码和 TOTP 登录；管理会话、Cookie、秘密和中间件不得被业务登录读取或转换，失败登录实施不永久锁死唯一 Admin 的渐进限速。

### REQ-F09-03 · 两级恢复与唯一 Admin 保护

- Story: US-F09-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统支持仅替代一次 TOTP 的保存型恢复码和经独立审批配置的部署恢复口令；恢复执行人只提供一次性受控交接，Admin 账号持有人本人输入且系统不回显新密码，并仅当次看到 TOTP 绑定密钥和恢复码。恢复成功后换新凭据代次、撤销旧管理会话与旧恢复材料、追加审计并写入可追踪通知 outbox；页面退出后仍可从安全设置/审计详情返回未闭环通知任务，由恢复后的 Admin 查看重试或代录恢复执行人在产品外工单产生的补偿证据引用。

### REQ-F09-04 · 无角色钉钉身份幂等进入待处理

- Story: US-F09-03
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 钉钉认证成功但没有唯一有效业务角色时，系统按身份提供方、企业作用域和稳定用户标识幂等登记同一待处理生命周期，不创建业务会话或返回经营数据，并显示责任岗位、有效联系方式和下一步。

### REQ-F09-05 · 基于身份与审批依据管理唯一角色生命周期

- Story: US-F09-02
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: Admin 仅在稳定作用域身份、至少两个可靠组织属性、事业部负责人审批依据、唯一目标角色和当前映射版本均有效时，新增、变更、停用或恢复运营/运营主管角色；角色、审批、业务会话撤销、五态投影与管理审计原子变更。产品内重复/双角色映射只能在新的有效审批下选定一个最终角色；作用域、身份源或组织属性冲突必须由运维/身份管理责任人在权威源纠正，产品仅显示责任路径并刷新投影。

### REQ-F09-06 · 管理权限隔离与不可变审计

- Story: US-F09-01
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: Admin 默认不得读取经营数据；初始化、登录安全、恢复、角色变化、拒绝操作和会话撤销追加式审计，Admin 只能查询且不能修改或删除，审计写入失败时对应高权限变化不得成功。

### REQ-F09-07 · 授权时效与价值观察

- Story: US-F09-02
- Stage: MVP
- Revision: 1
- Status: active
- Behavior: 系统记录首次启用与授权操作周期的固定服务端里程碑；只有全部生产门禁满足、七个里程碑完整且目标身份首次以正确角色业务会话进入工作台时，才能声明首次闭环是否不超过 10 分钟；首版不建设统计大屏。

### AC-F09-01 · 唯一 Admin 初始化成功

- Parent: REQ-F09-01
- Priority: P0
- EARS:

```text
WHEN 系统无 Admin 且操作者提交有效 setup 材料、合规用户名和密码、通过 TOTP 实码验证并确认保存恢复码
THE SYSTEM SHALL 仅在受保护且 `no-store` 的绑定当次向本人展示 TOTP 密钥和新恢复码，只创建一名 Admin，原子消费 setup 材料、追加初始化审计、关闭 setup 入口并引导使用新凭据正式登录；离开绑定步骤后不得重显。
```

### AC-F09-02 · 初始化重复与结果未知

- Parent: REQ-F09-01
- Priority: P0
- EARS:

```text
WHEN setup 材料无效、过期、已消费、环境不匹配，或初始化发生重复、并发、刷新、网络中断或结果未知，且同一初始化使用稳定幂等键重放
THE SYSTEM SHALL 不泄露精确材料状态且不产生半成品或第二 Admin；重放必须返回可判定的同一已提交/未提交结果，不重复创建 Admin、消费材料或追加审计。
```

### AC-F09-03 · 独立 Admin 登录

- Parent: REQ-F09-02
- Priority: P0
- EARS:

```text
WHEN 唯一 Admin 提供正确用户名、密码和 TOTP
THE SYSTEM SHALL 建立只开放管理功能的独立 Admin 登录态，且该登录态不能读取经营数据、转换为业务会话或复用业务 Cookie。
```

### AC-F09-04 · 登录失败与限速

- Parent: REQ-F09-02
- Priority: P0
- EARS:

```text
WHEN Admin 登录凭据错误、TOTP 时钟异常或连续失败达到限速条件
THE SYSTEM SHALL 返回不泄露具体凭据项的错误和可恢复冷却状态，拒绝建立管理会话且不得永久锁死唯一 Admin。
```

### AC-F09-05 · 保存型恢复码

- Parent: REQ-F09-03
- Priority: P0
- EARS:

```text
WHEN Admin 用户名和密码正确并提交未消费的保存型恢复码，随后完成新 TOTP 实码验证并以稳定幂等键提交
THE SYSTEM SHALL 仅在受保护且 `no-store` 的绑定当次向 Admin 持有人展示新 TOTP 密钥和恢复码，并在提交事务内消费旧恢复码、换新 TOTP 与恢复码、递增凭据代次、撤销旧 Admin 会话并追加审计；提交前失败时旧恢复码仍可用，网络重放返回同一已提交/未提交结果且不重复生成审计。
```

### AC-F09-06 · 部署恢复与通知双结果

- Parent: REQ-F09-03
- Priority: P0
- EARS:

```text
WHEN 正常管理凭据全部不可用，恢复执行人提供经独立审批、当前环境有效的一次性受控交接，且 Admin 持有人本人完成新密码和 TOTP 设置并以稳定幂等键提交
THE SYSTEM SHALL 仅在受保护且 `no-store` 的绑定当次向 Admin 持有人展示新 TOTP 密钥和恢复码，原子换新凭据代次、撤销旧会话、消费恢复材料、追加审计并持久化通知 outbox；网络重放返回同一已提交/未提交结果且不重复生成审计/outbox；外部投递或补偿结果独立追踪，页面退出后仍可返回未闭环任务，失败不得伪装闭环或反向回滚安全恢复。
```

### AC-F09-07 · 无唯一角色进入待处理

- Parent: REQ-F09-04
- Priority: P0
- EARS:

```text
WHEN 用户通过钉钉认证但没有唯一有效业务角色
THE SYSTEM SHALL 幂等返回同一待处理生命周期，显示申请时间、具体负责岗位、有效联系方式和下一步，不创建业务会话、不返回经营数据。
```

### AC-F09-08 · 配置后重新登录

- Parent: REQ-F09-04
- Priority: P0
- EARS:

```text
WHEN 待处理身份的角色配置事务成功
THE SYSTEM SHALL 显示已配置待重新登录、唯一目标角色、对应工作台及旧会话已失效，不允许用户改选角色，并在该身份重新通过钉钉认证后进入对应工作台。
```

### AC-F09-09 · 核验通过后原子配置唯一角色

- Parent: REQ-F09-05
- Priority: P0
- EARS:

```text
WHEN Admin 用稳定作用域身份和至少两个可靠组织属性唯一核对目标人员，并提交完整审批依据、唯一目标角色和当前映射版本
THE SYSTEM SHALL 原子保存唯一角色、审批记录、业务会话撤销、五态投影与不可变审计，并显示已配置待重新登录。
```

### AC-F09-10 · 核验失败拒绝授权

- Parent: REQ-F09-05
- Priority: P0
- EARS:

```text
WHEN 身份属性不足或冲突、企业作用域不一致、审批证据缺失或不认可、目标角色不唯一、双角色风险或映射版本冲突
THE SYSTEM SHALL 拒绝授权并保持原角色与原会话事实不变，显示冲突类型、缺失项、精确负责岗位/联系方式、所需证据和刷新/重试路径；仅产品内重复/双映射可由 Admin 使用新审批证据和当前版本原子选定一个最终角色、撤销旧会话并审计，不合并身份；作用域/身份源/组织属性冲突仅能由运维/身份管理责任人在权威源纠正，且不得按姓名、备注、首位用户或 AI 猜测角色。
```

### AC-F09-11 · 角色变更、停用与恢复

- Parent: REQ-F09-05
- Priority: P0
- EARS:

```text
WHEN Admin 使用新的有效审批依据提交角色变更、停用或恢复
THE SYSTEM SHALL 保留前值和历史，原子写入新事实、撤销旧业务会话并追加审计；停用用户进入停用页，变更或恢复用户进入已配置待重新登录。
```

### AC-F09-12 · 并发角色操作

- Parent: REQ-F09-05
- Priority: P0
- EARS:

```text
WHEN 同一作用域身份发生并发角色操作、角色变更与钉钉回调并发，或稳定幂等键的同一请求因网络中断而重放
THE SYSTEM SHALL 依据映射版本只允许一个角色事务成功，失败请求不得覆盖成功结果，业务会话只能绑定最终有效映射版本；重放必须返回同一已提交/未提交结果，不重复写入审批、映射、撤销或审计。
```

### AC-F09-13 · 管理与业务权限隔离

- Parent: REQ-F09-06
- Priority: P0
- EARS:

```text
WHEN Admin 会话访问业务接口、业务会话访问管理接口、任一方尝试身份转换，或管理写请求缺失有效 CSRF token、严格 Origin 或预期 Content-Type
THE SYSTEM SHALL 拒绝请求且不返回对方域数据、不执行任何写入；同一自然人同时持有两类登录态时也必须分别鉴权。
```

### AC-F09-14 · 不可变管理审计

- Parent: REQ-F09-06
- Priority: P0
- EARS:

```text
WHEN 初始化、登录限速、恢复、授权变化、拒绝操作或会话撤销发生
THE SYSTEM SHALL 追加不含原始秘密的管理审计；Admin 只能查询且不能修改或删除，需审计的高权限事务在审计失败时不得成功，运行时数据库身份对管理审计表不得拥有 UPDATE、DELETE 或 DDL 权限。
```

### AC-F09-15 · 完整门禁与 10 分钟闭环

- Parent: REQ-F09-07
- Priority: P0
- EARS:

```text
WHEN F09 第一版生产门禁全部满足并开始首次启用闭环
THE SYSTEM SHALL 记录唯一 Admin 初始化开始、Admin 创建成功、首次正式登录、待处理申请、配置开始、角色配置成功、正确工作台首次访问七个服务端里程碑；首尾不超过 10 分钟时才显示达成，任一节点缺失时不得填 0 或宣称通过。
```

## Non-functional requirements

### NFR-001 · 固定规则确定性

- Applies-to: REQ-F02-01、REQ-F02-02、REQ-F02-03、REQ-F03-01、REQ-F03-02、REQ-F03-03
- Revision: 1
- Status: active
- Measure: 同一有效数据快照与同一规则版本被重复处理时，商品类型、经营主动作和库存动作逐项一致。

### NFR-002 · 双角色权限与 OA 最小可见

- Applies-to: REQ-F05-02、REQ-F07-01、REQ-F07-02、REQ-F07-03
- Revision: 2
- Status: active
- Measure: 产品业务接口只接受运营或运营主管角色；外部相关人员无法读取产品页面或接口，OA 消息仅包含协同所需的 SPU、动作、责任运营和反馈要求，不含完整利润、推广、品退、售后、规则阈值或审核详情。

### NFR-003 · 凭据保密

- Applies-to: REQ-F04-03、REQ-F07-02
- Revision: 1
- Status: active
- Measure: 页面、接口响应、业务日志和错误详情均不得返回 LiteLLM 部署密钥明文或可恢复内容，普通用户无查看入口。

### NFR-004 · AI 失败可降级

- Applies-to: REQ-F04-01、REQ-F04-02、REQ-F04-03
- Revision: 1
- Status: active
- Measure: LiteLLM 网关不可用时，同一处理尝试仍产出固定规则结论和结构化依据，且审核与执行入口可用。

### NFR-005 · 审计可追溯

- Applies-to: REQ-F01-01、REQ-F05-01、REQ-F05-04、REQ-F05-05、REQ-F06-01、REQ-F06-02、REQ-F06-03、REQ-F06-04、REQ-F06-05、REQ-F08-01、REQ-F08-02
- Revision: 1
- Status: active
- Measure: 每条决策及每次状态事件均包含关联批次、业务期间、规则或对象版本、关键值或状态变化、操作者与时间；历史事件不可被状态更新覆盖。

### NFR-006 · 管理身份与业务身份隔离

- Applies-to: REQ-F09-02、REQ-F09-06
- Revision: 1
- Status: active
- Measure: Admin 与业务身份使用独立入口、凭据、Cookie、会话、秘密和中间件；两类会话互访均被拒绝且不返回对方域数据；所有管理写接口同时校验 Admin 会话、CSRF token、严格 Origin 与预期 Content-Type。

### NFR-007 · 管理凭据与恢复材料保护

- Applies-to: REQ-F09-01、REQ-F09-02、REQ-F09-03
- Revision: 1
- Status: active
- Measure: 密码、setup/recovery 原始材料和完整令牌永不回显；TOTP 绑定密钥/二维码与新恢复码仅允许在初始化或恢复的受保护绑定当次，通过 `no-store` 响应向当前 Admin 持有人单次展示。上述秘密均不进入 URL、前端包/持久化/缓存、后续或通用响应、日志、审计、镜像、仓库或通用默认值；一次性材料按环境和凭据代次失效。

### NFR-008 · 不可变管理审计

- Applies-to: REQ-F09-01、REQ-F09-02、REQ-F09-03、REQ-F09-05、REQ-F09-06
- Revision: 1
- Status: active
- Measure: 所有需审计的高权限领域变化均能与唯一追加审计事件勾稽；Admin 无更新或删除能力，运行时数据库身份对管理审计表无 UPDATE、DELETE 或 DDL 权限，审计失败时变化不成功。

### NFR-009 · 授权正确性与撤销及时性

- Applies-to: REQ-F09-03、REQ-F09-04、REQ-F09-05、REQ-F09-07
- Revision: 1
- Status: active
- Measure: 双角色、作用域冲突、身份属性不足、证据缺失和版本冲突均不会形成成功授权；角色或凭据变化后旧会话不可用且标记撤销，经确认的错人或错角色事件为 0。

### NFR-010 · 开发与线上物理隔离

- Applies-to: REQ-F09-01、REQ-F09-02、REQ-F09-03、REQ-F09-06
- Revision: 1
- Status: active
- Measure: 开发和线上使用不同配置源、秘密、基础设施及启动/运维入口，不通过线上部署栈选择性启动开发依赖。
