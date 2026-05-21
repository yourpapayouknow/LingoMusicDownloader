import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Box, HStack, Icon, Text, VStack, cx } from './primitives'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}) {
  return (
    <button className={cx('ui-button', `ui-button-${variant}`, `ui-button-${size}`, className)} {...props}>
      {leadingIcon ? <span className="ui-button-icon">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="ui-button-icon">{trailingIcon}</span> : null}
    </button>
  )
}

export function IconButton({
  className,
  variant = 'ghost',
  size = 38,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: number
}) {
  return (
    <button
      className={cx('ui-icon-button', `ui-icon-button-${variant}`, className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
    </button>
  )
}

export function FAB({
  className,
  children,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { style?: CSSProperties }) {
  return (
    <button className={cx('ui-fab', className)} style={style} {...props}>
      {children}
    </button>
  )
}

export type MenuOption = {
  label: string
  value: string
}

export function Menu({
  label,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: MenuOption[] }) {
  return (
    <label className={cx('ui-field', 'ui-menu-field', className)}>
      {label ? <Text className="ui-field-label">{label}</Text> : null}
      <div className={cx('ui-select-wrap', props.disabled && 'is-disabled')}>
        <select className="ui-select ui-menu-select" {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="ui-select-arrow" />
      </div>
    </label>
  )
}

export function TextField({
  label,
  prefix,
  error,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label?: string
  prefix?: ReactNode
  error?: string
}) {
  return (
    <label className={cx('ui-field', className)}>
      {label ? <Text className="ui-field-label">{label}</Text> : null}
      <span className={cx('ui-input-wrap', error && 'ui-input-error')}>
        {prefix ? <span className="ui-input-prefix">{prefix}</span> : null}
        <input className="ui-input" {...props} />
      </span>
      {error ? <Text tone="error" className="ui-field-error">{error}</Text> : null}
    </label>
  )
}

export function TextArea({
  label,
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
}) {
  return (
    <label className={cx('ui-field', className)}>
      {label ? <Text className="ui-field-label">{label}</Text> : null}
      <textarea className={cx('ui-textarea', error && 'ui-input-error')} {...props} />
      {error ? <Text tone="error" className="ui-field-error">{error}</Text> : null}
    </label>
  )
}

export function Toggle({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }) {
  const id = useId()

  return (
    <label className={cx('ui-toggle', className)} htmlFor={id}>
      <input id={id} type="checkbox" className="ui-toggle-input" {...props} />
      <span className="ui-toggle-track">
        <span className="ui-toggle-thumb" />
      </span>
      {label ? <Text className="ui-toggle-label">{label}</Text> : null}
    </label>
  )
}

export function Checkbox({
  label,
  indeterminate,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode
  indeterminate?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate)
    }
  }, [indeterminate])

  return (
    <label className={cx('ui-checkbox', className)} htmlFor={id}>
      <input ref={ref} id={id} type="checkbox" className="ui-checkbox-input" {...props} />
      <span className="ui-checkbox-box">
        <Icon name={indeterminate ? 'alert' : 'check'} size={14} className="ui-checkbox-icon" />
      </span>
      {label ? <Text>{label}</Text> : null}
    </label>
  )
}

export function RadioGroup({
  label,
  name,
  value,
  options,
  onChange,
  horizontal,
}: {
  label?: string
  name: string
  value: string
  options: MenuOption[]
  onChange: (nextValue: string) => void
  horizontal?: boolean
}) {
  return (
    <VStack gap="compact" className="ui-field">
      {label ? <Text className="ui-field-label">{label}</Text> : null}
      <div className={cx('ui-radio-group', horizontal && 'ui-radio-group-horizontal')}>
        {options.map((option) => (
          <label key={option.value} className="ui-radio">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="ui-radio-dot" />
            <Text>{option.label}</Text>
          </label>
        ))}
      </div>
    </VStack>
  )
}

export function Slider({
  label,
  value,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  value: number
}) {
  return (
    <label className={cx('ui-field', className)}>
      <HStack justify="space-between" align="center" gap="compact">
        {label ? <Text className="ui-field-label">{label}</Text> : <span />}
        <Text>{Math.round(value)}</Text>
      </HStack>
      <input type="range" className="ui-slider" value={value} {...props} />
    </label>
  )
}

export function Segmented({
  options,
  value,
  onChange,
  className,
}: {
  options: MenuOption[]
  value: string
  onChange: (nextValue: string) => void
  className?: string
}) {
  return (
    <div className={cx('ui-segmented', className)} role="tablist" aria-label="Segmented control">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={cx('ui-segmented-item', active && 'active')}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ size = 22, className }: { size?: number; className?: string }) {
  return <span className={cx('ui-spinner', className)} style={{ width: size, height: size }} aria-label="Loading" />
}

export function ProgressBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const percent = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cx('ui-progress', className)} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="ui-progress-bar" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children?: ReactNode
  tone?: 'default' | 'info' | 'error' | 'success'
  className?: string
}) {
  return <span className={cx('ui-badge', `ui-badge-${tone}`, className)}>{children}</span>
}

export type ToastTone = 'info' | 'success' | 'error'

export type ToastItem = {
  id: string
  title: string
  description?: string
  tone?: ToastTone
}

export function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="ui-toast-viewport" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <article key={item.id} className={cx('ui-toast', `ui-toast-${item.tone ?? 'info'}`)}>
          <VStack gap={6}>
            <HStack justify="space-between" align="center" gap={8}>
              <Text weight={700}>{item.title}</Text>
              <IconButton aria-label="Dismiss" onClick={() => onDismiss(item.id)}>
                <Icon name="close" size={14} />
              </IconButton>
            </HStack>
            {item.description ? <Text tone="secondary">{item.description}</Text> : null}
          </VStack>
        </article>
      ))}
    </div>
  )
}

export function Dialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onOpenChange: (nextOpen: boolean) => void
  onConfirm?: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
    }

    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    const handleCancel = (event: Event) => {
      event.preventDefault()
      onOpenChange(false)
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
    }
  }, [onOpenChange])

  return (
    <dialog className="ui-dialog" ref={dialogRef}>
      <VStack gap="normal">
        <VStack gap="compact">
          <Text as="h3" className="ui-dialog-title">
            {title}
          </Text>
          {description ? <Text tone="secondary">{description}</Text> : null}
        </VStack>
        <HStack justify="flex-end" gap="compact">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              onConfirm?.()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Button>
        </HStack>
      </VStack>
    </dialog>
  )
}

export function Skeleton({ className, width = '100%', height = 16, rounded = true }: { className?: string; width?: string | number; height?: string | number; rounded?: boolean }) {
  return (
    <span
      className={cx('ui-skeleton', className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: rounded ? 'var(--radius-control)' : 0,
      }}
      aria-hidden="true"
    />
  )
}

export function TopAppBar({
  title,
  onMenu,
  actions,
}: {
  title: string
  onMenu?: () => void
  actions?: ReactNode
}) {
  return (
    <header className="ui-topbar">
      <HStack align="center" gap="compact">
        {onMenu ? (
          <IconButton aria-label="Open menu" onClick={onMenu}>
            <Icon name="menu" />
          </IconButton>
        ) : null}
        <Text as="h1" className="ui-topbar-title">
          {title}
        </Text>
      </HStack>
      <HStack align="center" gap="compact">
        {actions}
      </HStack>
    </header>
  )
}

export function BottomBar({
  items,
  active,
  onChange,
}: {
  items: Array<{ value: string; label: string; icon: ReactNode; badge?: number }>
  active: string
  onChange: (value: string) => void
}) {
  // Keep indicator in sync with selected item; CSS uses this index for slide animation.
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === active),
  )

  const style = {
    '--item-count': String(Math.max(1, items.length)),
    '--active-index': String(activeIndex),
  } as CSSProperties

  return (
    <nav className="ui-bottombar" aria-label="Primary navigation" style={style}>
      <span className="ui-bottombar-indicator" aria-hidden="true" />
      {items.map((item) => {
        const selected = active === item.value
        return (
          <button
            key={item.value}
            type="button"
            className={cx('ui-bottombar-item', selected && 'active')}
            onClick={() => onChange(item.value)}
          >
            <span className="ui-bottombar-icon-wrap">
              {item.icon}
              {item.badge ? <Badge className="ui-bottombar-badge">{item.badge}</Badge> : null}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: MenuOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cx('ui-tabs', className)} role="tablist" aria-label="Tabs">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx('ui-tab', active && 'active')}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children?: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <>
      <button
        type="button"
        className={cx('ui-drawer-overlay', open && 'open')}
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className={cx('ui-drawer', open && 'open')} aria-hidden={!open}>
        <HStack justify="space-between" align="center">
          <Text as="h2" className="ui-drawer-title">
            {title}
          </Text>
          <IconButton aria-label="Close drawer" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </HStack>
        <DividerSpacer />
        {children}
      </aside>
    </>
  )
}

function DividerSpacer() {
  return <span className="ui-drawer-divider" aria-hidden="true" />
}

export function Card({ children, className, ...props }: { children?: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Box className={cx('ui-card', className)} surface blurPanel radius="container" padding="normal" border {...props}>
      {children}
    </Box>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button type="button" className={cx('ui-chip', selected && 'selected', className)} onClick={onClick}>
      {children}
    </button>
  )
}

export function Accordion({
  items,
  className,
}: {
  items: Array<{ title: string; content: ReactNode }>
  className?: string
}) {
  return (
    <VStack gap="compact" className={cx('ui-accordion', className)}>
      {items.map((item) => (
        <details key={item.title} className="ui-accordion-item">
          <summary className="ui-accordion-summary">
            <Text weight={700}>{item.title}</Text>
            <Icon name="chevronDown" className="ui-accordion-chevron" />
          </summary>
          <div className="ui-accordion-content">{item.content}</div>
        </details>
      ))}
    </VStack>
  )
}

export function VirtualList<T>({
  items,
  rowHeight,
  height,
  renderItem,
  className,
}: {
  items: T[]
  rowHeight: number
  height: number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}) {
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * rowHeight
  // Render viewport rows + small overscan buffer to avoid flicker while scrolling.
  const visibleCount = Math.ceil(height / rowHeight) + 4
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2)
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex])

  return (
    <div className={cx('ui-virtual-list', className)} style={{ height }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, localIndex) => {
          const index = startIndex + localIndex
          return (
            <div
              key={index}
              className="ui-virtual-row"
              style={{
                position: 'absolute',
                top: index * rowHeight,
                height: rowHeight,
                insetInline: 0,
              }}
            >
              {renderItem(item, index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
