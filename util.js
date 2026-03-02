const os = require('os')
const axios = require('axios')
const path = require('path')
const RPC = require('./rpc')
class Util {
  printJson(payload) {
    process.stdout.write(JSON.stringify(payload, null, 2))
    process.stdout.write("\n")
  }
  async search(argv) {
    const query = (argv._.slice(1).join(" ") || argv.q || "").trim()
    const params = { q: query }
    const mode = typeof argv.mode === "string" ? argv.mode.trim().toLowerCase() : ""
    const minMatchRaw = argv.minMatch ?? argv["min-match"] ?? argv.min_match
    const limitRaw = argv.limit
    if (mode === "broad" || mode === "balanced" || mode === "strict") {
      params.mode = mode
    }
    if (minMatchRaw !== undefined && minMatchRaw !== null && minMatchRaw !== "") {
      const minMatch = Number.parseInt(String(minMatchRaw), 10)
      if (Number.isFinite(minMatch) && minMatch > 0) {
        params.min_match = String(minMatch)
      }
    }
    if (limitRaw !== undefined && limitRaw !== null && limitRaw !== "") {
      const limit = Number.parseInt(String(limitRaw), 10)
      if (Number.isFinite(limit) && limit > 0) {
        params.limit = String(limit)
      }
    }
    const response = await axios.get("http://localhost:42000/apps/search", {
      params
    })
    this.printJson(response.data)
  }
  async status(argv) {
    if (argv._.length <= 1) {
      console.error("required argument: <app_id>")
      return
    }
    const appId = argv._[1]
    const probe = argv.probe ? "1" : "0"
    const timeout = argv.timeout ? Number.parseInt(String(argv.timeout), 10) : null
    const params = new URLSearchParams()
    params.set("probe", probe)
    if (Number.isFinite(timeout) && timeout > 0) {
      params.set("timeout", String(timeout))
    }
    const url = `http://localhost:42000/apps/status/${encodeURIComponent(appId)}?${params.toString()}`
    const response = await axios.get(url)
    this.printJson(response.data)
  }
  async logs(argv) {
    if (argv._.length <= 1) {
      console.error("required argument: <app_id>")
      return
    }
    const appId = argv._[1]
    const params = new URLSearchParams()
    if (argv.script) {
      params.set("script", String(argv.script))
    }
    if (argv.tail) {
      const tail = Number.parseInt(String(argv.tail), 10)
      if (Number.isFinite(tail) && tail > 0) {
        params.set("tail", String(tail))
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : ""
    const url = `http://localhost:42000/apps/logs/${encodeURIComponent(appId)}${suffix}`
    const response = await axios.get(url)
    this.printJson(response.data)
  }
  async filepicker(argv) {
    const rpc = new RPC("ws://localhost:42000")
    if (argv.path) {
      argv.path = path.resolve(process.cwd(), argv.path)
    }
    await rpc.run({
      method: "kernel.bin.filepicker",
      params: argv
    }, (packet) => {
      if (packet.type === "result") {
        rpc.close()
        if (packet.data.paths.length > 0) {
          for(let p of packet.data.paths) {
            process.stdout.write(p)
            process.stdout.write("\n")
          }
        }
      } else if (packet.type === "stream") {
//        process.stdout.write(packet.data.raw)
      }
    })
  }
  async clipboard(argv) {
    // pinokio clipboard copy <text>
    // pinokio clipboard paste
    if (argv._.length > 1) {
      let payload = { type: argv._[1] }
      if (argv._.length > 2) {
        payload.text = argv._[2]
      }
      let response = await axios.post("http://localhost:42000/clipboard", payload)
      if (response.data && response.data.text) {
        console.log(response.data.text)
      }
    }
  }
  async push(argv) {
    if (argv._ && argv._.length > 1 && !argv.message) {
      argv.message = argv._[1]
    }
    if (argv.image && !path.isAbsolute(argv.image)) {
      argv.image = path.resolve(process.cwd(), argv.image)
    }
    let response = await axios.post("http://localhost:42000/push", argv)
    return response
  }
  async open_url(url) {
    let response = await axios.post("http://localhost:42000/go", { url })
    return response
  }
  async download(argv) {
    if (argv._.length > 1) {
      let uri = argv._[1]
      const rpc = new RPC("ws://localhost:42000")
      await rpc.run({
        method: "kernel.bin.install2",
        params: {}
      }, (packet) => {
        if (packet.type === "result") {
          rpc.close()
        } else if (packet.type === "stream") {
          process.stdout.write(packet.data.raw)
        }
      })
      if (!uri.endsWith(".git")) {
        uri = uri + ".git"
      }

      let exists;
      await rpc.run({
        method: "kernel.bin.path_exists",
        params: { uri }
      }, (packet) => {
        if (packet.type === "result") {
          exists = packet.data
          rpc.close()
        }
      })

      if (!exists) {
        let message = `git clone ${uri}`
        let name = new URL(uri).pathname.split("/").pop()
        if (argv._.length > 2) {
          name = argv._[2]
          message = `git clone ${uri} ${name}`
        }
        if (argv.b) {
          let branch = argv.b
          message += ` -b ${branch}`
        }
        await rpc.run({
          method: "shell.run",
          params: { message, path: "~/api" }
        }, (packet) => {
          if (packet.type === "result") {
            rpc.close()
          } else if (packet.type === "stream") {
            process.stdout.write(packet.data.raw)
          }
        })
      }
      if (!argv.no_exit) {
        process.exit()
      }
    } else {
      console.error("required argument: <uri>")
    }
  }
}
module.exports = Util
