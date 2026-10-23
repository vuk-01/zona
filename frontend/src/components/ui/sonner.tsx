import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// Zona: the theme comes from src/lib/theme (the zona-theme key), not from next-themes
import { useTheme } from '@/lib/theme'

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      // Zona: bottom right on md+, above the tab bar on phones (--toast-offset in index.css)
      position="bottom-right"
      offset={{ bottom: 'var(--toast-offset)' }}
      mobileOffset={{ bottom: 'var(--toast-offset)' }}
      // Zona: success in primary and errors in destructive, like StatusNotice and FormAlert
      icons={{
        success: <CircleCheckIcon className="size-5 text-primary" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5 text-destructive" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      // Zona: unstyled by sonner and drawn only with tokens (its own styles set a system font, a grey
      // description and an rgba shadow): a floating card with shadow-soft, Poppins, the description in
      // muted-foreground. With reduced motion sonner does not animate the toasts.
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 font-sans text-sm text-card-foreground shadow-soft',
          icon: 'flex shrink-0',
          content: 'flex min-w-0 flex-col gap-0.5',
          title: 'font-semibold',
          description: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
