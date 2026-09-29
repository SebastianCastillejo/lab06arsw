import { useEffect, useRef } from 'react'

const WIDTH = 600
const HEIGHT = 400

/** Draws the confirmed points in blue and the ones still waiting for a connection in dashed grey. */
export default function BlueprintCanvas({ points, pending = [], disabled, onPoint }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, WIDTH, HEIGHT)

    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.beginPath()
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()

    if (pending.length) {
      ctx.save()
      ctx.strokeStyle = '#94a3b8'
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      const from = points.at(-1)
      if (from) ctx.moveTo(from.x, from.y)
      pending.forEach((p, i) => (i === 0 && !from ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      ctx.restore()
    }

    const dot = (p, color) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    points.forEach((p) => dot(p, '#1e3a8a'))
    pending.forEach((p) => dot(p, '#94a3b8'))
  }, [points, pending])

  function handleClick(e) {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Scale from CSS pixels to canvas pixels so clicks stay accurate when the canvas is resized.
    const x = Math.round(((e.clientX - rect.left) * WIDTH) / rect.width)
    const y = Math.round(((e.clientY - rect.top) * HEIGHT) / rect.height)
    onPoint({ x, y })
  }

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className={`canvas${disabled ? ' canvas--disabled' : ''}`}
      onClick={handleClick}
    />
  )
}
