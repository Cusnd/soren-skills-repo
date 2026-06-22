# AutoDL API Reference

Source docs checked on 2026-06-22:

- General API: https://www.autodl.com/docs/common_api/
- Container Instance Pro API: https://www.autodl.com/docs/instance_pro_api/
- Elastic Deployment API: https://www.autodl.com/docs/esd_api_doc/

Base host:

```text
https://api.autodl.com
```

Authentication:

```python
headers = {
    "Authorization": os.environ["AUTODL_TOKEN"],
    "Content-Type": "application/json",
}
```

Common response shape:

```json
{
  "code": "Success",
  "msg": "",
  "data": {}
}
```

Important conventions:

- Money-like integer fields are commonly yuan * 1000.
- `cuda_v_from` / `cuda_v_to` use integer CUDA versions such as `118` for CUDA 11.8.
- Token location: AutoDL console -> account/settings -> developer token.
- Pro API requires personal real-name verification or enterprise verification.
- Elastic Deployment API requires enterprise verification.

## General API

| Purpose | Method | Path | Notes |
| --- | --- | --- | --- |
| Get account balance | `POST` | `/api/v1/dev/wallet/balance` | No body. Returns `assets`, `accumulate`, `voucher_balance`; divide by 1000 for yuan. |
| Switch dedicated NFS / file storage | `POST` | `/api/v1/dev/exclusive_nfs/mount` | Body: `data_center`, `mountable`. Use `1` for dedicated NFS, `-1` for normal file storage. |

## Container Instance Pro API

Use this family for single-instance GPU machine lifecycle automation.

| Purpose | Method | Path | Main Parameters |
| --- | --- | --- | --- |
| Create instance | `POST` | `/api/v1/dev/instance/pro/create` | Required: `req_gpu_amount`, `expand_system_disk_by_gb`, `gpu_spec_uuid`, `image_uuid`, `cuda_v_from`. Optional: `data_center_list`, `instance_name`, `start_command`. |
| Get instance details | `GET` | `/api/v1/dev/instance/pro/snapshot` | `instance_uuid`. Returns SSH/Jupyter/service connection info and resource usage. |
| Get instance status | `GET` | `/api/v1/dev/instance/pro/status` | `instance_uuid`. Example: `running`. |
| List instances | `POST` | `/api/v1/dev/instance/pro/list` | `page_index`, `page_size`. |
| Power on instance | `POST` | `/api/v1/dev/instance/pro/power_on` | `instance_uuid`, `payload: "gpu"`, optional `start_command`. |
| Power off instance | `POST` | `/api/v1/dev/instance/pro/power_off` | `instance_uuid`. |
| Release instance | `POST` | `/api/v1/dev/instance/pro/release` | `instance_uuid`. Power off before release according to official docs. |
| Save image | `POST` | `/api/v1/dev/instance/pro/image/save` | `instance_uuid`, `image_name`. Returns `image_uuid`. |
| List private images | `POST` | `/api/v1/dev/instance/pro/image/private/list` | `page_index`, `page_size`. |

Creation constraints:

- `req_gpu_amount`: min `1`, max `4`.
- `expand_system_disk_by_gb`: `0` to `500`.
- `cuda_v_from`: lower bound, for example `113` means CUDA >= 11.3.
- API-created Pro instances are documented as pay-as-you-go by default.

Connection info:

- Pro snapshot can return SSH command, proxy host, root password, SSH port, Jupyter token/domain, and 6006/6008 service domains.
- Avoid printing credentials unless the user explicitly needs them and the output is private.

## Elastic Deployment API

Use this family for scheduled GPU containers, batch jobs, replicated services, scaling, events, and stock checks.

| Purpose | Method | Path | Main Parameters |
| --- | --- | --- | --- |
| List private images | `POST` | `/api/v1/dev/image/private/list` | `page_index`, `page_size`, optional `offset`. |
| Create deployment | `POST` | `/api/v1/dev/deployment` | `name`, `deployment_type`, `container_template`. Types: `ReplicaSet`, `Job`, `Container`. |
| List deployments | `POST` | `/api/v1/dev/deployment/list` | `page_index`, `page_size`, optional `name`, `status`, `deployment_uuid`. |
| List container events | `POST` | `/api/v1/dev/deployment/container/event/list` | `deployment_uuid`, optional `deployment_container_uuid`, pagination. |
| List/query containers | `POST` | `/api/v1/dev/deployment/container/list` | `deployment_uuid`, optional filters for container, date, GPU, CPU, memory, price, released/status, pagination. |
| Stop a container | `PUT` | `/api/v1/dev/deployment/container/stop` | `deployment_container_uuid`, optional `decrease_one_replica_num`, `no_cache`, `cmd_before_shutdown`. |
| Set replica count | `PUT` | `/api/v1/dev/deployment/replica_num` | `deployment_uuid`, `replica_num`. Only for `ReplicaSet`. |
| Stop deployment | `PUT` | `/api/v1/dev/deployment/operate` | `deployment_uuid`, `operate: "stop"`. |
| Delete deployment | `DELETE` | `/api/v1/dev/deployment` | `deployment_uuid`. Official docs say deletion stops and deletes if not already stopped. |
| Set scheduling blacklist | `POST` | `/api/v1/dev/deployment/blacklist` | `deployment_container_uuid`, optional `expire_in_minutes`, `comment`. Default expiry is 24 hours; max documented expiry is 30 days. |
| List active scheduling blacklist | `GET` | `/api/v1/dev/deployment/blacklist` | No body. |
| Get elastic deployment GPU stock | `POST` | `/api/v1/dev/machine/region/gpu_stock` | `region_sign`, optional CUDA/GPU/CPU/memory/price filters. |
| Get purchased duration package overview | `GET` | `/api/v1/dev/deployment/ddp/overview` | Query param: `deployment_uuid`. |

Common `container_template` fields:

- `dc_list`: data center list. Replaces deprecated `region_sign`.
- `gpu_name_set`, `gpu_num`.
- `cuda_v_from`, `cuda_v_to`.
- `cpu_num_from`, `cpu_num_to`.
- `memory_size_from`, `memory_size_to`.
- `price_from`, `price_to`.
- `image_uuid`.
- `cmd`.
- Optional: `service_6006_port_protocol`, `service_6008_port_protocol`.
- Optional: `reuse_container`, `reuse_container_scope`.

Deployment types:

- `ReplicaSet`: long-running replicated service; supports replica count changes.
- `Job`: finite/batch work; requires `replica_num` and `parallelism_num`.
- `Container`: single-container style deployment.

Container details can include:

- `uuid`, `deployment_uuid`, `machine_id`, `status`.
- `data_center`, `gpu_name`, `gpu_num`, `cpu_num`, `memory_size`, `image_uuid`, `price`.
- `info.ssh_command`, `info.root_password`, `info.service_6006_port_url`, `info.service_6008_port_url`.

## Regions

| Region | Value |
| --- | --- |
| Northwest enterprise region | `westDC2` |
| Northwest B | `westDC3` |
| Beijing A | `beijingDC1` |
| Beijing B | `beijingDC2` |
| L20 region, formerly Beijing C | `beijingDC4` |
| V100 region, formerly South China A | `beijingDC3` |
| Inner Mongolia A | `neimengDC1` |
| Foshan | `foshanDC1` |
| Chongqing A | `chongqingDC1` |
| 3090 region | `yangzhouDC1` |
| Inner Mongolia B | `neimengDC3` |

## CUDA Integer Values

| CUDA | Value |
| --- | --- |
| 11.8 | `118` |
| 12.0 | `120` |
| 12.1 | `121` |
| 12.2 | `122` |

If the exact CUDA version is not listed, choose the lowest compatible documented value because newer drivers can normally run lower CUDA workloads. Avoid setting a version higher than needed because it narrows the scheduling pool.

## Elastic Container Environment Variables

| Key | Meaning |
| --- | --- |
| `AutoDLContainerUUID` | Container UUID |
| `AutoDLDeploymentUUID` | Deployment UUID |
| `AutoDLDataCenter` | Data center |

## Minimal Python Client Pattern

```python
import os
import requests

BASE_URL = "https://api.autodl.com"


class AutoDLError(RuntimeError):
    pass


class AutoDLClient:
    def __init__(self, token=None):
        token = token or os.environ["AUTODL_TOKEN"]
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": token,
            "Content-Type": "application/json",
        })

    def request(self, method, path, *, json=None, params=None):
        response = self.session.request(
            method,
            f"{BASE_URL}{path}",
            json=json,
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") != "Success":
            raise AutoDLError(payload)
        return payload.get("data")

    def balance(self):
        return self.request("POST", "/api/v1/dev/wallet/balance", json={})
```

