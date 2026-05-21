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
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
  next: 'M6 6l8.5 6L6 18zm9 0h2v12h-2z',
  volume: 'M11 5L6 9H2v6h4l5 4V5zm7 7c0-2.5-1.5-4.5-3.5-5.5v11c2-1 3.5-3 3.5-5.5z',
  volumeMute: 'M11 5L6 9H2v6h4l5 4V5zm10 7l-2.5-2.5L16 12l2.5 2.5L21 12z',
  shuffle: 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  lyrics: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  playlist: 'M4 6h9m-9 6h9m-9 6h9M17 6l3 2-3 2V6zm0 8l3 2-3 2v-4z',
  minimize: 'M19 13H5v-2h14v2z',
  maximize: 'M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H6V6h12v12z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  folder: 'M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  github: 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  globe: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.66 0 3.3 2.13 3.82 5H8.18C8.7 6.13 10.34 4 12 4zm-5.64 5h2.15a18.3 18.3 0 00-.41 3H4.07c.18-1.12.59-2.16 1.29-3zm-.22 5h2.37c.07 1.07.22 2.07.41 3H6.14a7.99 7.99 0 01-1.93-3zm8 3c-.52 2.87-2.16 5-3.82 5s-3.3-2.13-3.82-5h7.64zm2.08-3a18.3 18.3 0 00.41-3h2.37a7.99 7.99 0 01-1.93 3h-2.15zm.41-5c.07-1.07.22-2.07.41-3h2.15c.7 1.14 1.11 2.18 1.29 3h-3.85zm-4.49 5h3.82c-.12 1.07-.37 2.07-.71 3h-6.22a8.7 8.7 0 01-.71-3zm0-5c.12-1.07.37-2.07.71-3h6.22c.34.93.59 1.93.71 3H8.18z',
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
