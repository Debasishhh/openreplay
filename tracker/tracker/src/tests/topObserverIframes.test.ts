import { describe, expect, test, afterEach, jest } from '@jest/globals'
import TopObserver from '../main/app/observer/top_observer.js'
import Nodes from '../main/app/nodes/index.js'
import Sanitizer from '../main/app/sanitizer.js'
import { Type } from '../common/messages.gen.js'

let sent: any[]
let observer: TopObserver

function setup(body: string) {
  document.documentElement.innerHTML = `<head></head><body>${body}</body>`
  sent = []
  const app: any = {
    options: { forceNgOff: true },
    safe: (f: any) => f,
    send: (msg: any) => sent.push(msg),
    getBaseHref: () => 'http://localhost/',
    debug: { log: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  }
  app.nodes = new Nodes({ node_id: '__openreplay_id', forceNgOff: true, maintainer: { enabled: false } })
  app.sanitizer = new Sanitizer({ app, options: { obscureTextEmails: false } })
  app.attributeSender = {
    sendSetAttribute: (id: number, name: string, value: string) =>
      app.send([Type.SetNodeAttribute, id, name, value]),
  }
  observer = new TopObserver({ app, options: { disableThrottling: true } })
}

const frameText = (html: string) => {
  ;(document.getElementById('f') as HTMLIFrameElement).contentDocument!.body.innerHTML = html
}
// iframes are picked up after a 250ms delay
const waitFrames = () => new Promise((r) => setTimeout(r, 300))
const ofType = (t: number) => sent.filter((m) => m[0] === t)
const allData = () => ofType(Type.SetNodeData).map((m) => m[2]).join('|')

afterEach(() => {
  observer.disconnect()
})

describe('TopObserver iframes and privacy', () => {
  test('iframe content inherits a masked ancestor', async () => {
    setup('<div data-openreplay-obscured><iframe id="f"></iframe></div>')
    frameText('<p>card 4111</p>')
    observer.observe()
    await waitFrames()
    expect(ofType(Type.CreateIFrameDocument)).toHaveLength(1)
    expect(allData()).toContain('****')
    expect(allData()).not.toContain('4111')
  })

  test('a hidden iframe and an iframe under a hidden ancestor are not recorded inside', async () => {
    setup('<iframe id="f" data-openreplay-hidden data-openreplay-capture></iframe>')
    frameText('<p>card 4111</p>')
    observer.observe()
    await waitFrames()
    expect(ofType(Type.CreateIFrameDocument)).toHaveLength(0)
    expect(allData()).not.toContain('4111')
    observer.disconnect()

    setup('<div data-openreplay-hidden><iframe id="f"></iframe></div>')
    frameText('<p>card 4111</p>')
    observer.observe()
    await waitFrames()
    expect(ofType(Type.CreateIFrameDocument)).toHaveLength(0)
    expect(allData()).not.toContain('4111')
  })

  test('a plain iframe is still recorded', async () => {
    setup('<iframe id="f"></iframe>')
    frameText('<p>hello</p>')
    observer.observe()
    await waitFrames()
    expect(ofType(Type.CreateIFrameDocument)).toHaveLength(1)
    expect(allData()).toContain('hello')
  })
})
