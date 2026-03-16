const os = require('os')
const axios = require('axios')
const path = require('path')
const RPC = require('./rpc')
class Util {
  printJson(payload) {
    process.stdout.write(JSON.stringify(payload, null, 2))
    process.stdout.write("\n")
  }
  formatRpcError(payload) {
    if (typeof payload !== "string") {
      return JSON.stringify(payload)
    }
    const [firstLine] = payload.split(/\r?\n/)
    return firstLine || payload
  }
  registryBase() {
    const value = String(process.env.PINOKIO_REGISTRY_API_BASE || "https://api.pinokio.co").trim()
    return value.replace(/\/$/, "")
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
  async registrySearch(argv) {
    const query = (argv._.slice(2).join(" ") || argv.q || "").trim()
    if (!query) {
      console.error("required argument: <query>")
      return
    }
    const params = { q: query }
    const limitRaw = argv.limit
    const sortRaw = typeof argv.sort === "string" ? argv.sort.trim().toLowerCase() : ""
    const platformRaw = typeof argv.platform === "string" ? argv.platform.trim().toLowerCase() : ""
    const gpuRaw = typeof argv.gpu === "string" ? argv.gpu.trim().toLowerCase() : ""
    if (limitRaw !== undefined && limitRaw !== null && limitRaw !== "") {
      const limit = Number.parseInt(String(limitRaw), 10)
      if (Number.isFinite(limit) && limit > 0) {
        params.limit = String(limit)
      }
    }
    if (["relevance", "popular", "trending", "latest", "created", "checkins", "name"].includes(sortRaw)) {
      params.sort = sortRaw
    }
    if (platformRaw === "mac" || platformRaw === "windows" || platformRaw === "linux") {
      params.platform = platformRaw
    }
    if (gpuRaw === "nvidia" || gpuRaw === "amd" || gpuRaw === "apple") {
      params.gpu = gpuRaw
    }
    const response = await axios.get(`${this.registryBase()}/v1/search`, { params })
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
  async stars(argv) {
    const query = (argv._.slice(1).join(" ") || argv.q || "").trim().toLowerCase()
    const [preferenceResponse, appResponse] = await Promise.all([
      axios.get("http://localhost:42000/apps/preferences"),
      axios.get("http://localhost:42000/info/apps")
    ])
    const preferenceItems = preferenceResponse && preferenceResponse.data && preferenceResponse.data.items
      ? preferenceResponse.data.items
      : {}
    const apps = appResponse && appResponse.data && Array.isArray(appResponse.data.apps)
      ? appResponse.data.apps
      : []
    const appsById = new Map()
    for (const app of apps) {
      if (!app || !app.name) continue
      appsById.set(app.name, app)
    }
    const starredApps = Object.entries(preferenceItems)
      .filter(([, preference]) => preference && preference.starred)
      .map(([appId, preference]) => {
        const app = appsById.get(appId) || {}
        return {
          app_id: appId,
          title: app.title || appId,
          description: app.description || "",
          icon: app.icon || "/pinokio-black.png",
          ...preference
        }
      })
      .sort((a, b) => {
        const aLast = typeof a.last_launch_at === "string" ? Date.parse(a.last_launch_at) || 0 : 0
        const bLast = typeof b.last_launch_at === "string" ? Date.parse(b.last_launch_at) || 0 : 0
        if (aLast !== bLast) {
          return bLast - aLast
        }
        return String(a.title || a.app_id).localeCompare(String(b.title || b.app_id))
      })
      .filter((app) => {
        if (!query) return true
        const haystack = `${app.app_id || ""}\n${app.title || ""}\n${app.description || ""}`.toLowerCase()
        return haystack.includes(query)
      })
    this.printJson({
      q: query,
      count: starredApps.length,
      apps: starredApps
    })
  }
  async setStar(argv, starred) {
    if (argv._.length <= 1) {
      console.error("required argument: <app_id>")
      return
    }
    const appId = argv._[1]
    const response = await axios.put(`http://localhost:42000/apps/preferences/${encodeURIComponent(appId)}`, {
      starred: Boolean(starred)
    })
    this.printJson(response.data)
  }
  async which(argv) {
    if (argv._.length <= 1) {
      console.error("required argument: <command>")
      return
    }
    const command = String(argv._[1]).trim()
    if (!command) {
      console.error("required argument: <command>")
      return
    }
    try {
      const response = await axios.get(`http://localhost:42000/pinokio/path/${encodeURIComponent(command)}`)
      if (argv.json) {
        this.printJson(response.data)
      } else if (response.data && response.data.path) {
        process.stdout.write(String(response.data.path))
        process.stdout.write("\n")
      }
    } catch (error) {
      if (error && error.response && error.response.status === 404) {
        console.error(`command not found: ${command}`)
        process.exitCode = 1
        return
      }
      throw error
    }
  }
  async home(argv) {
    const response = await axios.get("http://localhost:42000/pinokio/home")
    if (argv.json) {
      this.printJson(response.data)
    } else if (response.data && response.data.path) {
      process.stdout.write(String(response.data.path))
      process.stdout.write("\n")
    }
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
  async appDownload(argv) {
    if (argv._.length <= 1) {
      console.error("required argument: <uri>")
      process.exitCode = 1
      return
    }
    const uri = String(argv._[1]).trim()
    const name = argv._.length > 2 ? String(argv._[2]).trim() : ""
    const branch = typeof argv.b === "string"
      ? argv.b.trim()
      : (typeof argv.branch === "string" ? argv.branch.trim() : "")
    const rpc = new RPC("ws://localhost:42000")
    let exitCode = 0
    await rpc.run({
      method: "app.download",
      params: {
        uri,
        ...(name ? { name } : {}),
        ...(branch ? { branch } : {})
      }
    }, (packet) => {
      if (packet.type === "result") {
        if (!packet.data || packet.data.ok === false) {
          exitCode = 1
          const message = packet.data && packet.data.error ? packet.data.error : "download failed"
          if (packet.data && packet.data.path) {
            console.error(`${message}: ${packet.data.path}`)
          } else {
            console.error(message)
          }
        }
        rpc.close()
      } else if (packet.type === "stream") {
        process.stdout.write(packet.data.raw)
      } else if (packet.type === "error") {
        exitCode = 1
        console.error(this.formatRpcError(packet.data))
        rpc.close()
      }
    })
    if (exitCode !== 0) {
      process.exitCode = exitCode
    }
  }
  // Keep the legacy URL download flow for `pterm run <url>`.
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
