# Operations

Use this reference after intent and executor are chosen.

## Creation

1. Read live projects/lists first.
2. Inspect candidate groups/columns/sections before placement.
3. Route by explicit live list/group name when it exists and does not conflict with content.
4. Otherwise route by prefix, cleaned content, and current inventory semantics.
5. Search similar incomplete tasks when duplication or supplementation is likely.
6. If there is no suitable destination, create in Inbox/收集箱 and report `未分组`.

Do not create, delete, rename, merge, or reorganize lists/projects without explicit confirmation. Do not place a task into an arbitrary `未分类`, root, miscellaneous, or unrelated group just because no better group was found.

## Parent, Subtask, And Multiple Task Classification

Before creating tasks, decide whether the input is:

- one task;
- multiple independent tasks;
- one parent task with child subtasks/checklist items.

Use right-side subtasks/checklists when one item is a broader deliverable and the other user-provided items are components, phases, materials, checks, or outputs of it. Create multiple independent tasks when items are unrelated outcomes, even if they appear in one message.

Do not infer subtasks from your own plan if the user provided only one task. Do not duplicate child tasks as separate left-list tasks unless the user asks for both. If existing standalone tasks look like children of a parent, report the relationship and ask before deleting, bulk completing, hiding, or merging originals.

## Supplements

Treat a message as a supplement only when the target is clear:

1. most recent DIDA task created/updated in the current conversation;
2. explicit task title/topic in the supplement;
3. a single high-confidence matching incomplete task from DIDA search.

If no target is clear, ask which task to supplement.

When supplementing:

- append cleaned content under `【补充】`, or merge naturally when cleaner;
- remove supplement control words such as `补充`, `再补充一下`, `加上`;
- preserve chronological order for multiple supplements;
- do not use `【补充输入】`.

## Duplicates And Updates

Check duplicates when the request resembles recent or incomplete tasks.

- Exact duplicate incomplete task: do not create another. Update only if the user supplied new date, priority, link, or detail.
- Near duplicate with same intent: prefer updating or supplementing when confidence is high.
- Similar but distinct task: create a new task, possibly using the related task's placement context.
- Ambiguous merge risk: ask before merging, completing, deleting, or overwriting.

Directly update title, due date, reminder, priority, detail, list, group/column, tags, or subtasks when the target is clear and the change preserves task intent. Ask before updates that change core intent, overwrite substantial detail, merge tasks, delete content, or affect multiple objects.

## Query And Planning

For `今天有什么任务`, `逾期`, `最近重要任务`, `帮我安排今天`, or similar:

1. read overdue tasks;
2. read today's tasks;
3. read high-priority tasks;
4. read near-upcoming tasks, usually next 7 days, if planning benefits;
5. inspect Inbox/收集箱 only when cleanup/planning requires it.

Present results in Chinese with practical order, for example `先做`, `随后`, `可延后`, `需要确认`. Do not modify tasks during query/planning unless the user explicitly asks.

## Complete, Delete, Move, Organize

Complete a task directly only when the target is clear. If multiple similar incomplete tasks match, ask which one. Do not bulk-complete unless the user clearly requested exactly that set.

Always confirm deletion. Never proactively delete a list/project. Trash, task deletion, subtask deletion, bulk completion, bulk archiving, hiding originals, and destructive merges require explicit confirmation.

For organize/deduplicate/restructure requests:

1. inspect relevant live tasks and lists;
2. propose concise changes for broad or destructive edits;
3. execute only low-risk moves/renames that clearly preserve intent;
4. ask before destructive merges, deletions, or broad status changes.

## Link Handling

When a task contains URLs:

1. Try to read linked content with available browser/connector/research tools.
2. Summarize readable content under `【链接详情】`.
3. Keep original URLs under `【参考链接】`.
4. If blocked by login, paywall, access limits, timeout, unsupported file type, or repeated failure, stop quickly and record the reason.
5. Do not bypass protections and do not paste full copyrighted articles into a task.

## Reply Contract

After create/update/complete/delete actions, reply briefly in Chinese. Include applicable fields:

```text
已添加/已更新/已完成/已删除：<标题或对象>
清单：<list/project>
分组/列：<group/column or 无/未分组>
截止/提醒：<date/time or 未设置>
优先级：<高/中/低/未设置>
详情：<已保存 / 已补充 / 已整理链接详情 / 敏感信息已脱敏 / 无详情>
结构：<单任务 / 多个独立任务 / 父任务+子任务>
执行器：<CLI / MCP>
```

If Inbox/收集箱 was used because no suitable group/column or similar context was found, include `未分组`. If a duplicate was avoided, say so clearly. If a link could not be read, include the reason. If cleanup partially failed, list leftover temporary IDs and do not claim the environment was restored.
