const { WebSocket } = require('unws')
class RPC {
  constructor(url) {
    this.url = url
    this.wsOptions = {
      headers: {
        "x-pinokio-client": "pterm"
      }
    }
  }
  async status(rpc) {
    let res = await new Promise((resolve, reject) => {
      this.run({
        status: true,
        ...rpc
      }, (stream) => {
        resolve(stream.data)
        this.ws.close()
      })
    })
    return res
  }
  close() {
    if (!this.ws) {
      return
    }
    const ws = this.ws
    delete this.ws
    if (typeof ws.terminate === 'function') {
      ws.terminate()
      return
    }
    ws.close()
  }
  stop(rpc) {
    this.run({
      stop: true,
      ...rpc
    })
  }
  run (rpc, ondata) {
    // use fetch
    /*
      FormData := [
        types_array: ['number', 'boolean']
      ]
      body := {

      }
    */
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.send(JSON.stringify(rpc))
      } else {
        const ws = new WebSocket(this.url, this.wsOptions)
        this.ws = ws
        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(rpc))
        });
        ws.addEventListener('message', (message) => {
          /******************************************************************************


          ******************************************************************************/
          if (ondata) {
            const rawMessage = message && typeof message === 'object' && typeof message.data !== 'undefined'
              ? message.data
              : message
            const packetSource = Buffer.isBuffer(rawMessage)
              ? rawMessage.toString('utf8')
              : String(rawMessage)
            const packet = JSON.parse(packetSource);
            ondata(packet)
          }
        });
        ws.addEventListener('close', () => {
//          console.log('Disconnected from WebSocket endpoint', { error: this.error, result: this.result });
          if (this.ws === ws) {
            delete this.ws
          }
          resolve()
        });
      }
    })
  }
  respond(response) {
    if (this.ws) {
      this.ws.send(JSON.stringify(response))
    } else {
      throw new Error("socket not connected")
    }
  }
}
module.exports = RPC
