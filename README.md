# Pinokio Terminal

Interact with Pinokio through terminal commands

# Install

```
npm install -g pterm
```

# Usage

## version

prints the current version

### syntax

```
pterm version <type>
```

- `type`: may be `terminal`, `pinokiod`, or `pinokio`
  - `terminal`: returns the pterm version
  - `pinokiod`: returns the pinokiod version
  - `pinokio`: returns the pinokio version

### example

```
pterm version terminal
```

## start

Start a pinokio script. Arguments can be passed into the script

### syntax

```
pterm start <script_path> [<arg1>, <arg2>, ...]
```

### examples

Starting a script named `install.js`:

```
pterm start install.js
```

Starting a script named `start.js` with parameters:

```
pterm start start.js --port=3000 --model=google/gemma-3n-E4B-it
```

Above command starts the script `start.js` with the following args:

```
{
  port: 3000,
  model: "google/gemma-3n-E4B-it"
}
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
```


### example

Stop the `start.js` script if it's running:

```
pterm stop start.js
```

## run

Run a launcher. Equivalent to the user visiting a launcher page. Will run whichever script is the current default script.

### syntax

```
pterm run <launcher_path>
```

### examples

Launch the launcher in the current path

```
pterm run .
```

Launch from absolute path

```
pterm run /pinokio/api/test
```

## filepicker

Display a file picker dialog, which lets the user select one or more file or folder paths, powered by tkinter.

This API is NOT for uploading the actual files but for submitting file paths.

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

which is equivalent to:

```
pterm filepicker --type=file
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

