const path = require('path')
const RPC = require('./rpc')
class Script {
  listen(onKey) {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const handler = (key) => {
      onKey(key);

      // Optional: handle Ctrl+C (SIGINT)
      if (key === '\u0003') { // Ctrl+C
        cleanup();
        process.exit();
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdin.off('data', handler);
    };

    process.stdin.on('data', handler);

    return cleanup; // call this to stop listening
  }
  normalizeTarget(target) {
    const appendInputValue = (input, key, value) => {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        if (Array.isArray(input[key])) {
          input[key].push(value)
        } else {
          input[key] = [input[key], value]
        }
      } else {
        input[key] = value
      }
    }
    if (target && typeof target === "object" && typeof target.uri === "string") {
      return {
        uri: target.uri,
        input: target.input && typeof target.input === "object" ? target.input : undefined
      }
    }
    let uri = target
    let input
    if (!/^https?:\/\//i.test(uri)) {
      let queryIndex = uri.indexOf("?")
      if (queryIndex >= 0) {
        input = {}
        let params = new URLSearchParams(uri.slice(queryIndex + 1))
        for (let [key, value] of params.entries()) {
          appendInputValue(input, key, value)
        }
        uri = uri.slice(0, queryIndex)
      }
      uri = path.resolve(process.cwd(), uri)
    }
    return {
      uri,
      input
    }
  }
  async default_script (uri, defaultSelectors) {
    const rpc = new RPC("ws://localhost:42000")
    const stop = () => {
      rpc.run({
        method: "kernel.api.stop",
        params: { uri }
      }, (packet) => {
      })
    }
    process.on("SIGINT", () => {
      stop()
    });
    process.on("SIGTERM", () => {
      stop()
    });
    process.on("beforeExit", (code) => {
      stop()
    });
    process.on("exit", (code) => {
      stop()
    });
    let default_target = await new Promise((resolve, reject) => {
      rpc.run({
        uri,
        mode: "open",
        default: Array.isArray(defaultSelectors) ? defaultSelectors : undefined,
        source: "pterm",
        client: {
          source: "pterm"
        }
      }, (packet) => {
        if (packet.data && packet.data.uri) {
          // start
          //rpc.stop({ uri })
          stop()
          resolve({
            uri: packet.data.uri,
            input: packet.data.input
          })
        }
      })
    })
    return default_target
  }
  async stop(argv) {
    if (argv._.length > 1) {
      let _uri = argv._[1]
      const { uri } = this.normalizeTarget(_uri)
      const rpc = new RPC("ws://localhost:42000")
      rpc.run({
        method: "kernel.api.stop",
        params: { uri }
      }, (packet) => {
        process.exit()
      })
    } else {
      console.error("required argument: <uri>")
    }
  }
  async start(_uri, kill, ondata) {
    const cols = process.stdout.columns;
    const rows = process.stdout.rows;
    const rpc = new RPC("ws://localhost:42000")

    const target = this.normalizeTarget(_uri)
    const uri = target.uri

    const stop = () => {
      this.killed = true
      rpc.run({
        method: "kernel.api.stop",
        params: { uri },
      }, (packet) => {
        rpc.stop({ uri })
      })
    }
    process.on("SIGINT", () => {
      stop()
    });
    process.on("SIGTERM", () => {
      stop()
    });
    process.on("beforeExit", (code) => {
      stop()
    });
    process.on("exit", (code) => {
      stop()
    });
    this.key_stop = this.listen((key) => {
      if (key.length >= 256) {
        rpc.run({
          id: this.shell_id,
          paste: true,
          key: key
        })
      } else {
        rpc.run({
          id: this.shell_id,
          key: key
        })
      }
    });
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns;
      const rows = process.stdout.rows;
      rpc.run({
        id: this.shell_id,
        resize: {
          cols,
          rows,
        }
      }, (packet) => {
      })
    });
    let payload = {
      uri,
      source: "pterm",
      client: {
        cols,
        rows,
        source: "pterm"
      }
    }
    if (target.input && Object.keys(target.input).length > 0) {
      payload.input = target.input
    }
    await rpc.run(payload, (packet) => {
      if (packet.type === "stop") {
        rpc.stop({ uri })
        if (kill) {
          this.key_stop()
          process.exit()
        }
      } else if (packet.type === "disconnect") {
        rpc.close()
        if (kill) {
          this.key_stop()
          process.exit()
        }
      } else if (packet.type === "stream") {
        if (packet.data.id) {
          this.shell_id = packet.data.id
        }
        process.stdout.write(packet.data.raw)
      }
      if (ondata) {
        ondata(packet)
      }
    })
  };

}
module.exports = Script
