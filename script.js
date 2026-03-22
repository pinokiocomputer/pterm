const os = require('os')
const path = require('path')
const RPC = require('./rpc')
const { resolveWsBaseUrl } = require('./endpoint')
const { resolveAppControlTarget, resolveStopTarget } = require('./target')
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
    const parseTargetUri = (rawUri) => {
      let uri = rawUri
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
        if (uri.startsWith('~/')) {
          uri = path.resolve(os.homedir(), uri.slice(2))
        } else {
          uri = path.resolve(process.cwd(), uri)
        }
      }
      return {
        uri,
        input
      }
    }
    if (target && typeof target === "object" && typeof target.uri === "string") {
      const normalized = parseTargetUri(target.uri)
      return {
        uri: normalized.uri,
        input: normalized.input
          ? {
              ...(target.input && typeof target.input === "object" ? target.input : {}),
              ...normalized.input
            }
          : (target.input && typeof target.input === "object" ? target.input : undefined)
      }
    }
    return parseTargetUri(target)
  }
  async default_script (uri, defaultSelectors, targetControlPlane) {
    const rpc = new RPC(await resolveWsBaseUrl(targetControlPlane))
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
        if (packet && packet.data) {
          rpc.close()
          if (packet.data.uri) {
            stop()
            resolve({
              uri: packet.data.uri,
              input: packet.data.input
            })
          } else {
            resolve(null)
          }
        }
      })
    })
    return default_target
  }
  async stop(argv) {
    if (argv._.length > 1) {
      let _uri = argv._[1]
      const target = await resolveStopTarget(_uri, argv.ref)
      if (!target.uris.length) {
        process.exit(0)
        return
      }
      for (const uri of target.uris) {
        const rpc = new RPC(await resolveWsBaseUrl(target.controlPlane))
        await new Promise((resolve) => {
          let settled = false
          const finish = () => {
            if (settled) {
              return
            }
            settled = true
            rpc.close()
            resolve()
          }
          const timer = setTimeout(finish, 800)
          rpc.run({
            method: "kernel.api.stop",
            params: { uri }
          }, () => {
            clearTimeout(timer)
            finish()
          })
        })
      }
      process.exit(0)
    } else {
      console.error("required argument: <uri>")
    }
  }
  async start(_uri, kill, ondata, targetControlPlane) {
    const cols = process.stdout.columns;
    const rows = process.stdout.rows;
    const rpc = new RPC(await resolveWsBaseUrl(targetControlPlane))

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
    const onSigInt = () => {
      stop()
    }
    const onSigTerm = () => {
      stop()
    }
    const onBeforeExit = () => {
      stop()
    }
    const onExit = () => {
      stop()
    }
    process.on("SIGINT", onSigInt);
    process.on("SIGTERM", onSigTerm);
    process.on("beforeExit", onBeforeExit);
    process.on("exit", onExit);
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
    const resizeHandler = () => {
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
    }
    process.stdout.on('resize', resizeHandler);
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
    let cleanedUp = false
    const cleanupLocalSession = () => {
      if (cleanedUp) {
        return
      }
      cleanedUp = true
      if (this.key_stop) {
        this.key_stop()
        this.key_stop = null
      }
      process.stdout.off('resize', resizeHandler)
      process.off("SIGINT", onSigInt)
      process.off("SIGTERM", onSigTerm)
      process.off("beforeExit", onBeforeExit)
      process.off("exit", onExit)
      rpc.close()
    }
    await rpc.run(payload, (packet) => {
      if (packet.type === "stop") {
        cleanupLocalSession()
        process.exit(0)
      } else if (packet.type === "disconnect") {
        cleanupLocalSession()
        process.exit(0)
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
