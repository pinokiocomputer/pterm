#!/usr/bin/env node
const path = require('path')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const Script = require('./script')
const Util = require('./util')
const argv = yargs(hideBin(process.argv)).parse();
const script = new Script();
const util = new Util();
(async () => {
  if (argv._.length > 0) {
    let cmd = argv._[0].toLowerCase()
    if (cmd === "push") {
      let response = await util.push(argv)
    } else if (cmd === "version") {
      console.log("v" + require('./package.json').version)
    } else if (cmd === "filepicker") {
      await util.filepicker(argv)
    } else if (cmd === "download") {
      await util.download(argv)
    } else if (cmd === "stop") {
      await script.stop(argv)
    } else if (cmd === "start") {
      if (argv._.length > 1) {
        let uri = argv._[1]
        await script.start(uri, true) 
      } else {
        console.error("required argument: <uri>")
      }
    } else if (cmd === "run") {
      if (argv._.length > 1) {
        let _uri = argv._[1]
        const uri = path.resolve(process.cwd(), _uri)
        // try downloading first
        if (path.isAbsolute(uri)) {
        } else {
          // url
          await util.download(argv)
        }
        while(true) {
          let default_uri = await script.default_script(uri)
          if (default_uri) {
            if (path.isAbsolute(default_uri)) {
              await new Promise((resolve, reject) => {
                script.start(default_uri, false, (packet) => {
                  if (packet.type === "result") {
                    resolve()
                  }
                })
              })
              if (script.killed) {
                break
              }
            } else {
              // open in browser
              let response = await util.open_url(default_uri)  
              console.log({ response })
              break
            }
          } else {
            break
          }
        }
        if (script.killed) {
          process.exit()
        }
      } else {
        console.error("required argument: <uri>")
      }
    }
  }
})();
