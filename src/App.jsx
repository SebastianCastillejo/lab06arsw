import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './lib/api.js'
import { useRealtime } from './hooks/useRealtime.js'
import BlueprintCanvas from './components/BlueprintCanvas.jsx'
import AuthorPanel from './components/AuthorPanel.jsx'

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,50}$/

const STATUS_LABEL = {
  idle: 'Sin tiempo real',
  connecting: 'Conectando…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  error: 'Error de conexión',
}

export default function App() {
  const [tech, setTech] = useState('stomp')
  const [authorInput, setAuthorInput] = useState('juan')
  const [author, setAuthor] = useState('juan')
  const [blueprints, setBlueprints] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [selected, setSelected] = useState(null) // blueprint name
  const [points, setPoints] = useState([])
  const [pending, setPending] = useState([]) // clicks made while the RT connection was down
  const [dirty, setDirty] = useState(false)
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState(null) // { type: 'error' | 'ok', text }

  // Latest values for async callbacks (reconnect resync) that must not act on stale state.
  const latest = useRef({})
  latest.current = { points, pending, author, selected }
  const resyncBuffer = useRef(null) // RT updates received while a resync GET is in flight

  const notify = (type, text) => setMessage({ type, text })
  const fail = (err) => notify('error', err.message)
  const unsaved = dirty || pending.length > 0

  const refreshList = useCallback(async (who) => {
    setLoadingList(true)
    try {
      setBlueprints(await api.listByAuthor(who))
    } catch (err) {
      setBlueprints([])
      fail(err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    refreshList(author)
  }, [author, refreshList])

  // Initial state of the selected blueprint.
  useEffect(() => {
    setPending([])
    if (!selected) {
      setPoints([])
      return
    }
    let cancelled = false
    api
      .getBlueprint(author, selected)
      .then((bp) => !cancelled && (setPoints(bp.points), setDirty(false)))
      .catch((err) => !cancelled && fail(err))
    return () => {
      cancelled = true
    }
  }, [author, selected])

  const applyUpdate = useCallback((upd) => {
    setPoints((prev) => [...prev, ...upd.points])
    setBlueprints((list) =>
      list.map((bp) =>
        bp.name === upd.name
          ? { ...bp, totalPoints: upd.totalPoints ?? bp.totalPoints + upd.points.length }
          : bp,
      ),
    )
  }, [])

  const onRemoteUpdate = useCallback(
    (upd) => (resyncBuffer.current ? resyncBuffer.current.push(upd) : applyUpdate(upd)),
    [applyUpdate],
  )

  /**
   * After a reconnection: with STOMP the server is the source of truth, so fetch the blueprint again
   * (we may have missed other tabs' points, or the server may have lost data on restart). Then send
   * the clicks that were queued while offline.
   */
  async function onReconnect(sendPoint) {
    const { author: who, selected: name } = latest.current
    const stillHere = () => latest.current.author === who && latest.current.selected === name

    if (tech === 'stomp') {
      resyncBuffer.current = []
      try {
        const bp = await api.getBlueprint(who, name).catch((err) => {
          if (err.status === 404) return null
          throw err
        })
        if (!stillHere()) return
        const buffered = resyncBuffer.current
        const serverCount = bp?.totalPoints ?? 0
        const local = latest.current.points
        if (bp && serverCount >= local.length) {
          // Updates that arrived during the GET and are not included in its snapshot.
          const missed = buffered.filter((u) => u.totalPoints > serverCount).flatMap((u) => u.points)
          setPoints([...bp.points, ...missed])
          setDirty(false)
          notify('ok', `Reconectado: plano sincronizado con el servidor (${serverCount + missed.length} puntos)`)
        } else {
          // The server lost data (in-memory store restarted): keep what we have so the user can restore it.
          setPoints([...local, ...buffered.flatMap((u) => u.points)])
          setDirty(true)
          notify(
            'error',
            `El servidor tiene ${serverCount} puntos y la pantalla ${local.length} (¿se reinició?). ` +
              'Pulsa Save/Update para restaurar el plano.',
          )
        }
      } catch (err) {
        fail(err)
      } finally {
        resyncBuffer.current = null
      }
      refreshList(who)
    } else {
      notify('ok', 'Reconectado')
    }

    const queued = latest.current.pending
    if (!queued.length || !stillHere()) return
    setPending([])
    queued.forEach((p) => sendPoint(p))
    // STOMP echoes the queued points back (and stores them); Socket.IO does not, so add them here.
    if (tech !== 'stomp') {
      setPoints((prev) => [...prev, ...queued])
      setDirty(true)
    }
  }

  const { status, sendPoint, echoesToSender } = useRealtime(tech, author, selected, {
    onUpdate: onRemoteUpdate,
    onReconnect,
  })

  function confirmDiscard() {
    return !unsaved || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')
  }

  function handleTechChange(e) {
    // Queued clicks belong to the old connection: keep them as regular unsaved points.
    if (pending.length) {
      setPoints((prev) => [...prev, ...pending])
      setPending([])
      setDirty(true)
    }
    setTech(e.target.value)
  }

  function handleSearch(e) {
    e.preventDefault()
    const who = authorInput.trim()
    if (!NAME_PATTERN.test(who)) return notify('error', 'Autor inválido: solo letras, números, "_" o "-"')
    if (!confirmDiscard()) return
    setMessage(null)
    setSelected(null)
    if (who === author) refreshList(who)
    else setAuthor(who)
  }

  function handleSelect(name) {
    if (name === selected || !confirmDiscard()) return
    setMessage(null)
    setSelected(name)
  }

  function handlePoint(point) {
    if (tech === 'none') {
      setPoints((prev) => [...prev, point])
      setDirty(true)
      return
    }
    if (sendPoint(point)) {
      // STOMP echoes the point back (already persisted); Socket.IO does not, so draw it locally.
      if (!echoesToSender) {
        setPoints((prev) => [...prev, point])
        setDirty(true)
      }
      return
    }
    setPending((prev) => [...prev, point])
    notify('error', 'Sin conexión de tiempo real: el punto se enviará al reconectar')
  }

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!NAME_PATTERN.test(name)) return notify('error', 'Nombre inválido: solo letras, números, "_" o "-"')
    if (!confirmDiscard()) return
    try {
      await api.createBlueprint(author, name)
      await refreshList(author)
      setNewName('')
      setSelected(name)
      notify('ok', `Plano "${name}" creado`)
    } catch (err) {
      fail(err)
    }
  }

  async function handleSave() {
    const all = [...points, ...pending]
    try {
      await api.updateBlueprint(author, selected, all).catch((err) => {
        // The blueprint may be gone after a server restart: recreate it with what is on screen.
        if (err.status === 404) return api.createBlueprint(author, selected, all)
        throw err
      })
      setPoints(all)
      setPending([])
      setDirty(false)
      await refreshList(author)
      notify('ok', `Plano "${selected}" guardado (${all.length} puntos)`)
    } catch (err) {
      fail(err)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el plano "${selected}"?`)) return
    try {
      await api.deleteBlueprint(author, selected)
      notify('ok', `Plano "${selected}" eliminado`)
      setDirty(false)
      setSelected(null)
      await refreshList(author)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>BluePrints RT</h1>
        <div className="rt">
          <label htmlFor="tech">Tiempo real</label>
          <select id="tech" value={tech} onChange={handleTechChange}>
            <option value="none">None</option>
            <option value="stomp">STOMP (Spring)</option>
            <option value="socketio">Socket.IO (Node)</option>
          </select>
          <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>
        </div>
      </header>

      <form className="row" onSubmit={handleSearch}>
        <input value={authorInput} onChange={(e) => setAuthorInput(e.target.value)} placeholder="autor" />
        <button type="submit">Consultar</button>
      </form>

      {message && (
        <p className={`msg msg--${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
          <button className="link" onClick={() => setMessage(null)} aria-label="Cerrar">
            ×
          </button>
        </p>
      )}

      <main className="layout">
        <AuthorPanel
          author={author}
          blueprints={blueprints}
          selectedName={selected}
          loading={loadingList}
          onSelect={handleSelect}
        />

        <section className="panel">
          <div className="toolbar">
            <form className="row" onSubmit={handleCreate}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="nuevo plano" />
              <button type="submit">Create</button>
            </form>
            <div className="row">
              <button onClick={handleSave} disabled={!selected || !unsaved}>
                Save/Update
              </button>
              <button className="danger" onClick={handleDelete} disabled={!selected}>
                Delete
              </button>
            </div>
          </div>

          <h3>
            {selected ? `${author} / ${selected}` : 'Selecciona un plano'}
            {unsaved && <span className="unsaved"> · sin guardar</span>}
          </h3>
          <BlueprintCanvas points={points} pending={pending} disabled={!selected} onPoint={handlePoint} />
          <p className="muted" data-testid="count">
            {points.length} puntos
            {pending.length > 0 && ` · ${pending.length} pendientes de enviar`} · Abre dos pestañas en el mismo
            plano para ver la colaboración.
            {tech === 'stomp' && ' Con STOMP cada punto se guarda automáticamente.'}
          </p>
        </section>
      </main>
    </div>
  )
}
