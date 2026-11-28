---
title: Relay backends
summary: The store, bucket and hosting choices of the relay, and every setting.
order: 4
---

The relay plugs into two backends that you choose: a **store** that holds the copy of each spec, the messages and the sign-ins, and an optional **bucket** that holds the attachments. The relay has no store of its own. A **backend plugin** keeps its state. The image includes two plugins: **plugin-json** (JSON files on a volume, the default) and **plugin-temporal** (your own Temporal namespace). You can also give the relay another plugin. You also choose **how to run** the relay. This guide gives the settings for each choice. The relay reads every setting from the environment.

`RELAY_STORE` selects the plugin of the image: `json` or `temporal`. When `RELAY_STORE` is not set, the relay uses plugin-temporal if `TEMPORAL_ADDRESS` is set, else plugin-json. When `RELAY_PLUGIN` or `RELAY_PLUGIN_URL` is set, the store is that plugin, and `RELAY_STORE` must be empty (see [Another plugin](#another-plugin)). At start, the relay logs the store and the reason (`store_selected`), and the name and version of the plugin (`plugin_started`).

The relay starts the plugin as its child process. The image includes these versions:

| Plugin | Version |
|---|---|
| [plugin-json](https://github.com/spec-studio-app/plugin-json) | 0.2.0 |
| [plugin-temporal](https://github.com/spec-studio-app/plugin-temporal) | 0.1.0 |

You keep the settings that you used before relay 0.8.0. The relay gives each plugin its settings from the same names. To upgrade a relay that had a built-in store, see [Upgrade from a relay with a built-in store](#upgrade-from-a-relay-with-a-built-in-store).

## plugin-json

plugin-json is the default. The relay is one container and a volume, with no other service. There is no Temporal, there are no payload keys and there are no codec endpoints.

plugin-json keeps the relay's state in `RELAY_DATA_DIR` (default `/data`). Mount a persistent volume there: without a volume, the state is lost with the container. The image runs as uid 1000, and that user must be able to write to the folder. When it cannot, the relay stops at start with a message that names `RELAY_DATA_DIR`.

```sh
RELAY_STORE=json
RELAY_DATA_DIR=/data
```

Both settings are optional: with no Temporal settings, the relay uses plugin-json in `/data`.

The files are not encrypted, and they hold only hashes of the secrets and the tokens. Protect the volume as you protect the relay. Run one relay process on the volume. `relay pair-code` can run next to the running relay on the same folder: plugin-json locks each write.

## plugin-temporal

Use plugin-temporal when you already run Temporal. Set `TEMPORAL_ADDRESS` (or `RELAY_STORE=temporal` with `TEMPORAL_ADDRESS`), `PAYLOAD_KEYS` and the other Temporal settings below. The relay needs one Temporal namespace. Two relays can share a namespace when each has its own `DEPLOY_ID`.

The relay gives plugin-temporal these settings:

| Relay setting | plugin-temporal setting |
|---|---|
| `TEMPORAL_ADDRESS` | `address` |
| `TEMPORAL_NAMESPACE` | `namespace` |
| `TEMPORAL_AUTH`, `TEMPORAL_API_KEY`, `TEMPORAL_TLS_CERT`, `TEMPORAL_TLS_KEY` | `auth`, `api_key`, `tls_cert`, `tls_key` |
| `PAYLOAD_KEYS` | `payload_keys` |
| `DEPLOY_ID` | `deploy_id` |
| `TASK_QUEUE` | `task_queue` |
| `BUCKET_*` | `bucket_*` (plugin-temporal writes only under `_plugin-temporal/` in the bucket) |
| `RELAY_DATA_DIR` (with no bucket) | `blob_dir`: the folder `blobs` in `RELAY_DATA_DIR` |

You change no setting for this. plugin-temporal needs no search attribute, and the relay does not register a namespace or a search attribute.

Make the payload keys. plugin-temporal encrypts every Temporal payload with them. Keep a copy in a safe place: without the same keys, nobody can read the data. See [PAYLOAD_KEYS](#payload-keys).

```sh
docker run --rm ghcr.io/spec-studio-app/relay keys
```

### Temporal Cloud with an API key

1. Make a namespace, and an API key for it.
2. Set the settings:

```sh
TEMPORAL_ADDRESS=<namespace>.<account>.tmprl.cloud:7233
TEMPORAL_NAMESPACE=<namespace>.<account>
TEMPORAL_API_KEY=<the API key>
```

You can also use the regional API key endpoint for `TEMPORAL_ADDRESS`.

### Temporal Cloud with mTLS

Make a namespace and a client certificate for it, in place of the API key. Then set `TEMPORAL_TLS_CERT` and `TEMPORAL_TLS_KEY`, as PEM text or as the path of a PEM file:

```sh
TEMPORAL_ADDRESS=<namespace>.<account>.tmprl.cloud:7233
TEMPORAL_NAMESPACE=<namespace>.<account>
TEMPORAL_TLS_CERT=/secrets/client.pem
TEMPORAL_TLS_KEY=/secrets/client.key
```

### Self-hosted Temporal

Use Temporal Server 1.27 or later. Make the namespace first: the relay does not make it. Set `TEMPORAL_ADDRESS` and `TEMPORAL_NAMESPACE`. Choose the auth with `TEMPORAL_AUTH`:

- `plain` (the default): a frontend with no TLS, for example on a private network.
- `tls`: a frontend with server TLS.
- `mtls`: server TLS and a client certificate, with `TEMPORAL_TLS_CERT` and `TEMPORAL_TLS_KEY`.

```sh
TEMPORAL_ADDRESS=temporal-frontend.temporal.svc:7233
TEMPORAL_NAMESPACE=studio-relay
TEMPORAL_AUTH=plain
```

To try plugin-temporal on one machine, Docker Compose can run a local Temporal dev server for you (see [Docker Compose](#docker-compose)).

### Share the store with the Mac

plugin-temporal gives a store ID: `temporal:<namespace>/<namespace ID>/<deploy ID>`. The relay sends it to the Mac in its welcome. When the Mac's plugin-temporal gives the same store ID, the Mac and the relay use one store.

To get the same store ID on the Mac, open **Spec Studio > Settings > Backend**, choose plugin-temporal, and set:

- the same Temporal server, namespace (`TEMPORAL_NAMESPACE`) and `deploy_id` (`DEPLOY_ID`). The store ID holds the namespace ID, which comes from the server, so a namespace of the same name on another server gives another store ID;
- the same payload keys (`PAYLOAD_KEYS`);
- the same bucket (`BUCKET_*`), so that each side can read the blobs and the exports of the other;
- the same plugin-temporal version as the relay image;
- an address of that Temporal that the Mac can reach. The address is not part of the store ID.

Keep the Temporal frontend private. Reach it over a VPN or a private network, or use TLS with mTLS or an API key (`TEMPORAL_AUTH`). Do not open a frontend with `TEMPORAL_AUTH=plain` to the internet: anyone who reaches it can read the workflow list and stop or delete the workflows, and these workflows are the only store of your specs.

## Another plugin

A backend plugin is a separate program that stores the relay's data. The relay keeps all the rules; the plugin only stores. The plugin protocol (`PROTOCOL.md` in [plugin-sdk](https://github.com/spec-studio-app/plugin-sdk)) defines the calls, so you can write a plugin for your own storage.

You do not need another plugin. plugin-json is the default, and with no plugin setting, the relay uses the plugin of the image.

To use another plugin, set one of these, and leave `RELAY_STORE` empty:

- `RELAY_PLUGIN`: a plugin command, with its arguments. The relay starts it and talks to it on its stdin and stdout.
- `RELAY_PLUGIN_URL` and `RELAY_PLUGIN_TOKEN`: a plugin that runs as a sidecar, over HTTP. Give the plugin the same token (its `--token` flag or its `PLUGIN_TOKEN` variable): the plugin refuses a call with no token or another token. A plugin with no token listens only on a loopback address, so a sidecar in its own container always needs the token.

```sh
# A plugin command in the relay's container
RELAY_PLUGIN="/usr/local/bin/plugin-mine --data /data"

# A plugin sidecar
RELAY_PLUGIN_URL=http://plugin:7070/rpc
RELAY_PLUGIN_TOKEN=<a long random string, for example from openssl rand -hex 32>
```

The relay splits `RELAY_PLUGIN` into words as a shell does. In a shell or a Compose `.env` file, quote the value as above. In a `docker run --env-file` file, write it with no quotes: that file keeps the quotes as part of the value.

Each `RELAY_PLUGIN_<NAME>` setting goes to the plugin as the setting `<name>`, in lowercase. For example, `RELAY_PLUGIN_ADDRESS=temporal:7233` is the plugin setting `address`. The plugin's README names its settings. With Docker Compose, add each of these settings to the `environment` of the `relay` service in `compose.yaml`: the file passes only `RELAY_PLUGIN`, `RELAY_PLUGIN_URL` and `RELAY_PLUGIN_TOKEN` from `.env`.

At start, the relay logs the plugin's name, version, repo and capabilities. When the plugin does not start or refuses its settings, the relay stops with a message that gives the reason and what to check. When a plugin command stops, the relay starts it again; meanwhile, the tools say that the relay's store is not available. `compose.yaml` has an example of a sidecar in comments. For Helm, see [Helm](#helm).

With a plugin from `RELAY_PLUGIN`, the plugin can lock its storage while the relay runs. Then `relay pair-code` cannot open the storage: stop the relay, run `relay pair-code` with the same settings, and start the relay again. A sidecar plugin does not need this.

A move to a different plugin that is empty starts the relay empty. The Mac fills the new store with a short first sync of each spec when it has no sync cursors. So on the Mac, run `studio agent unpair --force` (it removes the pairing and the cursors on this Mac only), then pair again (see [Pair the Mac](/guides/relay/#step-5-pair-the-mac)). The messages that wait in the old store are lost, and you sign in to the connector in Claude AI again.

## Upgrade from a relay with a built-in store

A relay older than 0.8.0 had two built-in stores: a JSON store and a Temporal store with the relay's own workflows. Relay 0.8.0 removes them. Upgrade the image and keep the same settings. The first start moves the data into the plugin one time. The Mac keeps its pairing, and Claude AI keeps its sign-in. You do not pair again, and you do not sign in again.

- **From the built-in JSON store:** the relay starts plugin-json on the same `RELAY_DATA_DIR`, with the same `DEPLOY_ID` (plugin-json imports only the files of that deploy ID). plugin-json imports the old files, keeps a copy in the folder `backup-relay-json-<time>/`, and removes the old files. Then the relay adds its attributes to the imported documents (log event `imported_documents_repaired`). When an old file is bad, the start stops with a message that names the file, and nothing changes.
- **From the built-in Temporal store:** the relay starts plugin-temporal on the same namespace, `DEPLOY_ID`, `TASK_QUEUE` and `PAYLOAD_KEYS`. Before the plugin starts, the relay runs its old worker one time. The relay sends a `handoff` update to each open workflow of this deploy. Each workflow continues as new as a plugin-temporal workflow with the same workflow ID. Then the relay stops the old worker and starts the plugin. Last, the relay writes a closed-spec record for each spec that closed in the retention of the namespace. The old worker can log a warning that it cannot run the type `SpecStudioEntity`: that is the first task of a moved workflow, and plugin-temporal takes it after a short delay. For some seconds after the start, a moved spec can be missing from a list.

The log has the counts (`handoff_moved_all`, `handoff_closed_specs`) and each workflow that failed (`handoff_failed`). A failure stops the start. The next start moves the workflows that are still open. The relay opens its port only after the move, and a start with nothing to move skips the move.

With Helm, upgrade the chart together with the image: the 0.8.0 chart has a startup probe of up to 5 minutes for the first start. A relay 0.3 Compose `dev` profile needs `TEMPORAL_ADDRESS=temporal:7233` in `.env`, else the relay starts on an empty plugin-json.

To go back to an older relay after the move from plugin-json: stop the relay, copy the files from the backup folder to the data folder, and remove `layout.json` and `state/`. After the move from the built-in Temporal store, an older relay cannot run the moved workflows. Stay on relay 0.8.0.

## The attachment bucket

Attachments go to a private S3-compatible bucket, never into the store. The relay deletes the attachments of a spec when the spec is merged or dropped. Set all four of `BUCKET_ENDPOINT`, `BUCKET_NAME`, `BUCKET_ACCESS_KEY` and `BUCKET_SECRET_KEY`, or none.

### Cloudflare R2

1. Make a bucket, for example `spec-studio-relay`. Do not make it public.
2. Make an R2 API token with "Object Read & Write" on that bucket.
3. Set the settings. R2 needs no region: the default `auto` is right.

```sh
BUCKET_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
BUCKET_NAME=spec-studio-relay
BUCKET_ACCESS_KEY=<the token's access key ID>
BUCKET_SECRET_KEY=<the token's secret access key>
```

### AWS S3

Make a private bucket and an IAM user with read and write access to it. S3 needs its real region:

```sh
BUCKET_ENDPOINT=https://s3.us-east-1.amazonaws.com
BUCKET_REGION=us-east-1
BUCKET_NAME=spec-studio-relay
BUCKET_ACCESS_KEY=<access key ID>
BUCKET_SECRET_KEY=<secret access key>
```

### MinIO

Any S3-compatible service works. The relay uses path-style addresses, so MinIO needs no DNS for each bucket:

```sh
BUCKET_ENDPOINT=https://minio.example.com
BUCKET_REGION=us-east-1
BUCKET_NAME=spec-studio-relay
BUCKET_ACCESS_KEY=<access key>
BUCKET_SECRET_KEY=<secret key>
```

### No bucket

Leave all the `BUCKET_*` settings out. The relay works, but messages cannot have attachments: `upload_attachment` answers "The relay has no bucket for attachments."

## Ways to run the relay

Each release publishes the image `ghcr.io/spec-studio-app/relay:<version>` (linux/amd64 and linux/arm64, signed with cosign) and the Helm chart `oci://ghcr.io/spec-studio-app/charts/relay`. Run one relay process for each deploy, and put an HTTPS proxy (Caddy, Traefik, Cloudflare Tunnel) in front of port 8760.

### Docker Compose

Get `compose.yaml` from the [relay repo](https://github.com/spec-studio-app/relay). Put the settings in a `.env` file next to it. Put the password hash in single quotes, because it has `$` characters:

```sh
PUBLIC_URL=https://relay.example.com
OWNER_PASSWORD_HASH='$2b$12$...'
```

Then run:

```sh
docker compose up
```

The relay uses plugin-json, with its data in the Docker volume `relay-data`.

With your own Temporal, use plugin-temporal: also set `TEMPORAL_ADDRESS`, `PAYLOAD_KEYS` and the other Temporal settings in `.env`, then run `docker compose up`.

To try plugin-temporal with a local Temporal dev server (data in a Docker volume, the Temporal Web UI on port 8233 of this machine only, because it has no sign-in), add these settings to `.env`:

```sh
TEMPORAL_ADDRESS=temporal:7233
PAYLOAD_KEYS=data:data-20261123:...,config:config-20261123:...
```

Then run:

```sh
docker compose --profile dev up
```

### Helm

With plugin-json (the default), the chart makes a PersistentVolumeClaim and keeps it when you remove the release:

```sh
helm install relay oci://ghcr.io/spec-studio-app/charts/relay --version <version> \
  --set publicUrl=https://relay.example.com \
  --set bucket.endpoint=https://<account id>.r2.cloudflarestorage.com \
  --set bucket.name=spec-studio-relay \
  --set existingSecret=relay-secrets
```

These values set the volume:

- `persistence.size`: the size of the claim. Default `1Gi`.
- `persistence.storageClass`: the storage class. Empty: the default storage class of the cluster.
- `persistence.existingClaim`: the name of a claim that you made. Empty: the chart makes the claim.

The chart runs one replica with the `Recreate` strategy, so an old pod and a new pod never write the files at the same time.

With plugin-temporal, set `store=temporal` and the Temporal values:

```sh
helm install relay oci://ghcr.io/spec-studio-app/charts/relay --version <version> \
  --set publicUrl=https://relay.example.com \
  --set store=temporal \
  --set temporal.address=temporal-frontend.temporal.svc:7233 \
  --set temporal.namespace=studio-relay \
  --set existingSecret=relay-secrets
```

When `store` is empty, the chart uses the rule of the relay: `temporal` when `temporal.address` is set, else `json`.

For [another plugin](#another-plugin), leave `store` empty and set one of these values:

- `plugin.command`: a plugin command in the image (`RELAY_PLUGIN`). The pod gets the volume at `/data` for its files.
- `plugin.url`: the URL of a plugin that runs as its own service (`RELAY_PLUGIN_URL`), with the token in `secrets.pluginToken` when the plugin has one.
- `plugin.sidecar.enabled=true` with `plugin.sidecar.image`: the plugin in a second container of the pod. It needs `secrets.pluginToken`. For a plugin that keeps files, set `plugin.sidecar.dataPath` (for example `/data`): the sidecar then gets the volume there.

`plugin.settings` holds the plugin's settings: each name becomes `RELAY_PLUGIN_<NAME>`. Put no secret there.

The Secret `existingSecret` has the key `OWNER_PASSWORD_HASH`, and as needed `PAYLOAD_KEYS` (plugin-temporal), `TEMPORAL_API_KEY`, `TEMPORAL_TLS_CERT`, `TEMPORAL_TLS_KEY`, `BUCKET_ACCESS_KEY`, `BUCKET_SECRET_KEY` and `PLUGIN_TOKEN` (a plugin sidecar, or a plugin service with a token). Or leave `existingSecret` empty and set `secrets.*` in your values: the chart then makes the Secret. Set `ingress.enabled=true` and `ingress.host` for an Ingress. The chart's `values.yaml` lists every value.

### Docker

```sh
docker run -d --name relay -p 8760:8760 -v relay-data:/data --env-file relay.env ghcr.io/spec-studio-app/relay:<version>
```

The volume `relay-data` holds the files of plugin-json. With plugin-temporal, the relay uses it only for the blobs, when no bucket is set.

## Every setting

A setting that is missing or not valid stops the start. The message names the setting and never shows its value. The settings marked "Temporal" are required only with plugin-temporal. plugin-json ignores the Temporal settings.

| Setting | Required | Description |
|---|---|---|
| `PUBLIC_URL` | yes | The public origin of the relay. It is the OAuth issuer. |
| `OWNER_PASSWORD_HASH` | yes | The bcrypt hash of the owner password. |
| `RELAY_STORE` | no | `json` or `temporal`. Default: `temporal` when `TEMPORAL_ADDRESS` is set, else `json`. |
| `RELAY_DATA_DIR` | no | The data folder of plugin-json, and of plugin-temporal's blobs when no bucket is set. Default `/data`. |
| `RELAY_PLUGIN_DIR` | no | The folder of the bundled plugins. Default `/usr/local/lib/relay/plugins`. |
| `RELAY_PLUGIN` | no | A backend plugin command, with its arguments. See [Another plugin](#another-plugin). Not with `RELAY_STORE` or `RELAY_PLUGIN_URL`. |
| `RELAY_PLUGIN_URL` | no | The URL of a backend plugin sidecar, for example `http://plugin:7070/rpc`. Not with `RELAY_STORE` or `RELAY_PLUGIN`. |
| `RELAY_PLUGIN_TOKEN` | no | The token of the plugin sidecar. |
| `RELAY_PLUGIN_<NAME>` | no | The plugin setting `<name>` (in lowercase). |
| `PAYLOAD_KEYS` | Temporal | The payload keys of plugin-temporal and the codec, from `relay keys`. See below. |
| `TEMPORAL_ADDRESS` | Temporal | `host:port` of Temporal. |
| `TEMPORAL_NAMESPACE` | no | The namespace. Default `default`. |
| `TEMPORAL_AUTH` | no | `plain`, `tls`, `mtls` or `api-key`. Default: from the other Temporal settings, else `plain`. |
| `TEMPORAL_API_KEY` | no | The API key (Temporal Cloud). |
| `TEMPORAL_TLS_CERT`, `TEMPORAL_TLS_KEY` | no | The client certificate and key for mTLS: PEM text, or the path of a PEM file. |
| `DEPLOY_ID` | no | The name of this deploy. Default `default`. Two relays on one namespace need two names. |
| `TASK_QUEUE` | no | The task queue of the plugin-temporal workflows. Default `relay-<DEPLOY_ID>`. The relay config uses `<TASK_QUEUE>-config`. |
| `BUCKET_ENDPOINT`, `BUCKET_NAME`, `BUCKET_ACCESS_KEY`, `BUCKET_SECRET_KEY` | no | The attachment bucket. Set all four, or none. |
| `BUCKET_REGION` | no | The bucket region. Default `auto` (R2). |
| `ATTACHMENT_MAX_BYTES` | no | The largest attachment. Default 10485760 (10 MB). |
| `UI_ORIGIN` | no | The origin of the Temporal Web UI for the codec endpoints (plugin-temporal). |
| `EXTRA_REDIRECT_URIS` | no | Comma-separated OAuth redirect URIs, besides the claude.ai and claude.com callbacks and loopback addresses. |
| `PORT` | no | The HTTP port. Default 8760. |
| `CALL_TIMEOUT_MS` | no | How long a tool call waits for the Mac. Default 90000. |

### PAYLOAD_KEYS

plugin-temporal only. A comma-separated list of `<scope>:<key id>:<base64 key>`. The scope is `data` (the spec and desk workflows) or `config` (the relay-config workflow). Each key is 32 random bytes; `relay keys` makes a new value. The first key of each scope encrypts. All keys of a scope decrypt, so you can change a key: put the new key first and keep the old key after it.

```sh
PAYLOAD_KEYS=data:data-2:<new>,data:data-1:<old>,config:config-1:<key>
```
