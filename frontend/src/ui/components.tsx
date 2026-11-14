// 业务高阶UI交互组件库
import {
  useEffect,
  useRef,
  useId,
  type CSSProperties,
  type ReactNode,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from '../head'
import { Bx, HStk, Icn, Txt, VStk, cx } from './primitives'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

// 基础操作按钮组件
export function Btn({
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

export function IcBtn({
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

export type MenuOption = {
  label: string
  value: string
}

export function Mnu({
  label,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: MenuOption[] }) {
  return (
    <label className={cx('ui-field', 'ui-menu-field', className)}>
      {label ? <Txt className="ui-field-label">{label}</Txt> : null}
      <div className={cx('ui-select-wrap', props.disabled && 'is-disabled')}>
        <select className="ui-select ui-menu-select" {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icn name="chevronDown" size={16} className="ui-select-arrow" />
      </div>
    </label>
  )
}

export function TxFld({
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
      {label ? <Txt className="ui-field-label">{label}</Txt> : null}
      <span className={cx('ui-input-wrap', error && 'ui-input-error')}>
        {prefix ? <span className="ui-input-prefix">{prefix}</span> : null}
        <input className="ui-input" {...props} />
      </span>
      {error ? <Txt tone="error" className="ui-field-error">{error}</Txt> : null}
    </label>
  )
}

export function TxAr({
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
      {label ? <Txt className="ui-field-label">{label}</Txt> : null}
      <textarea className={cx('ui-textarea', error && 'ui-input-error')} {...props} />
      {error ? <Txt tone="error" className="ui-field-error">{error}</Txt> : null}
    </label>
  )
}

export function Tgl({
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
      {label ? <Txt className="ui-toggle-label">{label}</Txt> : null}
    </label>
  )
}

export function Chk({
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
        <Icn name={indeterminate ? 'alert' : 'check'} size={14} className="ui-checkbox-icon" />
      </span>
      {label ? <Txt>{label}</Txt> : null}
    </label>
  )
}

export function Seg({
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
    <div className={cx('ui-segmented', className)} role="tablist" aria-label="选项">
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

export function Spn({ size = 22, className }: { size?: number; className?: string }) {
  return <span className={cx('ui-spinner', className)} style={{ width: size, height: size }} aria-label="加载中" />
}

export function Bdg({
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

export function TstVw({
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
          <VStk gap={6}>
            <HStk justify="space-between" align="center" gap={8}>
              <Txt weight={700}>{item.title}</Txt>
              <IcBtn aria-label="关闭" onClick={() => onDismiss(item.id)}>
                <Icn name="close" size={14} />
              </IcBtn>
            </HStk>
            {item.description ? <Txt tone="secondary">{item.description}</Txt> : null}
          </VStk>
        </article>
      ))}
    </div>
  )
}

export function Dlg({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'primary',
  confirmDisabled = false,
  onOpenChange,
  onConfirm,
  children,
}: {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: ButtonVariant
  confirmDisabled?: boolean
  onOpenChange: (nextOpen: boolean) => void
  onConfirm?: () => void
  children?: ReactNode
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
      <VStk gap="normal">
        <VStk gap="compact">
          <Txt as="h3" className="ui-dialog-title">
            {title}
          </Txt>
          {description ? <Txt tone="secondary">{description}</Txt> : null}
        </VStk>
        {children}
        <HStk justify="flex-end" gap="compact">
          <Btn variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Btn>
          <Btn
            variant={confirmVariant}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm?.()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Btn>
        </HStk>
      </VStk>
    </dialog>
  )
}

export function BtmBar({
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
    <nav className="ui-bottombar" aria-label="主导航" style={style}>
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
              {item.badge ? <Bdg className="ui-bottombar-badge">{item.badge}</Bdg> : null}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function Crd({ children, className, ...props }: { children?: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <Bx className={cx('ui-card', className)} surface blurPanel radius="container" padding="normal" border {...props}>
      {children}
    </Bx>
  )
}

export function Chp({
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
