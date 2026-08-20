export default function ServerBar({ servers, selectedServerId, onSelectDM, onSelectServer, onCreateServer }) {
  return (
    <nav className="server-bar">
      <button
        className={`server-bar-item dm ${selectedServerId == null ? 'active' : ''}`}
        onClick={onSelectDM}
        title="Mensagens diretas"
      >
        ✉️
      </button>
      <div className="server-bar-sep" />
      {servers.map((s) => (
        <button
          key={s.id}
          className={`server-bar-item ${selectedServerId === s.id ? 'active' : ''}`}
          onClick={() => onSelectServer(s.id)}
          title={s.name}
        >
          {s.name.charAt(0).toUpperCase()}
        </button>
      ))}
      <button className="server-bar-item add" onClick={onCreateServer} title="Criar servidor">
        +
      </button>
    </nav>
  )
}
