# Pinokio Terminal

Interact with Pinokio through terminal commands

# Install

```
npm install -g pterm
```

# Usage

## version

prints the current version

```
pinokio version
```

## start

Start a pinokio script. Arguments can be passed into the script

### syntax

```
pinokio start <script_path> [<arg1>, <arg2>, ...]
```

### examples

Starting a script named `install.js`:

```
pinokio start install.js
```

Starting a script named `start.js` with parameters:

```
pinokio start start.js --port=3000 --model=google/gemma-3n-E4B-it
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
pinokio stop <script_path>
```


### example

Stop the `start.js` script if it's running:

```
pinokio stop start.js
```

## run

Run a launcher. Equivalent to the user visiting a launcher page. Will run whichever script is the current default script.

### syntax

```
pinokio run <launcher_path>
```

### examples

Launch the launcher in the current path

```
pinokio run .
```

Launch from absolute path

```
pinokio run /pinokio/api/test
```

## filepicker

Display a file picker dialog, which lets the user select one or more file or folder paths, powered by tkinter.

This API is NOT for uploading the actual files but for submitting file paths.

### syntax

```
pinokio filepicker [<arg>, <arg>, ...]
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
pinokio filepicker --type=folder
```

#### Select a file path

The most basic command lets users select a single file:

```
pinokio filepicker
```

which is equivalent to:

```
pinokio filepicker --type=file
```

#### Select multiple files

```
pinokio filepicker --multiple
```

#### Open the filepicker from the current path

```
pinokio filepicker --path=.
```

#### Open an image filepicker

```
pinokio filepicker --filetype='images/*.png,*.jpg,*.jpeg'
```

#### Open a filepicker with multiple file types

```
pinokio filepicker --filetype='images/*.png,*.jpg,*.jpeg' --filetype='docs/*.pdf'
```


## push

Send a desktop notification

### syntax

```
pinokio push <message> [<arg>, <arg>, ...]
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
pinokio push 'hello world'
```

#### notification with sound

```
pinokio push 'this is a notification' --sound
```

#### notification with an image

```
pinokio push 'this is an image notification' --image=icon.png
```

