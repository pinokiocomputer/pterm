const { WebSocket } = require('unws')
class RPC {
  constructor(url) {
    this.url = url
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
    this.ws.close()
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
        this.ws = new WebSocket(this.url)
        this.ws.addEventListener('open', () => {
          this.ws.send(JSON.stringify(rpc))
        });
        this.ws.addEventListener('message', (message) => {
          /******************************************************************************


          ******************************************************************************/
          if (ondata) {
            const packet = JSON.parse(message.data);
            ondata(packet)
          }
        });
        this.ws.addEventListener('close', () => {
//          console.log('Disconnected from WebSocket endpoint', { error: this.error, result: this.result });
          delete this.ws
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
