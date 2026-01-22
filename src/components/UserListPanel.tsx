import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PrefillUserInput, UserRecord } from '../types'

interface UserListPanelProps {
  users: UserRecord[]
  onAdd: (user: PrefillUserInput) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<PrefillUserInput>) => void
  hideHeader?: boolean
}

export function UserListPanel({ users, onAdd, onRemove, onUpdate, hideHeader }: UserListPanelProps) {
  const [draft, setDraft] = useState<PrefillUserInput>({ firstName: '', lastName: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<PrefillUserInput>({ firstName: '', lastName: '' })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.firstName.trim() && !draft.lastName.trim()) {
      return
    }
    onAdd(draft)
    setDraft({ firstName: '', lastName: '' })
  }

  const startEdit = (user: UserRecord) => {
    setEditingId(user.id)
    setEditingDraft({ firstName: user.firstName, lastName: user.lastName })
  }

  const saveEdit = () => {
    if (!editingId) return
    onUpdate(editingId, { firstName: editingDraft.firstName, lastName: editingDraft.lastName })
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div className={`user-sidebar ${hideHeader ? 'compact' : ''}`}>
      {!hideHeader && (
        <header>
          <div>
            <h2>Participants</h2>
            <p className="hint">Ajoutez, modifiez ou supprimez les participants instantanément.</p>
          </div>
          <span className="badge">{users.length}</span>
        </header>
      )}
      <form className="user-form" onSubmit={handleSubmit}>
        <input
          placeholder="Nom"
          value={draft.lastName}
          onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
        />
        <input
          placeholder="Prénom"
          value={draft.firstName}
          onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
        />
        <button className="btn" type="submit">
          Ajouter
        </button>
      </form>
      <div className="user-scroll">
        {users.map((user) =>
          editingId === user.id ? (
            <form key={user.id} className="user-tile editing" onSubmit={(event) => event.preventDefault()}>
              <div className="fields">
                <input
                  value={editingDraft.lastName}
                  placeholder="Nom"
                  onChange={(event) => setEditingDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                />
                <input
                  value={editingDraft.firstName}
                  placeholder="Prénom"
                  onChange={(event) => setEditingDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                />
              </div>
              <div className="edit-actions">
                <button type="button" className="icon-btn" onClick={saveEdit}>
                  💾
                </button>
                <button type="button" className="icon-btn ghost" onClick={cancelEdit}>
                  ↩
                </button>
              </div>
            </form>
          ) : (
            <div key={user.id} className="user-line">
              <span className="user-name">
                <span className="user-last">{(user.lastName || 'Nom ?').toUpperCase()}</span> {user.firstName}
              </span>
              <div className="line-actions">
                <button type="button" className="icon-btn" onClick={() => startEdit(user)}>
                  ✎
                </button>
                <button type="button" className="icon-btn danger" onClick={() => onRemove(user.id)}>
                  ✕
                </button>
              </div>
            </div>
          )
        )}
        {!users.length && <p className="hint">Aucun participant pour le moment.</p>}
      </div>
    </div>
  )
}
