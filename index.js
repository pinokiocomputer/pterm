#!/usr/bin/env node
const path = require('path')
const axios = require('axios')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { resolveHttpBaseUrl } = require('./endpoint')
const { isHttpUri, resolveAppControlTarget, resolveStartTarget } = require('./target')
const extractStartInput = (parsedArgv) => {
  const rawScriptArgs = Array.isArray(parsedArgv && parsedArgv["--"]) ? parsedArgv["--"] : []
  if (!rawScriptArgs.length) {
    return undefined
  }
  const scriptArgv = yargs(rawScriptArgs)
    .parserConfiguration({
      'camel-case-expansion': false,
      'dot-notation': false,
      'duplicate-arguments-array': true,
      'populate--': false
    })
    .help(false)
    .version(false)
    .parse()
  const input = {}
  for (const [key, value] of Object.entries(scriptArgv || {})) {
    if (key === '_' || key === '$0' || value === undefined) {
      continue
    }
    input[key] = value
  }
  return Object.keys(input).length > 0 ? input : undefined
}
const argv = yargs(hideBin(process.argv))
  .option('default', {
    type: 'string',
    array: true
  })
  .option('ref', {
    type: 'string'
  })
  .parserConfiguration({
    'populate--': true
  })
  .parse();
const Script = require('./script')
const Util = require('./util')
const script = new Script();
const util = new Util();
const fetchPinokioVersion = async () => {
  const baseUrl = await resolveHttpBaseUrl()
  const response = await axios.get(`${baseUrl}/pinokio/version`)
  return response.data
}
(async () => {
  if (argv._.length > 0) {
    let cmd = argv._[0].toLowerCase()
    if (cmd === "push") {
      let response = await util.push(argv)
    } else if (cmd === "clipboard") {
      await util.clipboard(argv)
    } else if (cmd === "version") {
      if (argv._.length > 1) {
        let app = argv._[1]
        if (app === "terminal") {
          console.log("pterm@" + require('./package.json').version)
        } else if (app === "pinokiod") {
          try {
            let r = await fetchPinokioVersion()
            console.log(`pinokiod@${r.pinokiod}`)
          } catch (e) {
          }
        } else if (app === "pinokio") {
          try {
            let r = await fetchPinokioVersion()
            if (r.pinokio) {
              console.log(`pinokio@${r.pinokio}`)
            }
          } catch (e) {
          }
        } else if (app === "script") {
          try {
            let r = await fetchPinokioVersion()
            if (r.script) {
              console.log(`${r.script}`)
            }
          } catch (e) {
          }
        }
      }
    } else if (cmd === "filepicker") {
      await util.filepicker(argv)
    } else if (cmd === "upload") {
      await util.upload(argv)
    } else if (cmd === "download") {
      await util.appDownload(argv)
    } else if (cmd === "registry") {
      const subcmd = argv._.length > 1 ? String(argv._[1]).toLowerCase() : ""
      if (subcmd === "search") {
        await util.registrySearch(argv)
      } else {
        console.error("supported subcommands: search")
      }
    } else if (cmd === "search") {
      await util.search(argv)
    } else if (cmd === "stars") {
      await util.stars(argv)
    } else if (cmd === "star") {
      await util.setStar(argv, true)
    } else if (cmd === "unstar") {
      await util.setStar(argv, false)
    } else if (cmd === "which") {
      await util.which(argv)
    } else if (cmd === "home") {
      await util.home(argv)
    } else if (cmd === "status") {
      await util.status(argv)
    } else if (cmd === "logs") {
      await util.logs(argv)
    } else if (cmd === "stop") {
      await script.stop(argv)
    } else if (cmd === "start") {
      if (argv._.length > 1) {
        let uri = argv._[1]
        const startTarget = await resolveStartTarget(uri, argv.ref)
        const startInput = extractStartInput(argv)
        const startPayload = startInput
          ? { uri: startTarget.uri, input: startInput }
          : startTarget.uri
        await script.start(startPayload, true, null, startTarget.controlPlane)
      } else {
        console.error("required argument: <uri>")
      }
    } else if (cmd === "run") {
      if (argv._.length > 1) {
        let _uri = argv._[1]
        const runTarget = await resolveAppControlTarget(_uri)
        const uri = runTarget.uri
        // try downloading first
        if (isHttpUri(uri)) {
          await util.download({
            ...argv,
            no_exit: true
          })
        }
        let launched = false
        while(true) {
          let default_target = await script.default_script(uri, argv.default, runTarget.controlPlane)
          if (default_target) {
            launched = true
            if (path.isAbsolute(default_target.uri)) {
              await new Promise((resolve, reject) => {
                script.start(default_target, false, (packet) => {
                  if (packet.type === "result") {
                    resolve()
                  }
                }, runTarget.controlPlane)
              })
              if (script.killed) {
                break
              }
            } else {
              // default behavior is no browser side effect.
              if (argv.open) {
                let response = await util.open_url(default_target.uri)
                console.log({ response })
              } else {
                console.log(default_target.uri)
              }
              break
            }
          } else {
            break
          }
        }
        if (script.killed) {
          process.exit()
        }
        if (!launched) {
          process.exit(0)
        }
      } else {
        console.error("required argument: <uri>")
      }
    }
  }
})();
