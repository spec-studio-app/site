---
title: The relay
summary: Reach your specs from claude.ai, the Claude app or another computer, also while the Mac is offline.
order: 3
---

## What the relay does

![](video:relay)

The relay is a remote MCP server that you host yourself. With it, Claude AI (claude.ai, the Claude app on your phone, or Claude Code on another computer) can list, read, make and start the specs of Spec Studio on your Mac, and send messages to the Claude session of a spec.

The relay keeps a copy of each spec in a store. A backend plugin keeps the store. The default plugin, plugin-json, keeps JSON files on a volume. You can also use plugin-temporal, with your own Temporal namespace. So Claude AI can read your specs and leave messages while the Mac is offline. The messages wait in the relay, and the Mac gets them when it connects again.

The Mac opens no port. The Spec Studio agent on the Mac connects out to the relay.

```text
Claude AI ──HTTPS (OAuth)──▶ relay ◀──WebSocket── studio agent (Mac)
                               │
                 backend plugin: plugin-json (files on a volume) or plugin-temporal (Temporal)
                 S3 bucket (attachments, optional)
```

The relay is for you only. It has one owner password and no sign-up. Its code is public in [spec-studio-app/relay](https://github.com/spec-studio-app/relay).

## What you need

- A public HTTPS address for the relay, for example `https://relay.example.com`.
- Docker, or a Kubernetes cluster with Helm.
- For plugin-json (the default): a persistent volume for the data folder of the relay.
- For plugin-temporal (optional): a Temporal namespace, on Temporal Cloud or on a Temporal that you host. A self-hosted Temporal must be version 1.27 or later.
- Optional: a private S3-compatible bucket for attachments.

[Relay backends](/guides/backends/) explains each store, bucket and hosting choice, and every setting.

## Step 1: Make the password hash

Make the bcrypt hash of the owner password. You type this password on the relay's sign-in page. The command asks for the password, so it does not go into your shell history:

```sh
read -rs RELAY_PASSWORD && printf '%s' "$RELAY_PASSWORD" | docker run --rm -i ghcr.io/spec-studio-app/relay password-hash; unset RELAY_PASSWORD
```

## Step 2: Choose the store

The relay keeps its state only in a backend plugin. The image includes two plugins. `RELAY_STORE` selects one: `json` or `temporal`. When `RELAY_STORE` is not set, the relay uses plugin-temporal if `TEMPORAL_ADDRESS` is set, else plugin-json. When `RELAY_PLUGIN` or `RELAY_PLUGIN_URL` is set, the store is that plugin instead.

- **plugin-json** (the default): JSON files in `RELAY_DATA_DIR` (default `/data`). Mount a persistent volume there. The relay is one container and a volume, with no other service. There are no payload keys and no codec endpoints. See [plugin-json](/guides/backends/#plugin-json).
- **plugin-temporal**: your own Temporal namespace, on Temporal Cloud or on a Temporal that you host. Use it when you already run Temporal. It needs no search attribute. It also needs the payload keys. See [plugin-temporal](/guides/backends/#plugin-temporal).

You can also give the relay another backend plugin for your own storage, with `RELAY_PLUGIN` or `RELAY_PLUGIN_URL`. You do not need one: plugin-json is the default. See [Another plugin](/guides/backends/#another-plugin).

To use plugin-temporal, make the payload keys. The relay encrypts every Temporal payload with them. Keep a copy in a safe place: without the same keys, the relay cannot read its data.

```sh
docker run --rm ghcr.io/spec-studio-app/relay keys
```

When the Mac uses plugin-temporal on the same namespace, deploy ID and payload keys, the Mac and the relay share one store. See [Share the store with the Mac](/guides/backends/#share-the-store-with-the-mac).

You have a relay older than 0.8.0? Upgrade the image and keep your settings. The first start moves your data one time, and you do not pair again. See [Upgrade from a relay with a built-in store](/guides/backends/#upgrade-from-a-relay-with-a-built-in-store).

## Step 3: Choose a bucket (optional)

Attachments go to a private bucket, never into the store. Without a bucket the relay works, but messages cannot have attachments. Cloudflare R2, AWS S3 and MinIO all work. See [The attachment bucket](/guides/backends/#the-attachment-bucket).

## Step 4: Run the relay

Run it with Docker Compose, Helm or Docker, and put an HTTPS proxy (Caddy, Traefik, Cloudflare Tunnel) in front of port 8760. See [Ways to run the relay](/guides/backends/#ways-to-run-the-relay).

Run one relay process for each deploy. The relay keeps the one connection from the Mac in its process, so do not run two replicas of one deploy. With plugin-json, the state is in the files of that one process too.

## Step 5: Pair the Mac

On its first start, the relay prints a pairing code in its log:

```text
Pairing code: K7QM-2XRD-9VHP
It works once, for 24 hours. On the Mac, run:
  studio agent pair wss://relay.example.com/agent K7QM-2XRD-9VHP
```

In Spec Studio, open **Settings** (⌘,) > **Remote Relay**. Enter the relay URL and the code, and click **Pair**.

![The Remote Relay pane: the relay URL and the pairing code go in, Pair, and the status changes to Connected](proto:settings-relay)

Or run the command from the log in a terminal:

```sh
studio agent pair wss://relay.example.com/agent K7QM-2XRD-9VHP
```

The code works once. For a new code, run `relay pair-code` where the relay runs, with the same settings. With plugin-json, use the same data folder. The relay can keep running:

```sh
docker compose exec relay relay pair-code
kubectl exec deploy/relay -- relay pair-code
```

With a plugin from `RELAY_PLUGIN` that locks its storage, `relay pair-code` cannot run next to the relay. Stop the relay, run the command in a new container with the same settings, and start the relay again (see [Another plugin](/guides/backends/#another-plugin)):

```sh
docker compose stop relay
docker compose run --rm relay pair-code
docker compose start relay
```

With Helm, scale the relay to 0 replicas, run `relay pair-code` in a one-off pod with the same settings and volume, then scale it back to 1. A sidecar plugin (`RELAY_PLUGIN_URL`) needs none of this: use the commands above.

The relay keeps only the SHA-256 of the Mac's secret. To unpair, use the Remote Relay pane, or run `studio agent unpair`.

## Step 6: Add the connector in Claude AI

In Claude AI, add a custom connector with the URL `https://relay.example.com/mcp`. Sign in with the owner password. The sign-in stays after a relay restart.

Then ask Claude, for example: "Which of my specs need me?" or "Tell the notes spec to use a red badge."

## The tools

| Tool | Mac online | Mac offline |
|---|---|---|
| `list_repos` | The Mac answers. Each repo shows its area. `area` shows the repos of one area. | The repos from the last connection of the Mac, with its time. The `area` filter needs the Mac online. |
| `list_specs` | The Mac answers. Each spec shows its area and its collections. `area` and `collection` filter the list. | The relay's copy of each spec, with the time of its last sync. The `area` and `collection` filters need the Mac online. |
| `list_collections` | The Mac answers: each collection with its color, description, link and progress. | Fails at once. |
| `read_spec` | The Mac answers. | The state, the turn and the last 20 events. No `spec.md` or `plan.md` text. |
| `make_spec` | The Mac answers. `collections` puts the new spec in one or more collections. | Fails at once. |
| `start_spec` | The Mac answers. | Fails at once. |
| `send_message` | The relay keeps the message and sends it to the Mac. | The relay keeps the message until the Mac connects. |
| `read_messages` | The messages that the sessions sent with `studio message`. | The same. |
| `upload_attachment` | Stores a file for `send_message`. | The same. |

A message reaches the spec's Claude session as "Message from Claude AI". The session answers with `studio message`, and you read the answer with `read_messages`.

## The Temporal Web UI

This section is for plugin-temporal only. A relay on plugin-json has no codec endpoints.

The payloads in Temporal are encrypted. The Web UI can show the payloads of the spec workflows through the relay's codec endpoints:

1. Set `UI_ORIGIN` to the origin of the Web UI, for example `https://cloud.temporal.io` or `http://localhost:8233`.
2. Open `https://relay.example.com/codec/signin` and sign in with the owner password. The sign-in lasts 12 hours.
3. In the Web UI, set the codec endpoint to `https://relay.example.com/codec` and turn on "Include cross-origin credentials".
