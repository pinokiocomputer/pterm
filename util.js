const os = require('os')
const axios = require('axios')
const path = require('path')
const RPC = require('./rpc')
class Util {
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
      process.exit()
    } else {
      console.error("required argument: <uri>")
    }
  }
}
module.exports = Util
