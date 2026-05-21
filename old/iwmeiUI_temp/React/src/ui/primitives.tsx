import {
  forwardRef,
  useState,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ImgHTMLAttributes,
  type ReactNode,
} from 'react'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

type SpaceToken = 'compact' | 'normal' | 'loose'
type RadiusToken = 'control' | 'container' | 'full'
type SpaceValue = SpaceToken | number | string

type RadiusValue = RadiusToken | number | string

function resolveSpace(space?: SpaceValue): string | undefined {
  if (space === undefined) {
    return undefined
  }

  if (typeof space === 'number') {
    return `${space}px`
  }

  if (space === 'compact' || space === 'normal' || space === 'loose') {
    return `var(--padding-${space})`
  }

  return space
}

function resolveRadius(radius?: RadiusValue): string | undefined {
  if (radius === undefined) {
    return undefined
  }

  if (typeof radius === 'number') {
    return `${radius}px`
  }

  if (radius === 'control' || radius === 'container' || radius === 'full') {
    return `var(--radius-${radius})`
  }

  return radius
}

type BoxProps<T extends ElementType = 'div'> = {
  as?: T
  children?: ReactNode
  className?: string
  style?: CSSProperties
  padding?: SpaceValue
  radius?: RadiusValue
  surface?: boolean
  wrapped?: boolean
  blurPanel?: boolean
  border?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'style'>

export function Box<T extends ElementType = 'div'>({
  as,
  children,
  className,
  style,
  padding,
  radius,
  surface,
  wrapped,
  blurPanel,
  border,
  ...props
}: BoxProps<T>) {
  const Comp = (as ?? 'div') as ElementType

  // Start with structural props, then layer semantic appearance flags below.
  const mergedStyle: CSSProperties = {
    ...style,
    padding: resolveSpace(padding),
    borderRadius: resolveRadius(radius),
    border: border ? '1px solid color-mix(in srgb, var(--text-secondary) 18%, transparent)' : style?.border,
  }

  if (surface) {
    mergedStyle.background = 'var(--bg-surface)'
  }

  if (wrapped) {
    mergedStyle.background = 'var(--component-wrapped-bg)'
    mergedStyle.color = 'var(--component-wrapped-text)'
  }

  if (blurPanel) {
    mergedStyle.background = 'rgb(from var(--bg-surface) r g b / var(--panel-opacity))'
    mergedStyle.backdropFilter = 'blur(var(--panel-blur))'
    mergedStyle.WebkitBackdropFilter = 'blur(var(--panel-blur))'
  }

  return (
    <Comp className={cx('ui-box', className)} style={mergedStyle} {...props}>
      {children}
    </Comp>
  )
}

type StackProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  gap?: SpaceValue
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
  wrap?: boolean
} & ComponentPropsWithoutRef<'div'>

export function HStack({ children, className, style, gap = 'normal', align, justify, wrap, ...props }: StackProps) {
  return (
    <div
      className={cx('ui-stack', 'ui-hstack', className)}
      style={{
        ...style,
        gap: resolveSpace(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function VStack({ children, className, style, gap = 'normal', align, justify, ...props }: StackProps) {
  return (
    <div
      className={cx('ui-stack', 'ui-vstack', className)}
      style={{
        ...style,
        gap: resolveSpace(gap),
        alignItems: align,
        justifyContent: justify,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function ZStack({ children, className, style, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cx('ui-zstack', className)} style={style} {...props}>
      {children}
    </div>
  )
}

type GridProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  minItemWidth?: string
  columns?: number
  gap?: SpaceValue
} & ComponentPropsWithoutRef<'div'>

export function Grid({
  children,
  className,
  style,
  minItemWidth = '220px',
  columns,
  gap = 'normal',
  ...props
}: GridProps) {
  const template = columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(${minItemWidth}, 1fr))`

  return (
    <div
      className={cx('ui-grid', className)}
      style={{
        ...style,
        gridTemplateColumns: template,
        gap: resolveSpace(gap),
      }}
      {...props}
    >
      {children}
    </div>
  )
}

type ScrollViewProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  height?: string | number
} & ComponentPropsWithoutRef<'div'>

export function ScrollView({ children, className, style, height, ...props }: ScrollViewProps) {
  return (
    <div
      className={cx('ui-scrollview', className)}
      style={{
        ...style,
        maxHeight: typeof height === 'number' ? `${height}px` : height,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function Spacer({ className, style, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('ui-spacer', className)} style={style} {...props} />
}

export function Divider({
  className,
  style,
  vertical,
  ...props
}: ComponentPropsWithoutRef<'hr'> & { vertical?: boolean }) {
  if (vertical) {
    return <span className={cx('ui-divider', 'ui-divider-vertical', className)} style={style} {...props} />
  }

  return <hr className={cx('ui-divider', className)} style={style} {...props} />
}

type Tone = 'primary' | 'secondary' | 'wrapped' | 'action' | 'error'

type TextProps<T extends ElementType = 'span'> = {
  as?: T
  tone?: Tone
  weight?: 400 | 500 | 600 | 700
  className?: string
  style?: CSSProperties
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'style' | 'children'>

export function Text<T extends ElementType = 'span'>({
  as,
  tone = 'primary',
  weight = 500,
  className,
  style,
  children,
  ...props
}: TextProps<T>) {
  const Comp = (as ?? 'span') as ElementType
  return (
    <Comp className={cx('ui-text', `ui-text-${tone}`, className)} style={{ ...style, fontWeight: weight }} {...props}>
      {children}
    </Comp>
  )
}

export function Heading({
  level = 2,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'h2'>, 'children'> & { level?: 1 | 2 | 3 | 4 | 5 | 6; children?: ReactNode }) {
  const safeLevel = Math.min(Math.max(level, 1), 6)
  const tagByLevel = {
    1: 'h1',
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6',
  } as const
  const tag = tagByLevel[safeLevel as 1 | 2 | 3 | 4 | 5 | 6]
  return (
    <Text as={tag} className={cx('ui-heading', `ui-heading-${safeLevel}`, className)} weight={700} {...props}>
      {children}
    </Text>
  )
}

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  radius?: RadiusValue
  fit?: CSSProperties['objectFit']
}

export function Image({ className, style, radius = 'container', fit = 'cover', ...props }: ImageProps) {
  return (
    <img
      className={cx('ui-image', className)}
      style={{
        ...style,
        borderRadius: resolveRadius(radius),
        objectFit: fit,
      }}
      {...props}
    />
  )
}

const iconPath = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  home: 'M3 11.5L12 4l9 7.5M6.5 10.5V20h11V10.5',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zm5-1l5 5',
  bell: 'M18 16v-4a6 6 0 10-12 0v4l-2 2h16l-2-2zM10 20a2 2 0 004 0',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0',
  settings: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8 3.5l-2.1-.5a6.9 6.9 0 00-.6-1.4l1.2-1.8-2.2-2.2-1.8 1.2a6.9 6.9 0 00-1.4-.6L12 4 11.5 6a6.9 6.9 0 00-1.4.6L8.3 5.4 6.1 7.6l1.2 1.8c-.3.4-.5.9-.6 1.4L4 12l2.1.5c.1.5.3 1 .6 1.4l-1.2 1.8 2.2 2.2 1.8-1.2c.4.3.9.5 1.4.6L12 20l.5-2.1c.5-.1 1-.3 1.4-.6l1.8 1.2 2.2-2.2-1.2-1.8c.3-.4.5-.9.6-1.4L20 12z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'M6 9l6 6 6-6',
  check: 'M5 13l4 4L19 7',
  alert: 'M12 7v5m0 4h.01M10.4 3.9l-7 12A2 2 0 005.1 19h13.8a2 2 0 001.7-3.1l-7-12a2 2 0 00-3.4 0z',
} as const

export type IconName = keyof typeof iconPath

export function Icon({
  name,
  className,
  size = 18,
  strokeWidth = 1.9,
  style,
}: {
  name: IconName
  className?: string
  size?: number
  strokeWidth?: number
  style?: CSSProperties
}) {
  return (
    <svg
      className={cx('ui-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={style}
    >
      <path d={iconPath[name]} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const Avatar = forwardRef<
  HTMLDivElement,
  {
    src?: string
    name?: string
    size?: number
    className?: string
    style?: CSSProperties
  }
>(function Avatar({ src, name = 'User', size = 40, className, style }, ref) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      ref={ref}
      className={cx('ui-avatar', className)}
      style={{
        ...style,
        width: size,
        height: size,
      }}
      aria-label={name}
      title={name}
    >
      {src && !imageFailed ? (
        <img src={src} alt={name} onError={() => setImageFailed(true)} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
})
