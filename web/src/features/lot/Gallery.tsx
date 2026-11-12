import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Main photo with previous/next buttons and a thumbnail strip. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0)
  const count = images.length
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <img
          src={images[index]}
          alt={`${title}, photo ${index + 1} of ${count}`}
          className="aspect-4/3 w-full object-cover"
        />
        {count > 1 && (
          <>
            <GalleryButton side="left" label="Previous photo" onClick={() => go(-1)} />
            <GalleryButton side="right" label="Next photo" onClick={() => go(1)} />
            <span className="absolute right-3 bottom-3 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium tabular-nums">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="mt-2 grid grid-cols-6 gap-2">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'block w-full overflow-hidden rounded-md ring-offset-2 ring-offset-background transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  i === index ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100',
                )}
              >
                <img src={src} alt="" loading="lazy" className="aspect-4/3 w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GalleryButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
}
