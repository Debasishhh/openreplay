export type Offset = [/*left:*/ number, /*top: */ number]

interface OffsetState {
  iframe: HTMLIFrameElement
  parent: Document
  offset: Offset | null
  gen: number
}

/**
 * Iframe offsets for mouse coordinates, cached until the parent document scrolls or
 * resizes. One listener per parent document (not per iframe), and state keyed by the
 * frame's document only, so removed iframes and their documents can be collected.
 */
export default class IFrameOffsets {
  private states = new WeakMap<Document, OffsetState>()
  private gens = new WeakMap<Document, number>()
  private listeners: Array<{ target: EventTarget; type: string; fn: () => void }> = []
  private listening = new WeakSet<Document>()

  observe(iframe: HTMLIFrameElement) {
    const doc = iframe.contentDocument
    if (!doc) return
    const parent = iframe.ownerDocument
    this.states.set(doc, { iframe, parent, offset: null, gen: -1 })
    if (this.listening.has(parent)) return
    this.listening.add(parent)
    const bump = () => this.gens.set(parent, (this.gens.get(parent) ?? 0) + 1)
    parent.addEventListener('scroll', bump)
    this.listeners.push({ target: parent, type: 'scroll', fn: bump })
    const win = parent.defaultView
    if (win) {
      win.addEventListener('resize', bump)
      this.listeners.push({ target: win, type: 'resize', fn: bump })
    }
  }

  getDocumentOffset(doc: Document): Offset {
    const state = this.states.get(doc)
    if (!state) return [0, 0]
    const [parentLeft, parentTop] = this.getDocumentOffset(state.parent)
    const gen = this.gens.get(state.parent) ?? 0
    if (state.offset === null || state.gen !== gen) {
      const { left, top } = state.iframe.getBoundingClientRect()
      state.offset = [left, top]
      state.gen = gen
    }
    return [parentLeft + state.offset[0], parentTop + state.offset[1]]
  }

  clear() {
    for (const l of this.listeners) l.target.removeEventListener(l.type, l.fn)
    this.listeners = []
    this.states = new WeakMap()
    this.gens = new WeakMap()
    this.listening = new WeakSet()
  }
}
