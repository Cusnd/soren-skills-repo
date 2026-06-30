# Intent Routing

Use this reference when deciding whether a user message should become a Dida365/TickTick operation, how to clean it, and how to infer placement, dates, priority, and detail content.

## Trigger Detection

Treat the message as DIDA intent when it clearly asks to create, update, query, complete, organize, deduplicate, schedule, or enrich tasks.

Strong creation markers:

- `todo`, `待办`, `记一下`, `添加任务`, `提醒我`, `写进滴答`, `安排一下`, `帮我记一下`, `列个任务`
- Prefix forms: `研究任务todo`, `工作任务todo`, `工具todo`, `灵感todo`, `生活用品todo`, `电子产品todo`, `吉利学院todo`, `极为重要todo`
- Reminder forms: `明天提醒我...`, `今晚记得...`, `下周五之前...`, `到时候提醒我...`

Supplement/update markers:

- `再补充一下`, `补充`, `加上`, `顺便加`, `另外还有`, `把...也放进去`, `刚才那个任务再加...`
- These are supplements only when the target task is clear from the current conversation, explicit title/topic, or a single high-confidence DIDA match.

Operation markers:

- Query: `今天有什么任务`, `逾期任务`, `最近重要任务`, `帮我安排今天`, `看看我的待办`
- Update: `把...改成...`, `延期到...`, `移到...`, `优先级调高`, `加个提醒`
- Completion: `完成...`, `把...标记完成`, `...做完了`
- Organization: `整理一下`, `去重`, `合并`, `拆成子任务`, `归类`, `清理收集箱`

Do not create or mutate a task when `todo` appears only inside a URL, code block, quoted text, filename, article title, commit message, or copied source text; or when the user is only brainstorming or asking advice without a save/reminder/task command.

## Cleaning Rules

Before writing a task title or detail, derive `clean_original_content` from the user message.

Remove only leading routing/control text whose purpose is intent, category, priority, list selection, or reminder control:

- Generic controls: `todo`, `待办`, `任务`, `记一下`, `添加任务`, `提醒我`, `写进滴答`, `安排一下`, `帮我记一下`
- Routing prefixes: `研究任务todo`, `工作任务todo`, `工具todo`, `灵感todo`, `生活用品todo`, `电子产品todo`, `吉利学院todo`, `极为重要todo`
- Immediate separators after controls: `:`, `：`, `-`, `—`, `|`, newline, and extra spaces

Keep meaningful formatting, links, commands, pasted requirements, examples, and constraints. Do not wrap saved details with `【原始输入】`, `【原文】`, `原始输入：`, or similar labels unless the user explicitly asks for verbatim saving. Do not save routing prefixes in details. Use `【补充】` for real supplements; do not use `【补充输入】`.

Examples:

| User message | Saved detail |
|---|---|
| `工作任务todo：明天跟李雷确认合同` | `明天跟李雷确认合同` |
| `todo\n买牛奶和鸡蛋` | `买牛奶和鸡蛋` |
| `研究任务 todo 阅读这篇论文：https://...` | `阅读这篇论文：https://...` |
| `把标题写成「TODO parser 设计」` | Keep `TODO parser 设计`; here `TODO` is meaningful content. |

## Prefix Routing Hints

Prefixes are internal routing hints. Read live inventory first and match against current list/group/column names. Never hard-code historical Soren list names.

| Prefix / marker | Internal meaning |
|---|---|
| `吉利学院todo` | Prefer live school/course/assignment/exam/report/project destinations. Match content such as courses, slides, experiments, embedded systems, STM32, graduation work, reports, and exams. |
| `工作任务todo`, `工作 todo` | Prefer live work/professional/operations/follow-up/deliverable destinations. |
| `工具todo` | Prefer live engineering/tools/infrastructure/programming/automation/technical-system destinations. If it is an article/tutorial to read, consider live knowledge-intake destinations. |
| `研究任务todo`, `研究任务 todo` | Prefer live academic/research/paper destinations for formal research; live knowledge-intake for reading/digesting; exploration/idea destinations for open-ended curiosity. |
| `灵感todo` | Prefer live ideas/exploration/creative backlog destinations; wishlist destinations for future wants; publishing/sharing destinations for public ideas. |
| `生活用品todo` | Prefer live shopping/supplies destinations for buying; live life/admin destinations for chores, errands, or logistics. |
| `电子产品todo` | Prefer live shopping/product-comparison destinations for buying/comparing; live engineering/technical destinations for building, configuring, repairing, or debugging devices. |
| `极为重要todo`, `重要todo`, `紧急todo` | Treat as priority/urgency, not placement. Route by content. |

When prefix and content conflict, choose the content-matching live destination and briefly mention the reason.

## Title And Details

Infer titles from `clean_original_content`, not raw routing markers. Use short, concrete, executable Chinese titles, usually 8-28 Chinese characters:

- `动词 + 对象`
- `完成 + 产出物`
- `整理/检查/联系/购买/修复/研究/阅读/提交 + 对象`
- `为...准备...`

Avoid vague titles such as `处理一下`, `看看这个`, `重要任务`, unless the cleaned content itself is that vague and cannot be clarified without asking.

Start task details with `clean_original_content` as plain text. Add sections only when they add value:

```text
清洗后的用户正文

【链接详情】
可读取链接的摘要、关键点、相关结论。

【AI 整理】
背景、目标、路径、注意点、预期产出。

【完成标准】
...

【下一步】
一个最小可行动作。

【参考链接】
https://example.com/a
```

Redact passwords, API keys, tokens, private keys, ID numbers, bank cards, and highly sensitive personal data before saving. Mention redaction if it changes the detail.

## Dates, Reminders, Recurrence, Priority, Tags

Parse relative dates from the real current date in `Asia/Shanghai` unless the user specifies another timezone.

- Explicit date/time wins.
- Date-only phrasing without reminder wording means due date only.
- Reminder wording with no explicit time uses defaults.
- `明天提醒我` / `明早提醒我` / `上午提醒我`: 09:00.
- `中午提醒我`: 12:00.
- `下午提醒我`: 15:00.
- `今晚提醒我` / `晚上提醒我`: 20:00.
- `睡前提醒我`: 23:00.
- `有空提醒我` or similarly vague time: create without reminder if the task is clear, and mention that no exact reminder time was set.

If recurrence is explicit (`每天`, `每周五`, `每月1号`, `每年`), use recurrence when the executor supports it. Otherwise create the first due date and record recurrence request in details.

Priority:

- Explicit priority wins.
- High: today/tomorrow must-do, overdue, exams, meetings, medical, bills, outages, urgent work blockers, hard deadlines, `极为重要`, `紧急`, `必须`.
- Medium: due within a week, project-impacting work, important school/work deliverables, or clear external consequences.
- Low: saved reading, ideas, optional research, wishlists, someday/maybe items.

Tags:

- Add 2-4 compact retrieval-oriented tags only when useful.
- Prefer existing standard tags if exposed by tools.
- Do not create many one-off tags for a single task.
