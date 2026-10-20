import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from '@/components/ui/dialog'
import type { Occurrence } from '@/types/api'

interface Props {
  /** The repeating occurrence the delete started from; null keeps the dialog closed. */
  occurrence: Occurrence | null
  onCancel: () => void
  onConfirm: (occurrence: Occurrence) => void
  /** Lets the page return focus to the block the delete started from. */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Confirms deleting a repeating event. Until single occurrences can be edited,
 * deleting any occurrence removes the whole series, so the dialog says so.
 */
export function DeleteSeriesDialog({ occurrence, onCancel, onConfirm, onCloseAutoFocus }: Props) {
  const title = occurrence?.title || '(No title)'
  return (
    <AlertDialog open={occurrence != null} onOpenChange={(open) => { if (!open) onCancel() }}>
      <AlertDialogContent className="space-y-3 p-5 md:w-[min(420px,92vw)]" onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogTitle className="text-lg font-medium">Delete every “{title}”?</AlertDialogTitle>
        <AlertDialogDescription className="text-sm text-sidebar-foreground/70">
          This removes all events in the series.
        </AlertDialogDescription>
        <div className="flex justify-end gap-2 pt-2">
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={() => { if (occurrence) onConfirm(occurrence) }}>
              Delete all
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
