---
title: Backend plugins
summary: The plugin keeps the state and the history of each spec. JSON is built in. Choose Temporal in Settings.
order: 5
---

## What a backend plugin keeps

A backend plugin is a small program that keeps data for Spec Studio. The plugin is the only store of a spec's state and history. The app and the `studio` command read and write the plugin. There is no local copy and no queue.

The plugin keeps these items:

- The state of each spec.
- The activity of each spec, one event for each line. These events are the history of the spec.
- The review rounds, the desks, the inbox, the areas, the collections and the waits.

Each change of a spec writes the new state and its events in one atomic step. So the state and the history never disagree. If another writer changed the spec first, the plugin writes nothing, and Spec Studio reads the spec again and tries again.

If the backend is not available, a change fails. The `studio` command exits with a message that names the plugin, the cause and what to do. The app shows the same cause in the strip of the spec and in **Settings > Backend**. Nothing is saved in another place.

The relay also keeps its state only in a backend plugin. It uses plugin-json or plugin-temporal, or another plugin. See [Relay backends](/guides/backends/). The relay's plugin is a different setting from the plugin on the Mac. When both use plugin-temporal with the same namespace, deploy ID and payload keys, they share one store (see [Share the store with the Mac](/guides/backends/#share-the-store-with-the-mac)).

## The two official plugins

The **JSON plugin** is built in. Spec Studio ships plugin-json inside the app. You do not install it with Homebrew, and it needs no setup. It is the default. It keeps the state and the history of each spec in files on your Mac, in the folder `backend/json` of the app's support folder: `~/Library/Application Support/Spec Studio/backend/json`.

The **Temporal plugin** keeps the state and the history of each spec in Temporal. The plugin uses a Temporal namespace that you give. This can be Temporal Cloud or your own Temporal.

Both plugins keep the history. To replay a spec from its start, click **History** in the strip of the spec.

| | JSON | Temporal |
|---|---|---|
| Built in | Yes | No, install it |
| State of each spec | Yes | Yes |
| History and replay | Yes | Yes |
| Needs a Temporal namespace | No | Yes |

## Install the Temporal plugin

JSON needs no install. To use Temporal, install plugin-temporal with Homebrew:

```sh
brew install spec-studio-app/tap/plugin-temporal
```

The app looks for the plugin in `/opt/homebrew/bin` and then in `/usr/local/bin`.

## Choose a plugin in Settings

Open **Spec Studio > Settings…** (⌘,) and go to the **Backend** pane. The pane shows the plugin in use:

- Its name and its version, and a link to its repo.
- What it gives, in plain words: **Specs**, **History and replay**, **Files** and **Live changes**.
- Its status: **Connected**, **Starting** or **Not reachable**. When the plugin is not reachable, the pane shows the reason.

Choose one of these plugins:

- **JSON** (the default, built in).
- **Temporal**.
- **Other**. Type the path of the binary of your own plugin, then click **Use This Plugin** (or press Return). You can also click **Choose…** and select the binary.

When the plugin that you choose is not installed, the pane says so. It shows the `brew install` command and a button to copy it. Install the plugin, then click **Try Again**. The app looks for the plugin again and starts it.

A change of plugin asks for confirmation. Click **Change** to shut down the old plugin and start the new one. Click **Cancel** to keep the old plugin. A change of plugin does not move your data. To move it, see [Move your data to another backend](#move-your-data-to-another-backend).

### The settings of a plugin

The pane shows a field for each setting that the plugin declares. It marks the required fields. The Temporal plugin has settings for the address and the namespace of Temporal, for example.

- The app keeps the values that are not secret in a file in its support folder.
- The app keeps each secret value in the keychain. A secret is never in a file and never in a log.

When you save a setting, the app restarts the plugin. The plugin then gets the new value.

The pane shows the settings of the plugin in use only. To set up another plugin, change to it, fill in its settings and click **Save**. The app keeps the settings of each plugin, also when you change back.

## Work offline with Temporal

The Temporal plugin needs a Temporal server. When the server does not answer, a change fails with a clear message. You can use a local Temporal dev server instead. The dev server starts empty: your specs are not on it. Use it for new work while you are offline.

1. Run a local Temporal server. Give it a file, so that it keeps its data when it stops. Without `--db-filename`, the dev server keeps its data in memory only.

   ```sh
   temporal server start-dev --db-filename ~/temporal-offline.db
   ```

2. In **Settings > Backend**, write down the settings of the Temporal plugin. You need them to go back. The pane does not show a secret value (`api_key`, `tls_key`, `bucket_access_key`, `bucket_secret_key`), so keep those values where you can get them again.
3. Change these settings:
   - Set `address` to `localhost:7233`.
   - Set `namespace` to `default`.
   - If you use an API key or TLS (Temporal Cloud or your own server), click **Remove** next to `api_key` and next to `tls_key`. Clear `auth` and `tls_cert`. The dev server needs no key and no TLS.
   - If you use a bucket, click **Remove** next to `bucket_access_key` and `bucket_secret_key`. Clear `bucket_endpoint` and `bucket_name`, and set `blob_dir` to a local folder. A bucket does not answer while you are offline.
4. Click **Save**. The plugin starts again and connects to the dev server.

A secret setting does not clear when you empty its field: only **Remove** deletes it from the keychain. If a secret stays, the plugin refuses its settings and shows **Not reachable**.

To go back, set the settings that you wrote down again and click **Save**. Type each secret that you removed again (`api_key`, `tls_key`, `bucket_access_key`, `bucket_secret_key`): **Remove** deleted it from the keychain. Your own server has your specs as they were before you went offline.

The work that you did on the dev server stays on the dev server. Spec Studio cannot move it to your own server:

- A move goes from the plugin in use to another plugin. There is no move from Temporal to Temporal.
- A move through JSON does not complete either. Your own server has older copies of the desks, the inbox, the areas, the collections and the waits. A move does not replace a copy that the new plugin has, so the counts do not match and the backend stays the same.

## Move your data to another backend

To change the backend and keep your data, use the move. It copies everything to the new plugin, checks the counts, then switches. If a count is wrong, the setting stays on the old plugin and the command names the spec and the counts. The data also stays in the old plugin.

Before a move, install the new plugin and set it up. The move starts the new plugin with its saved settings. To set up Temporal when JSON is in use:

1. Install plugin-temporal (see [Install the Temporal plugin](#install-the-temporal-plugin)).
2. Change to **Temporal** and click **Change**. Fill in its settings and click **Save**. Wait for **Connected**.
3. Change back to **JSON** and click **Change**.
4. Move your data to Temporal.

```sh
studio backend move --to temporal
studio backend move --to json
```

You can also use the **Move my data** section of **Settings > Backend**. It has a button for each plugin that is not in use, for example **Move My Data to Temporal…**. Click it, click **Move** to confirm, and the app does the same move. It shows the counts or the error. The buttons are off until the plugin in use is **Connected**.

## Links

- [plugin-json](https://github.com/spec-studio-app/plugin-json): the JSON plugin, its settings and its data layout.
- [plugin-temporal](https://github.com/spec-studio-app/plugin-temporal): the Temporal plugin, its settings, history and replay.
- [plugin-sdk](https://github.com/spec-studio-app/plugin-sdk): the protocol, the SDK and the conformance runner. Use it to write your own plugin. The conformance runner shows if your plugin follows the protocol.
