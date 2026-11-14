// 基础UI原子布局组件与设计系统样式容器
import {
  AddRegular,
  AddFilled,
  AlertRegular,
  AlertFilled,
  CaptionsRegular,
  CaptionsFilled,
  CheckRegular,
  CheckFilled,
  CloseRegular,
  CloseFilled,
  Delete2Regular,
  Delete2Filled,
  DownRegular,
  DownFilled,
  Download2Regular,
  Download2Filled,
  Earth4Regular,
  Earth4Filled,
  FolderRegular,
  FolderFilled,
  GithubRegular,
  GithubFilled,
  Home2Regular,
  Home2Filled,
  InformationRegular,
  InformationFilled,
  LinkRegular,
  LinkFilled,
  MenuRegular,
  MenuFilled,
  MinimizeRegular,
  MinimizeFilled,
  NotificationRegular,
  NotificationFilled,
  PauseRegular,
  PauseFilled,
  PlayRegular,
  PlayFilled,
  PlaylistRegular,
  PlaylistFilled,
  RepeatRegular,
  RepeatFilled,
  Search2Regular,
  Search2Filled,
  Settings3Regular,
  Settings3Filled,
  ShuffleRegular,
  ShuffleFilled,
  SkipForwardRegular,
  SkipForwardFilled,
  SkipPreviousRegular,
  SkipPreviousFilled,
  SquareRegular,
  SquareFilled,
  User3Regular,
  User3Filled,
  VolumeRegular,
  VolumeFilled,
  VolumeMuteRegular,
  VolumeMuteFilled,
  type MingCuteIconComp,
  type CSSProperties,
  type ReactNode,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ImgHTMLAttributes,
} from '../head'

// 组合与过滤类名字符串
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

type SpaceToken = 'compact' | 'normal' | 'loose'
type RadiusToken = 'control' | 'container' | 'full'
type SpaceValue = SpaceToken | number | string

type RadiusValue = RadiusToken | number | string

// 解析设计系统间距令牌
function rslvspc(space?: SpaceValue): string | undefined {
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

// 解析设计系统圆角令牌
function rslvrds(radius?: RadiusValue): string | undefined {
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

const resolveSpace = rslvspc
const resolveRadius = rslvrds

type BoxProps<T extends ElementType = 'div'> = {
  as?: T
  children?: ReactNode
  className?: string
  style?: CSSProperties
  padding?: SpaceValue
  radius?: RadiusValue
  surface?: boolean
  blurPanel?: boolean
  border?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'style'>

export function Bx<T extends ElementType = 'div'>({
  as,
  children,
  className,
  style,
  padding,
  radius,
  surface,
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

export function HStk({ children, className, style, gap = 'normal', align, justify, wrap, ...props }: StackProps) {
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

export function VStk({ children, className, style, gap = 'normal', align, justify, ...props }: StackProps) {
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

type GridProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  minItemWidth?: string
  columns?: number
  gap?: SpaceValue
} & ComponentPropsWithoutRef<'div'>

export function Grd({
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

export function ScrVw({ children, className, style, height, ...props }: ScrollViewProps) {
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height
  return (
    <div
      className={cx('ui-scrollview', className)}
      style={{
        ...style,
        height: resolvedHeight,
        maxHeight: resolvedHeight,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function Dvd({
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

type Tone = 'primary' | 'secondary' | 'error'

type TextProps<T extends ElementType = 'span'> = {
  as?: T
  tone?: Tone
  weight?: 400 | 500 | 600 | 700
  className?: string
  style?: CSSProperties
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'style' | 'children'>

export function Txt<T extends ElementType = 'span'>({
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

export function Hdg({
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
    <Txt as={tag} className={cx('ui-heading', `ui-heading-${safeLevel}`, className)} weight={700} {...props}>
      {children}
    </Txt>
  )
}

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  radius?: RadiusValue
  fit?: CSSProperties['objectFit']
}

export function Img({ className, style, radius = 'container', fit = 'cover', ...props }: ImageProps) {
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

// MingCute图标名称与Regular/Filled双态映射表
const MGC_ICONS = {
  menu: { regular: MenuRegular, filled: MenuFilled },
  home: { regular: Home2Regular, filled: Home2Filled },
  search: { regular: Search2Regular, filled: Search2Filled },
  bell: { regular: NotificationRegular, filled: NotificationFilled },
  user: { regular: User3Regular, filled: User3Filled },
  info: { regular: InformationRegular, filled: InformationFilled },
  settings: { regular: Settings3Regular, filled: Settings3Filled },
  plus: { regular: AddRegular, filled: AddFilled },
  close: { regular: CloseRegular, filled: CloseFilled },
  chevronDown: { regular: DownRegular, filled: DownFilled },
  check: { regular: CheckRegular, filled: CheckFilled },
  alert: { regular: AlertRegular, filled: AlertFilled },
  play: { regular: PlayRegular, filled: PlayFilled },
  pause: { regular: PauseRegular, filled: PauseFilled },
  prev: { regular: SkipPreviousRegular, filled: SkipPreviousFilled },
  next: { regular: SkipForwardRegular, filled: SkipForwardFilled },
  volume: { regular: VolumeRegular, filled: VolumeFilled },
  volumeMute: { regular: VolumeMuteRegular, filled: VolumeMuteFilled },
  shuffle: { regular: ShuffleRegular, filled: ShuffleFilled },
  repeat: { regular: RepeatRegular, filled: RepeatFilled },
  lyrics: { regular: CaptionsRegular, filled: CaptionsFilled },
  playlist: { regular: PlaylistRegular, filled: PlaylistFilled },
  minimize: { regular: MinimizeRegular, filled: MinimizeFilled },
  maximize: { regular: SquareRegular, filled: SquareFilled },
  download: { regular: Download2Regular, filled: Download2Filled },
  folder: { regular: FolderRegular, filled: FolderFilled },
  trash: { regular: Delete2Regular, filled: Delete2Filled },
  github: { regular: GithubRegular, filled: GithubFilled },
  link: { regular: LinkRegular, filled: LinkFilled },
  globe: { regular: Earth4Regular, filled: Earth4Filled },
} as const satisfies Record<string, { regular: MingCuteIconComp; filled: MingCuteIconComp }>

export type IconName = keyof typeof MGC_ICONS

// 渲染MingCute统一图标组件
export function Icn({
  name,
  className,
  size = 18,
  filled = false,
  style,
}: {
  name: IconName
  className?: string
  size?: number
  filled?: boolean
  style?: CSSProperties
}) {
  const iconPair = MGC_ICONS[name]
  const IconComp = filled ? iconPair.filled : iconPair.regular
  return <IconComp className={cx('ui-icon', className)} size={size} style={style} />
}
