import { cva } from 'class-variance-authority'
import { useState } from 'react'

const thumbVariants = cva(
  'overflow-hidden rounded-lg border-2 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      selected: {
        true: 'border-primary',
        false: 'border-transparent opacity-80 hover:opacity-100',
      },
    },
  },
)

type SpaceGalleryProps = {
  images: string[]
  name: string
}

// One large 16:10 photo; the thumbnails underneath switch it.
export function SpaceGallery({ images, name }: SpaceGalleryProps) {
  const [current, setCurrent] = useState(0)
  const shown = images[current] ?? images[0]

  return (
    <div className="flex flex-col gap-3">
      <img
        src={shown}
        alt={`${name}, photo ${current + 1} of ${images.length}`}
        className="aspect-[16/10] w-full rounded-lg bg-muted object-cover"
      />
      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-2 md:gap-3" aria-label="Photos">
          {images.map((image, index) => (
            <li key={image}>
              <button
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === current}
                className={thumbVariants({ selected: index === current })}
                onClick={() => setCurrent(index)}
              >
                <img src={image} alt="" className="aspect-[16/10] w-full bg-muted object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
