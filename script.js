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
  async default_script (uri) {
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
    let default_uri = await new Promise((resolve, reject) => {
      rpc.run({ uri, mode: "open" }, (packet) => {
        if (packet.data && packet.data.uri) {
          // start
          //rpc.stop({ uri })
          stop()
          resolve(packet.data.uri)
        }
      })
    })
    return default_uri
  }
  async stop(argv) {
    if (argv._.length > 1) {
      let _uri = argv._[1]
      const uri = path.resolve(process.cwd(), _uri)
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

    const uri = path.resolve(process.cwd(), _uri)

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
    await rpc.run({
      uri,
      client: {
        cols,
        rows,
      }
    }, (packet) => {
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
