import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  downloadBackup,
  importBackupJson,
  shareOrDownloadBackup,
} from '../lib/backup'

export function DataScreen() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onShare() {
    setBusy(true)
    setMessage('')
    try {
      const result = await shareOrDownloadBackup()
      setMessage(
        result === 'shared'
          ? 'Shared — save it to Files, Drive, or Messages.'
          : 'Backup downloaded to your device.',
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessage('Share cancelled.')
      } else {
        setMessage('Could not share — try Download instead.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onDownload() {
    setBusy(true)
    setMessage('')
    try {
      const name = await downloadBackup()
      setMessage(`Saved as ${name}`)
    } catch {
      setMessage('Download failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onImport(file: File) {
    if (
      !globalThis.confirm(
        'Replace ALL local Forge data with this backup? Current logs on this device will be overwritten.',
      )
    ) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await importBackupJson(file)
      setMessage('Import complete. Database replaced with the backup file.')
    } catch {
      setMessage('Import failed — check that the file is a Forge JSON backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Link to="/settings" className="btn btn-ghost">
        ← Settings
      </Link>
      <h1>Your data</h1>
      <p className="muted small">
        Everything stays on this phone/browser. Export a JSON file anytime so you
        can move devices or keep a copy.
      </p>

      <div className="card stack" style={{ marginTop: 12 }}>
        <div className="section-label" style={{ marginTop: 0 }}>
          Get a copy
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={onShare}
        >
          Share / save backup
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={busy}
          onClick={onDownload}
        >
          Download JSON file
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          Includes food logs, workouts, weight, check-ins, recipes, and your plan.
        </p>
      </div>

      <div className="card stack" style={{ marginTop: 16 }}>
        <div className="section-label" style={{ marginTop: 0 }}>
          Restore
        </div>
        <label
          className="btn btn-secondary btn-block"
          style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : undefined }}
        >
          Import backup file
          <input
            type="file"
            accept="application/json,.json"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onImport(f)
            }}
          />
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          Replaces all local Forge data with the file. Export a backup first if
          you might need the current logs.
        </p>
      </div>

      {message && (
        <p className="small" style={{ marginTop: 16 }}>
          {message}
        </p>
      )}
    </div>
  )
}
