export default function AuthorPanel({ author, blueprints, selectedName, loading, onSelect }) {
  const total = blueprints.reduce((sum, bp) => sum + bp.totalPoints, 0)

  return (
    <section className="panel">
      <h3>Planos de {author || '—'}</h3>
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : blueprints.length === 0 ? (
        <p className="muted">Este autor no tiene planos.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Plano</th>
              <th className="num">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {blueprints.map((bp) => (
              <tr
                key={bp.name}
                className={bp.name === selectedName ? 'selected' : undefined}
                onClick={() => onSelect(bp.name)}
              >
                <td>{bp.name}</td>
                <td className="num">{bp.totalPoints}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{total}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}
