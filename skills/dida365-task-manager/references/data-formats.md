# DIDA Data Formats

Use this reference when constructing JSON-shaped CLI options or interpreting `--json` output.

## Dates And Time Zones

- Prefer explicit timezone offsets: `2026-06-30T09:00:00+0800`.
- Use `Asia/Shanghai` as the default timezone unless the user specifies another value.
- Habit stamps use integers in `YYYYMMDD`, for example `20260630`.
- Focus list ranges are limited by the API/CLI guidance to a maximum of 30 days.

## Task

Common task fields:

| Field | Meaning | CLI option |
| --- | --- | --- |
| `id` | Task id | `task update <taskId>` and `--id` |
| `projectId` | Project/list id | `--project` |
| `title` | Short task title | `--title` |
| `content` | Task/note body | `--content` |
| `desc` | Checklist task description | `--desc` |
| `startDate`, `dueDate` | Start and due time | `--start-date`, `--due-date` |
| `timeZone` | Timezone | `--time-zone` |
| `isAllDay` | All-day flag | `--all-day` |
| `priority` | Priority code | `--priority` |
| `reminders` | Reminder trigger strings | `--reminders` comma list |
| `repeatFlag` | Repeat rule | `--repeat` |
| `items` | Checklist items | `--items` JSON or comma list |
| `tags` | Tag names | `--tags` comma list |
| `parentId` | Parent task id | `--parent-id`; `null`/`none` clears |
| `focusSummaries` | Focus estimates and summary | `--estimated-duration`, `--estimated-pomo` |
| `status` | Completion state | Read/filter |
| `kind` | Task type such as `TASK`, `NOTE`, `CHECKLIST` | Read |

Priority codes:

| Code | Meaning |
| --- | --- |
| `0` | None |
| `1` | Low |
| `3` | Medium |
| `5` | High |

Task status codes:

| Code | Meaning |
| --- | --- |
| `0` | Incomplete |
| `2` | Completed |
| `-1` | Abandoned, when present in API data |

Checklist item fields:

| Field | Meaning |
| --- | --- |
| `id` | Checklist item id |
| `title` | Item text |
| `status` | `0` incomplete, `1` complete |
| `sortOrder` | Item order |
| `startDate`, `isAllDay`, `timeZone`, `completedTime` | Optional scheduling/completion fields |

Focus estimate fields inside `focusSummaries`:

| Field | Meaning |
| --- | --- |
| `estimatedDuration` | Estimated focus seconds |
| `estimatedPomo` | Estimated pomodoros, 0-60 |
| `pomoCount`, `pomoDuration`, `stopwatchDuration` | Read-only actual summary values |

## Reminders

Reminder strings follow this pattern:

```text
TRIGGER(;RELATED=START|END)?:(-)?P[nY][nM][nW][nD][T[nH][nM][nS]]
```

Examples:

| String | Meaning |
| --- | --- |
| `TRIGGER:-PT60M` | 60 minutes before the reference time |
| `TRIGGER:-P1DT2H` | 1 day and 2 hours before |
| `TRIGGER;RELATED=END:-PT15M` | 15 minutes before end time |
| `TRIGGER:PT0S` | At the reference time |

## Repeats

Use one repeat rule string in `repeatFlag` or habit `repeatRule`:

- `RRULE:FREQ=DAILY`
- `RRULE:FREQ=WEEKLY;BYDAY=MO,WE`
- `ERULE:NAME=CUSTOM;BYDATE=20260325,20260330`

Do not mix `RRULE` and `ERULE` in the same value.

## Project

Project/list fields:

| Field | Meaning |
| --- | --- |
| `id` | Project/list id |
| `name` | Display name |
| `color` | Hex color |
| `sortOrder` | Sidebar order |
| `closed` | Archived/closed flag |
| `groupId` | Folder/group id |
| `viewMode` | `list`, `kanban`, or `timeline` |
| `permission` | `read`, `comment`, or `write` |
| `kind` | `TASK` or `NOTE` |

`project data --json` returns:

| Field | Meaning |
| --- | --- |
| `project` | Project object |
| `tasks` | Incomplete tasks in that project |
| `columns` | Kanban columns/groups |

Column fields are `id`, `projectId`, `name`, and optional `sortOrder`.

## Tags

Tag fields are:

| Field | Meaning |
| --- | --- |
| `name` | Stable tag id/name, usually lowercase |
| `label` | Display label |
| `sortOrder` | Order |
| `color` | Optional color |
| `parent` | Parent tag |
| `type` | Tag type code |

## Habits

Habit fields include `id`, `name`, `iconRes`, `color`, `sortOrder`, `status`, `encouragement`, `totalCheckIns`, `createdTime`, `modifiedTime`, `archivedTime`, `type`, `goal`, `step`, `unit`, `etag`, `repeatRule`, `reminders`, `recordEnable`, `sectionId`, `targetDays`, `targetStartDate`, `completedCycles`, `exDates`, and `style`.

Habit checkin input:

| Field | Meaning |
| --- | --- |
| `stamp` | Required `YYYYMMDD` integer |
| `time` | Checkin time |
| `opTime` | Operation time |
| `value` | Actual value |
| `goal` | Goal for this checkin |
| `status` | Status code |

`habit checkins --json` returns aggregate rows with `habitId`, optional `year`, and `checkins`.

## Focus

Focus type values:

| CLI values | API value | Meaning |
| --- | --- | --- |
| `0`, `pomodoro`, `p` | `0` | Pomodoro |
| `1`, `timing`, `t` | `1` | Stopwatch/timing |

Focus fields include `id`, `userId`, `type`, `taskId`, `note`, `tasks`, `status`, `startTime`, `endTime`, `pauseDuration`, `adjustTime`, `added`, `createdTime`, `modifiedTime`, `etimestamp`, `etag`, `duration`, and `relationType`.

## Countdown

Countdown fields include `id`, `type`, `iconRes`, `color`, `name`, `date`, `ignoreYear`, `showCalendarType`, `reminders`, `annoyingAlert`, `repeatFlag`, `remark`, `status`, `sortOrder`, `style`, `styleColor`, `dateDisplayFormat`, `timerMode`, `showAge`, `daysOption`, `showRemark`, `createdTime`, and `modifiedTime`.
