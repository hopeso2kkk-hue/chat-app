export default function DMList({ users, me, selected, onSelect }) {
  const others = users.filter((u) => u.id !== me.id)

  return (
    <aside className="dm-list">
      <div className="dm-list-title">Mensagens diretas</div>
      <div className="dm-list-items">
        {others.length === 0 && (
          <div className="dm-empty">Ninguém online ainda.<br />Abra em outra aba ou peça a um amigo para entrar.</div>
        )}
        {others.map((u) => (
          <button
            key={u.id}
            className={`dm-item ${selected === u.id ? 'active' : ''}`}
            onClick={() => onSelect(u.id)}
          >
            <span className="avatar">
              {u.name.charAt(0).toUpperCase()}
              <span className="online-dot" />
            </span>
            <span className="dm-name">{u.name}</span>
          </button>
        ))}
      </div>
      <div className="dm-me">
        <span className="avatar">{me.name.charAt(0).toUpperCase()}</span>
        <div>
          <div className="dm-name">{me.name}</div>
          <div className="dm-status">Online</div>
        </div>
      </div>
    </aside>
  )
}
