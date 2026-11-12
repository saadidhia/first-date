import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  type ShareCardInput,
  canShareImage,
  downloadImage,
  makeShareCard,
  shareImage,
} from '@/lib/share-card'
import { withGuardPaused } from '@/lib/use-screenshot-guard'
import { cn } from '@/lib/utils'

/**
 * Makes a story image of the result (score only, no answers) and shows it in a preview, with
 * "share" on phones (the share sheet, for an Instagram story) and "download" everywhere.
 */
export function ShareResultButton({
  input,
  friends,
  note = 'الصورة فيها النسبة برك، حتى جواب ما يبان 🤫',
}: {
  input: ShareCardInput
  friends: boolean
  /** The small line under the button: what the picture shows */
  note?: string
}) {
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState<{
    blob: Blob
    url: string
    share: boolean
  } | null>(null)

  useEffect(() => {
    if (!image) return
    return () => URL.revokeObjectURL(image.url)
  }, [image])

  async function open() {
    setBusy(true)
    try {
      const blob = await makeShareCard(input)
      setImage({
        blob,
        url: URL.createObjectURL(blob),
        share: canShareImage(blob),
      })
    } catch {
      toast.error('ما نجّمناش نعملو الصورة، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!image) return
    try {
      const done = await withGuardPaused(() =>
        shareImage(image.blob, `${input.cta} ${window.location.origin}`),
      )
      if (done) setImage(null)
    } catch {
      // The share sheet failed: the download still works
      toast.error('ما نجّمناش نفتحو المشاركة، سجّل الصورة وحطّها في الستوري')
    }
  }

  function download() {
    if (!image) return
    downloadImage(image.blob)
    toast.success('الصورة تسجّلت 📸 حطّها في الستوري من التليفون')
  }

  const btn = friends ? 'bubble-friends' : 'btn-love'
  return (
    <div>
      <Button
        onClick={open}
        disabled={busy}
        className={cn(
          'h-12 w-full rounded-xl text-base font-semibold text-white',
          btn,
        )}
      >
        <Share2 className="size-4" />
        {busy ? 'لحظة…' : 'شارك النتيجة في الستوري 📸'}
      </Button>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">{note}</p>

      <Dialog open={!!image} onOpenChange={(o) => !o && setImage(null)}>
        <DialogContent className="max-w-sm gap-3 rounded-3xl p-4 sm:max-w-sm">
          <DialogTitle className="text-center font-display text-lg">
            صورة الستوري متاعك 📸
          </DialogTitle>
          <DialogDescription className="sr-only">
            معاينة الصورة قبل ما تشاركها
          </DialogDescription>
          {image && (
            <img
              src={image.url}
              alt="صورة النتيجة"
              className="mx-auto max-h-[55dvh] w-auto rounded-2xl border border-border"
            />
          )}
          <div className="grid gap-2">
            {image?.share && (
              <Button
                onClick={share}
                className={cn('h-11 rounded-xl text-white', btn)}
              >
                <Share2 className="size-4" /> شارك (ستوري، واتساب…)
              </Button>
            )}
            <Button
              onClick={download}
              variant={image?.share ? 'outline' : 'default'}
              className={cn(
                'h-11 rounded-xl',
                !image?.share && cn('text-white', btn),
              )}
            >
              <Download className="size-4" /> سجّل الصورة
            </Button>
            {!image?.share && (
              <p className="text-center text-xs text-muted-foreground">
                سجّلها وابعثها لتليفونك، وحطّها في الستوري من إنستغرام 📲
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
