import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** A native select styled like the shadcn inputs. Native for the best mobile pickers. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    />
  )
}
