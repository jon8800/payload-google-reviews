'use client'

import { useState } from 'react'
import { toast, useConfig } from '@payloadcms/ui'
import { RefreshCw } from 'lucide-react'
import type { SyncReviewsButtonProps } from '../globals/reviewSettings.js'
import { SYNC_ENDPOINT_PATH } from '../options.js'

import './syncReviewsButton.scss'

export function SyncReviewsButton({ scheduleLabel }: SyncReviewsButtonProps) {
  const { config } = useConfig()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const url = `${config.serverURL ?? ''}${config.routes.api}${SYNC_ENDPOINT_PATH}`
      const res = await fetch(url, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Sync failed (${res.status})`)
      }
      toast.success(data.message || 'Reviews synced. Refresh the page to see the new data.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync reviews')
    } finally {
      setSyncing(false)
    }
  }

  const scheduleText = scheduleLabel
    ? `Reviews also sync automatically ${scheduleLabel}, when the site runs scheduled jobs.`
    : 'Automatic sync is off. Reviews sync only when you press this button.'

  return (
    <div className="sync-reviews">
      <button
        type="button"
        className="sync-reviews__button"
        onClick={handleSync}
        disabled={syncing}
      >
        <RefreshCw className={`sync-reviews__icon ${syncing ? 'sync-reviews__icon--spinning' : ''}`} size={16} />
        {syncing ? 'Syncing...' : 'Sync Reviews Now'}
      </button>
      <p className="sync-reviews__description">
        Manually trigger a Google Reviews sync. {scheduleText}
      </p>
    </div>
  )
}
