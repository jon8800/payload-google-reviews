import type { Endpoint } from 'payload'
import { SYNC_ENDPOINT_PATH, SYNC_TASK_SLUG, type ResolvedOptions } from '../options.js'

type JobDoc = {
  error?: unknown
  log?: Array<{ state?: string; error?: unknown }>
}

function messageOf(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return null
}

/** The error message of a failed job: its own error, else the error of its last failed task. */
function jobErrorMessage(job: JobDoc | null): string {
  const failedTask = job?.log?.filter((entry) => entry.state === 'failed').at(-1)
  return messageOf(job?.error) ?? messageOf(failedTask?.error) ?? 'Sync failed. See the server log.'
}

/**
 * POST {api}/google-reviews/sync: queues the sync job and runs that one job now.
 * Answers 500 with the job's error when the sync fails.
 */
export function createSyncEndpoint(resolved: ResolvedOptions): Endpoint {
  return {
    path: SYNC_ENDPOINT_PATH,
    method: 'post',
    handler: async (req) => {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the task slug is not in the site's generated job types here
        const p = req.payload as any

        const job = await p.jobs.queue({ task: SYNC_TASK_SLUG, queue: resolved.queue, input: {} })
        const result = await p.jobs.runByID({ id: job.id })
        const status: string | undefined = result?.jobStatus?.[String(job.id)]?.status

        // No status: another job runner took the job first. It still runs.
        if (!status) {
          return Response.json({ success: true, message: 'Sync started. Refresh the page in a minute to see the result.' })
        }

        if (status !== 'success') {
          const failed: JobDoc | null = await p
            .findByID({ collection: 'payload-jobs', id: job.id, depth: 0, overrideAccess: true })
            .catch(() => null)
          return Response.json({ error: jobErrorMessage(failed) }, { status: 500 })
        }

        return Response.json({ success: true })
      } catch (error) {
        console.error('Manual reviews sync error:', error)
        return Response.json(
          { error: error instanceof Error ? error.message : 'Sync failed' },
          { status: 500 },
        )
      }
    },
  }
}
