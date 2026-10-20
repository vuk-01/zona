import { ImageOff } from 'lucide-react'
import { useState } from 'react'

type PhotoPreviewProps = {
  url: string
}

// A small thumbnail next to a photo link, so the host sees they pasted the right photo. A link that
// does not load (or is not a link yet) shows an icon instead of a broken image.
export function PhotoPreview({ url }: PhotoPreviewProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const canShow = /^https?:\/\/\S+$/.test(url.trim()) && failedUrl !== url

  return (
    <div className="flex aspect-[16/10] w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
      {canShow ? (
        // The link right next to it already says which photo this is
        <img src={url.trim()} alt="" className="size-full object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        <ImageOff className="size-5" aria-hidden="true" />
      )}
    </div>
  )
}
