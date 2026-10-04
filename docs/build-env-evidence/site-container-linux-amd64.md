# lotbi-site linux/amd64 container evidence

Observed on 2026-10-04 (Asia/Seoul) from Docker Hub with Docker Buildx.

- Candidate image tag: `nginx:1.28-alpine`
- OCI index digest: `sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`
- linux/amd64 manifest digest: `sha256:0dcc88822d45581e65ae329f8be769762bf628d3b2bb7d2a077d4aa5c98b30e3`
- Registry-reported image version: `1.28.3-alpine`
- Repository contract platform: `linux/amd64`

The Dockerfile pins the architecture-specific manifest rather than the mutable
multi-platform tag. It also accepts `VCS_REF` and `VCS_SOURCE` build arguments
and exposes both values through OCI source/revision labels.

Registry inspection command:

```text
docker buildx imagetools inspect nginx:1.28-alpine
```

Static pin validation:

```text
python scripts/validate_container_pin_01.py
```

Local image builds and HTTP smoke tests remain pending until Windows Virtual
Machine Platform becomes active after the already-requested host restart. No
Docker daemon or active product process was modified while collecting this
registry evidence.
