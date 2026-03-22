# Pinokio Terminal

Interact with Pinokio through terminal commands

# Install

```
npm install -g pterm
```

# Usage

This README documents the stable public CLI surface.

## version

prints the current version

### syntax

```
pterm version <type>
```

- `type`: may be `terminal`, `pinokiod`, `pinokio`, or `script`
  - `terminal`: returns the pterm version
  - `pinokiod`: returns the pinokiod version
  - `pinokio`: returns the Pinokio app wrapper version
  - `script`: returns the valid script version for the current client. used for including in `pinokio.js`

### example

```
pterm version terminal
```

## refs

Pinokio resource references use this syntax:

```
pinokio://<host>:<port>/<scope>/<id>
```

Examples:

```
pinokio://127.0.0.1:42000/api/cropper.git
pinokio://192.168.86.26:42000/api/facefusion-pinokio.git
```

Currently documented scope:

- `api`: an installed Pinokio app under `PINOKIO_HOME/api`

How refs are used:

- the `host:port` in a ref identifies the target Pinokio control plane, not the app's `ready_url`
- `pterm` does not connect directly to the app endpoint described by the ref
- `pterm` talks to the local Pinokio control plane, and the local control plane resolves or forwards the ref to the target Pinokio node as needed

## start

Start a pinokio script. `pterm` options go before `--`. Script args go after `--`.

### syntax

```
pterm start <script_path> [--ref <pinokio_ref>] [-- --<key>=<value> ...]
```

With `--ref`, prefer relative script paths like `start.js`. `~/...` expansion is only local.

### examples

Starting a script named `install.js`:

```
pterm start install.js
```

Starting a script named `start.js` with parameters:

```
pterm start start.js -- --port=3000 --model=google/gemma-3n-E4B-it
```

Above command starts the script `start.js` with the following args:

```
{
  port: 3000,
  model: "google/gemma-3n-E4B-it"
}
```

Query parameters in the script path are also passed through as script input automatically:

```
pterm start 'run.js?mode=Default'
```

Starting a relative script inside a selected app:

```
pterm start start.js --ref pinokio://127.0.0.1:42000/api/metube-pinokio.git
```

Passing a script argument named `app` without conflicting with `pterm --ref`:

```
pterm start start.js --ref pinokio://127.0.0.1:42000/api/metube-pinokio.git -- --app=my-script-value
```

Which can be accessed in the `start.js` script, for example:

```json
{
  "daemon": true,
  "run": [{
    "method": "shell.run",
    "params": {
      "env": {
        "PORT": "{{args.port}}"
      },
      "message": "python app.py --checkpoint={{args.model}}"
    }
  }]
}
```

## stop

Stops a script if running:

### syntax

```
pterm stop <script_path>
pterm stop <script_path> --ref <pinokio_ref>
pterm stop <pinokio_ref>
```

With `--ref`, prefer relative script paths like `start.js`. `~/...` expansion is only local.


### example

Stop the `start.js` script if it's running:

```
pterm stop start.js
```

Stop a relative script inside a selected app:

```
pterm stop start.js --ref pinokio://127.0.0.1:42000/api/metube-pinokio.git
```

Stop all running scripts for an app:

```
pterm stop pinokio://127.0.0.1:42000/api/metube-pinokio.git
```

## run

Run a launcher. Equivalent to the user visiting a launcher page. By default it will run whichever script is the current launcher default. If the launcher exposes no explicit default, you can provide repeated `--default` selectors and Pinokio will match the first selector that exists in the launcher's current menu state.

### syntax

```
pterm run <launcher_path_or_uri> [--default <selector>]... [--open]
pterm run <pinokio_ref> [--default <selector>]... [--open]
```

- `--open`: (optional) open URL results in the browser. Default behavior is to print the URL to stdout without opening a browser.
- `--default`: (optional, repeatable) ordered launcher action selector. Each selector is matched against the current launcher menu. Selectors use launcher `href` syntax such as `run.js`, `install.js`, or `run.js?mode=Default`.

### examples

Launch the launcher in the current path

```
pterm run .
```

Launch from absolute path

```
pterm run /pinokio/api/test
```

Run from a launcher URI and auto-open the resulting URL in browser

```
pterm run https://github.com/example/my-launcher --open
```

Run a launcher with ordered fallback selectors when the launcher has no explicit default item

```
pterm run ~/pinokio/api/facefusion-pinokio.git \
  --default 'run.js?mode=Default' \
  --default run.js \
  --default install.js
```

Run an installed app by Pinokio ref:

```
pterm run pinokio://192.168.86.26:42000/api/facefusion-pinokio.git \
  --default 'run.js?mode=Default' \
  --default run.js \
  --default install.js
```

For direct script execution with query parameters, use `pterm start`. Query parameters are passed through as script input automatically.

```
pterm start 'run.js?mode=Default'
```

## download

Clone an app repo into Pinokio's app directory without launching it.

### syntax

```
pterm download <uri> [name] [--branch=<branch>]
pterm download <uri> [name] -b <branch>
```

- `uri`: required git repository URI
- `name`: (optional) target folder name under `PINOKIO_HOME/api`
- `--branch` / `-b`: (optional) clone a specific branch

Behavior:

- if `name` is omitted, Pinokio uses the same default destination folder naming as `git clone <uri>`
- if `name` is provided, Pinokio clones into `PINOKIO_HOME/api/<name>`
- if the target folder already exists, the command fails with `already exists`
- the command does not dedupe by repo URL

### examples

```
pterm download https://github.com/example/my-launcher.git
```

```
pterm download https://github.com/example/my-launcher.git my-launcher-dev
```

```
pterm download https://github.com/example/my-launcher.git my-launcher-dev --branch=feature-x
```

## search

Search installed or available apps.

### syntax

```
pterm search [query words...]
pterm search --q="<query>"
pterm search "<query>" [--mode=balanced|broad|strict] [--min-match=<n>] [--limit=<n>]
```

- `--mode`: (optional) search strategy. `broad` (default), `balanced`, or `strict`.
- `--min-match`: (optional) minimum number of query terms an app should match.
- `--limit`: (optional) max number of app results to return.

### examples

```
pterm search comfyui
```

```
pterm search --q="text generation"
```

```
pterm search "tts speech synthesis" --mode=balanced --min-match=2 --limit=8
```

## registry search

Search the remote Pinokio registry.

### syntax

```
pterm registry search [query words...]
pterm registry search --q="<query>" [--limit=<n>] [--sort=relevance|popular|trending|latest|created|checkins|name] [--platform=mac|windows|linux] [--gpu=nvidia|amd|apple]
```

- `--limit`: (optional) max number of app results to return.
- `--sort`: (optional) result ordering. Default is `relevance`.
- `--platform`: (optional) filter by observed platform support from public check-ins.
- `--gpu`: (optional) filter by observed GPU support from public check-ins.

By default, this command queries `https://api.pinokio.co/v1/search`. Override with `PINOKIO_REGISTRY_API_BASE`.

### examples

```
pterm registry search tts
```

```
pterm registry search "speech synthesis" --limit=5
```

PINOKIO_REGISTRY_API_BASE=https://api.pinokio.co pterm registry search comfyui --platform=mac --gpu=apple
```

```
PINOKIO_REGISTRY_API_BASE=https://api.pinokio.co pterm registry search comfyui --sort=popular
```

## which

Resolve the executable path for a command name through Pinokio's environment.

### syntax

```
pterm which <command> [--json]
```

- `--json`: (optional) print the raw JSON response instead of only the path.

### examples

```
pterm which node
```

```
pterm which git --json
```

## home

Get `PINOKIO_HOME`.

### syntax

```
pterm home [--json]
```

- `--json`: (optional) print the raw JSON response instead of only the path.

### examples

```
pterm home
```

```
pterm home --json
```

## status

Get app status by app id or Pinokio ref.

### syntax

```
pterm status <app_id> [--probe] [--timeout=<ms>]
pterm status <pinokio_ref> [--probe] [--timeout=<ms>]
```

- `--probe`: (optional) actively probe app health.
- `--timeout`: (optional) probe timeout in milliseconds.

### examples

```
pterm status comfyanonymous-comfyui
```

```
pterm status comfyanonymous-comfyui --probe --timeout=5000
```

```
pterm status pinokio://192.168.86.26:42000/api/comfyanonymous-comfyui --probe --timeout=5000
```

## stars

List starred apps.

### syntax

```
pterm stars [query words...]
pterm stars --q="<query>"
```

### examples

```
pterm stars
```

```
pterm stars tts
```

## star

Star an app so it is preferred on Pinokio home/search ranking.

### syntax

```
pterm star <app_id>
```

### example

```
pterm star comfyanonymous-comfyui
```

## unstar

Remove star from an app.

### syntax

```
pterm unstar <app_id>
```

### example

```
pterm unstar comfyanonymous-comfyui
```

## logs

Get app logs by app id or Pinokio ref.

### syntax

```
pterm logs <app_id> [--script=<name>] [--tail=<lines>]
pterm logs <pinokio_ref> [--script=<name>] [--tail=<lines>]
```

- `--script`: (optional) filter to a script.
- `--tail`: (optional) return only the last N lines.

### examples

```
pterm logs comfyanonymous-comfyui
```

```
pterm logs comfyanonymous-comfyui --script=start --tail=200
```

```
pterm logs pinokio://192.168.86.26:42000/api/comfyanonymous-comfyui --script=start --tail=200
```

## filepicker

Display a file picker dialog, which lets the user select one or more file or folder paths, powered by tkinter.

This API is NOT for uploading the actual files but for submitting file paths. Use `pterm upload <pinokio_ref> <file...>` when a remote app needs real files staged onto its machine.

### syntax

```
pterm filepicker [<arg>, <arg>, ...]
```

Where args can be one of the following:

- `<arg>`: script flags
  - `--title`: (optional) file dialog title.
  - `--type`: (optional) which type to select. Either "folder" or "file". If not specified, the value is "file". 
  - `--path`: (optional) specify path to open the file dialog from. If not specified, just use the default path.
  - `--multiple`: (optional) whether to allow multiple path selection (`true` or `false`). Default is `false`.
  - `--filetype`: (optional) file types to accept. you can specify multiple `--filetype` flags. The format must follow `type/extension,extension,extension,...` (Example: `--filetype='image/*.png,*.jpg`)

### examples

#### Select a folder path

```
pterm filepicker --type=folder
```

#### Select a file path

The most basic command lets users select a single file:

```
pterm filepicker
```

#### Select multiple files

```
pterm filepicker --multiple
```

#### Open the filepicker from the current path

```
pterm filepicker --path=.
```

#### Open an image filepicker

```
pterm filepicker --filetype='images/*.png,*.jpg,*.jpeg'
```

#### Open a filepicker with multiple file types

```
pterm filepicker --filetype='images/*.png,*.jpg,*.jpeg' --filetype='docs/*.pdf'
```

## upload

Stage one or more local files onto the selected app's machine and return remote filesystem paths that can be passed to path-based tasks.

### syntax

```
pterm upload <app_id|pinokio_ref> <file...>
```

Quoted `~/...` file paths are expanded locally before upload.

### examples

```
pterm upload facefusion-pinokio.git ./face.jpg ./video.mp4
```

```
pterm upload pinokio://192.168.86.26:42000/api/facefusion-pinokio.git ./face.jpg ./video.mp4
```

## clipboard

write to or read from clipboard

### syntax

```
pterm clipboard copy <text>
pterm clipboard paste
```


### examples

#### copy text to clipboard

The following command copies "hello world" to the clipboard

```
pterm clipboard copy "hello world"
```

#### read from clipboard

Assuming the clipboard contains the text 'hello world',

```
pterm clipboard paste
```

will print:

```
hello world
```

You can pipe this to other terminal commands to easily access the clipboard content.

## push

Send a desktop notification

### syntax

```
pterm push <message> [<arg>, <arg>, ...]
```

- `message`: a message to send
- `<arg>`: script flags
  - `--title`: (optional) push notification title
  - `--subtitle`: (optional) push notification subtitle
  - `--image`: (optional) custom image path (can be both relative and absolute paths)
  - `--sound`: (optional) true|false (default is false)
  - `--wait`: (optional) wait for 5 seconds
  - `--timeout`: (optional) wait for N seconds

### examples

#### send a simple notification

```
pterm push 'hello world'
```

#### notification with sound

```
pterm push 'this is a notification' --sound
```

#### notification with an image

```
pterm push 'this is an image notification' --image=icon.png
```
