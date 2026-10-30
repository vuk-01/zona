import * as React from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    // Zona: bg-overlay token instead of bg-black/50 (DESIGN.md: colors only from tokens). It fades in
    // 200ms and out, with reduced motion too but shorter (a fade does not move anything)
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-overlay duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:ease-in data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:ease-out motion-reduce:duration-150',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  // Zona: the overlay's classes, e.g. a phone sheet's own fade timing
  overlayClassName?: string
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className={overlayClassName} />
      {/* Zona: a floating card (rounded-xl, bg-card, shadow-soft). Motion (DESIGN.md "Motion"): on md+ it
          fades and zooms from 95% in 200ms, and back on close; with reduced motion only a short fade, at
          every width. On phones the caller brings its own motion (the login dialog slides up as a sheet),
          so the two sets never compete for the same element. */}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border bg-card p-6 shadow-soft outline-none sm:max-w-lg',
          'md:motion-safe:duration-200 md:motion-safe:data-[state=closed]:animate-out md:motion-safe:data-[state=closed]:fade-out-0 md:motion-safe:data-[state=closed]:zoom-out-95 md:motion-safe:data-[state=closed]:ease-in md:motion-safe:data-[state=open]:animate-in md:motion-safe:data-[state=open]:fade-in-0 md:motion-safe:data-[state=open]:zoom-in-95 md:motion-safe:data-[state=open]:ease-out',
          'motion-reduce:duration-150 motion-reduce:data-[state=closed]:animate-out motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:animate-in motion-reduce:data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          // Zona: a round ghost icon button with a 44px tap target on phones and the full focus ring
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none md:top-4 md:right-4 md:size-9 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5"
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
