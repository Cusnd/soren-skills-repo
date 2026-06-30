# DIDA CLI Commands

Use this reference when exact command names, options, or API mapping matter. Prefer adding `--json` on read and create/update commands that support it.

## Auth

| Command | Purpose | Notes |
| --- | --- | --- |
| `dida auth login` | Browser OAuth login with PKCE | Opens browser, listens on `localhost:8766/callback`, saves token locally. |
| `dida auth token <token>` | Save an access token directly | Use only with explicit user approval. |
| `dida auth status` | Show saved-token status | Human output may include a masked token fragment. Do not echo it unnecessarily. |
| `dida auth logout` | Clear local token | Write/destructive for auth state; confirm if user did not directly ask. |

The CLI stores auth at `~/.config/dida-cli/config.json` under `access_token`.

## Tasks

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida task get <projectId> <taskId>` | Get one task | `--json` |
| `dida task create` | Create a task | `--title`, `--project`, `--content`, `--desc`, `--all-day`, `--start-date`, `--due-date`, `--time-zone`, `--reminders`, `--repeat`, `--priority`, `--sort-order`, `--items`, `--tags`, `--json` |
| `dida task update <taskId>` | Update a task | Required: `--id`, `--project`; optional: task create options plus `--parent-id`, `--estimated-duration`, `--estimated-pomo`, `--json` |
| `dida task complete <projectId> <taskId>` | Complete a task | No `--json` |
| `dida task delete <projectId> <taskId>` | Delete a task | Destructive; confirm exact IDs. |
| `dida task move` | Move tasks between projects | Repeated triplets: `--from <projectId...>`, `--to <projectId...>`, `--task <taskId...>`, plus `--json` |
| `dida task completed` | List completed tasks | `--projects`, `--start-date`, `--end-date`, `--json` |
| `dida task filter` | Filter tasks | `--projects`, `--start-date`, `--end-date`, `--priority`, `--tag`, `--status`, `--json` |

Task examples:

```powershell
dida task filter --projects <projectId> --status 0 --json
dida task create --title "Buy milk" --project <projectId> --priority 3 --tags errands --json
dida task update <taskId> --id <taskId> --project <projectId> --parent-id null --json
dida task move --from <sourceProjectId> --to <destProjectId> --task <taskId> --json
```

`--items` accepts either a JSON array or comma-separated titles:

```powershell
dida task create --title "Trip prep" --project <projectId> --items "Book hotel,Pack charger" --json
dida task create --title "Checklist" --project <projectId> --items '[{"title":"A","status":0},{"title":"B","status":0}]' --json
```

## Task Comments

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida task comment list <projectId> <taskId>` | List comments | `--json` |
| `dida task comment add <projectId> <taskId>` | Add comment | `--title`, `--json` |
| `dida task comment delete <projectId> <taskId> <commentId>` | Delete comment | Destructive; confirm exact IDs. |

## Projects, Groups, And Columns

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida project list` | List projects/lists | `--json` |
| `dida project get <projectId>` | Get one project | `--json` |
| `dida project data <projectId>` | Get project, tasks, and columns | `--json` |
| `dida project create` | Create project/list | `--name`, `--color`, `--sort-order`, `--view-mode`, `--kind`, `--json` |
| `dida project update <projectId>` | Update project/list | Same optional fields as create, plus `--json` |
| `dida project delete <projectId>` | Delete project/list | Destructive; confirm. |
| `dida project group list` | List project groups/folders | `--json` |
| `dida project group create` | Create project group | `--name`, `--json` |
| `dida project group update <groupId>` | Update group | `--name`, `--json` |
| `dida project group delete <groupId>` | Delete group | Destructive; confirm. |
| `dida project column list <projectId>` | List Kanban columns | `--json` |
| `dida project column create <projectId>` | Create column | `--name`, `--json` |
| `dida project column update <projectId> <columnId>` | Update column | `--name`, `--json` |

Project values:

- `--view-mode`: `list`, `kanban`, or `timeline`
- `--kind`: `TASK` or `NOTE`
- `--color`: hex color such as `#F18181`

## Tags

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida tag list` | List tags | `--json` |
| `dida tag create` | Create tag | Required `--name`, `--label`, optional `--json` |

Use lowercase, stable `--name` values. `--label` is the display label.

## Habits

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida habit get <habitId>` | Get one habit | `--json` |
| `dida habit list` | List habits | `--json` |
| `dida habit create` | Create habit | `--name`, `--icon-res`, `--color`, `--sort-order`, `--status`, `--encouragement`, `--type`, `--goal`, `--step`, `--unit`, `--repeat`, `--reminders`, `--section-id`, `--style`, `--json` |
| `dida habit update <habitId>` | Update habit | Same optional fields as create, plus `--json` |
| `dida habit checkin <habitId>` | Create/update checkin | Required `--stamp`; optional `--time`, `--op-time`, `--value`, `--goal`, `--status`, `--json` |
| `dida habit checkins` | Query checkins | Required `--habits`, `--from`, `--to`, optional `--json` |

Habit examples:

```powershell
dida habit create --name "Drink water" --repeat "RRULE:FREQ=DAILY;INTERVAL=1" --goal 8 --unit cups --json
dida habit checkin <habitId> --stamp 20260630 --value 1 --goal 1 --json
dida habit checkins --habits <habitId> --from 20260601 --to 20260630 --json
```

## Focus

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida focus get <focusId>` | Get focus record | Required `--type`; optional `--json` |
| `dida focus list` | List focus records, max 30 days | Required `--from`, `--to`, `--type`; optional `--json` |
| `dida focus create` | Create focus record | Required `--type`; optional `--task-id`, `--note`, `--start-time`, `--end-time`, `--pause-duration`, `--duration`, `--relation-type`, `--json` |
| `dida focus delete <focusId>` | Delete focus record | Required `--type`; optional `--json` |

`--type` accepts `0`, `pomodoro`, `p`, `1`, `timing`, or `t`.

```powershell
dida focus list --from "2026-06-01T00:00:00+0800" --to "2026-06-30T23:59:59+0800" --type pomodoro --json
dida focus create --type pomodoro --task-id <taskId> --start-time "2026-06-30T09:00:00+0800" --end-time "2026-06-30T09:25:00+0800" --duration 1500 --json
```

## Countdown

| Command | Purpose | Main options |
| --- | --- | --- |
| `dida countdown list` | List countdowns | `--json` |

## Endpoint Mapping

| Command | Endpoint |
| --- | --- |
| `task get` | `GET /open/v1/project/{projectId}/task/{taskId}` |
| `task create` | `POST /open/v1/task` |
| `task update` | `POST /open/v1/task/{taskId}` |
| `task complete` | `POST /open/v1/project/{projectId}/task/{taskId}/complete` |
| `task delete` | `DELETE /open/v1/project/{projectId}/task/{taskId}` |
| `task move` | `POST /open/v1/task/move` |
| `task completed` | `POST /open/v1/task/completed` |
| `task filter` | `POST /open/v1/task/filter` |
| `task comment list` | `GET /open/v1/project/{projectId}/task/{taskId}/comments` |
| `task comment add` | `POST /open/v1/project/{projectId}/task/{taskId}/comment` |
| `task comment delete` | `DELETE /open/v1/project/{projectId}/task/{taskId}/comment/{id}` |
| `project list` | `GET /open/v1/project` |
| `project get` | `GET /open/v1/project/{projectId}` |
| `project data` | `GET /open/v1/project/{projectId}/data` |
| `project create` | `POST /open/v1/project` |
| `project update` | `POST /open/v1/project/{projectId}` |
| `project delete` | `DELETE /open/v1/project/{projectId}` |
| `project group list` | `GET /open/v1/project/group` |
| `project group create` | `POST /open/v1/project/group` |
| `project group update` | `POST /open/v1/project/group/{projectGroupId}` |
| `project group delete` | `DELETE /open/v1/project/group/{projectGroupId}` |
| `project column list` | `GET /open/v1/project/{projectId}/column` |
| `project column create` | `POST /open/v1/project/{projectId}/column` |
| `project column update` | `POST /open/v1/project/{projectId}/column/{columnId}` |
| `tag list` | `GET /open/v1/tag` |
| `tag create` | `POST /open/v1/tag` |
| `habit get` | `GET /open/v1/habit/{habitId}` |
| `habit list` | `GET /open/v1/habit` |
| `habit create` | `POST /open/v1/habit` |
| `habit update` | `POST /open/v1/habit/{habitId}` |
| `habit checkin` | `POST /open/v1/habit/{habitId}/checkin` |
| `habit checkins` | `GET /open/v1/habit/checkins` |
| `focus get` | `GET /open/v1/focus/{focusId}?type=` |
| `focus list` | `GET /open/v1/focus?from=&to=&type=` |
| `focus create` | `POST /open/v1/focus` |
| `focus delete` | `DELETE /open/v1/focus/{focusId}?type=` |
| `countdown list` | `GET /open/v1/countdown` |
