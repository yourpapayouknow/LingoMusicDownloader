export type ThemeMode = 'light' | 'dark'

type TokenLeaf = string | number | boolean
type TokenNode = TokenLeaf | { [key: string]: TokenNode }

const rawTokens = {
  system: {
    name: 'Universal Quantum UI Tokens',
    version: '1.1.1',
  },
  primitives: {
    color: {
      black_oled: '#121212',
      white_pure: '#FFFFFF',
      gray: {
        '50': '#FAFAFA',
        '100': '#F5F5F5',
        '200': '#EEEEEE',
        '700': '#616161',
        '800': '#424242',
        '900': '#212121',
      },
      navy: {
        '700': '#1E2D3F',
        '800': '#152131',
        '900': '#0E1722',
      },
      teal: {
        '50': '#EAFFFC',
        '100': '#C8FFF8',
        '500': '#0FF7E5',
        '700': '#00CDBD',
        '900': '#00756D',
      },
      orange: {
        '500': '#FF6D00',
        '700': '#E65100',
        '900': '#BF360C',
      },
      error: {
        light: '#EF5350',
        dark: '#CF6679',
      },
    },
    size: {
      spacing_base: '4px',
      radius_base: '5px',
    },
  },
  semantics: {
    dark: {
      color: {
        bg_base: '{primitives.color.navy.900}',
        bg_surface: '{primitives.color.navy.800}',
        text_primary: '{primitives.color.gray.50}',
        text_secondary: '{primitives.color.gray.200}',
        component_wrapped_bg: '{primitives.color.teal.700}',
        component_wrapped_text: '{primitives.color.teal.50}',
        action_primary: '{primitives.color.orange.500}',
        action_primary_hover: '{primitives.color.orange.700}',
        text_on_action: '{primitives.color.gray.900}',
        system_error: '{primitives.color.error.dark}',
      },
      effect: {
        panel_blur: '22px',
        panel_opacity: 0.72,
        glow_shadow: '0 14px 38px rgba(255, 109, 0, 0.34), 0 4px 14px rgba(0, 117, 109, 0.24)',
        surface_shadow: '0 18px 40px rgba(4, 12, 24, 0.52), inset 0 1px 0 rgba(255,255,255,0.06)',
        soft_shadow: '0 10px 24px rgba(8, 22, 38, 0.38)',
        glass_tint: 'linear-gradient(135deg, rgba(200, 255, 248, 0.2), rgba(15, 247, 229, 0.08))',
        focus_glow: '0 0 0 3px rgba(255,109,0,0.24), 0 10px 28px rgba(255,109,0,0.28)',
        transition_quick: '180ms cubic-bezier(0.22, 1, 0.36, 1)',
        transition_normal: '300ms cubic-bezier(0.22, 1, 0.36, 1)',
        transition_slow: '460ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
    light: {
      color: {
        bg_base: '{primitives.color.gray.50}',
        bg_surface: '{primitives.color.white_pure}',
        text_primary: '{primitives.color.gray.900}',
        text_secondary: '{primitives.color.gray.700}',
        component_wrapped_bg: '{primitives.color.teal.100}',
        component_wrapped_text: '{primitives.color.teal.900}',
        action_primary: '{primitives.color.orange.700}',
        action_primary_hover: '{primitives.color.orange.900}',
        text_on_action: '{primitives.color.white_pure}',
        system_error: '{primitives.color.error.light}',
      },
      effect: {
        panel_blur: '18px',
        panel_opacity: 0.84,
        glow_shadow: '0 10px 26px rgba(15, 247, 229, 0.24), 0 4px 12px rgba(0, 117, 109, 0.12)',
        surface_shadow: '0 14px 30px rgba(0, 117, 109, 0.16), inset 0 1px 0 rgba(255,255,255,0.92)',
        soft_shadow: '0 8px 18px rgba(0, 117, 109, 0.12)',
        glass_tint: 'linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(200, 255, 248, 0.52))',
        focus_glow: '0 0 0 3px rgba(230,81,0,0.18), 0 9px 22px rgba(230,81,0,0.20)',
        transition_quick: '180ms cubic-bezier(0.22, 1, 0.36, 1)',
        transition_normal: '300ms cubic-bezier(0.22, 1, 0.36, 1)',
        transition_slow: '460ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  layout: {
    padding: {
      compact: 'calc({primitives.size.spacing_base} * 2)',
      normal: 'calc({primitives.size.spacing_base} * 4)',
      loose: 'calc({primitives.size.spacing_base} * 6)',
    },
    radius: {
      control: 'calc({primitives.size.radius_base} * 2)',
      container: 'calc({primitives.size.radius_base} * 3)',
      full: '9999px',
    },
  },
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getPath(root: TokenNode, path: string): TokenNode | undefined {
  const parts = path.split('.')
  let current: unknown = root

  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined
    }
    current = current[part]
  }

  return current as TokenNode
}

function resolveAny(
  node: TokenNode,
  root: TokenNode,
  stack: string[],
  cache: Map<string, TokenLeaf>,
): TokenNode {
  // Resolve both direct refs ("{a.b.c}") and template refs inside strings ("calc({a} * 2)").
  if (typeof node === 'string') {
    const exactMatch = node.match(/^\{([^{}]+)\}$/)
    if (exactMatch) {
      return resolvePath(exactMatch[1], root, stack, cache)
    }

    return node.replace(/\{([^{}]+)\}/g, (_, refPath: string) => {
      const value = resolvePath(refPath, root, stack, cache)
      return String(value)
    })
  }

  if (typeof node === 'number' || typeof node === 'boolean') {
    return node
  }

  if (!isRecord(node)) {
    return node
  }

  const result: Record<string, TokenNode> = {}
  for (const [key, value] of Object.entries(node)) {
    result[key] = resolveAny(value as TokenNode, root, stack, cache)
  }
  return result
}

function resolvePath(
  refPath: string,
  root: TokenNode,
  stack: string[],
  cache: Map<string, TokenLeaf>,
): TokenLeaf {
  // Reuse previous resolutions to avoid repeated tree walks.
  if (cache.has(refPath)) {
    return cache.get(refPath) as TokenLeaf
  }

  // Guard against accidental recursive references.
  if (stack.includes(refPath)) {
    throw new Error(`Circular token reference detected: ${stack.join(' -> ')} -> ${refPath}`)
  }

  const raw = getPath(root, refPath)
  if (raw === undefined) {
    throw new Error(`Unknown token reference: ${refPath}`)
  }

  const resolved = resolveAny(raw, root, [...stack, refPath], cache)
  if (
    typeof resolved !== 'string' &&
    typeof resolved !== 'number' &&
    typeof resolved !== 'boolean'
  ) {
    throw new Error(`Reference does not resolve to a leaf value: ${refPath}`)
  }

  cache.set(refPath, resolved)
  return resolved
}

const resolvedTokens = resolveAny(rawTokens as TokenNode, rawTokens as TokenNode, [], new Map()) as {
  semantics: {
    dark: {
      color: Record<string, string>
      effect: {
        panel_blur: string
        panel_opacity: number
        glow_shadow: string
        surface_shadow: string
        soft_shadow: string
        glass_tint: string
        focus_glow: string
        transition_quick: string
        transition_normal: string
        transition_slow: string
      }
    }
    light: {
      color: Record<string, string>
      effect: {
        panel_blur: string
        panel_opacity: number
        glow_shadow: string
        surface_shadow: string
        soft_shadow: string
        glass_tint: string
        focus_glow: string
        transition_quick: string
        transition_normal: string
        transition_slow: string
      }
    }
  }
  layout: {
    padding: Record<string, string>
    radius: Record<string, string>
  }
}

export type ResolvedTheme = {
  color: {
    bgBase: string
    bgSurface: string
    textPrimary: string
    textSecondary: string
    componentWrappedBg: string
    componentWrappedText: string
    actionPrimary: string
    actionPrimaryHover: string
    textOnAction: string
    systemError: string
  }
  effect: {
    panelBlur: string
    panelOpacity: number
    glowShadow: string
    surfaceShadow: string
    softShadow: string
    glassTint: string
    focusGlow: string
    transitionQuick: string
    transitionNormal: string
    transitionSlow: string
  }
  layout: {
    paddingCompact: string
    paddingNormal: string
    paddingLoose: string
    radiusControl: string
    radiusContainer: string
    radiusFull: string
  }
}

// Flatten semantic token paths into UI-facing fields to keep component usage stable.
const themeByMode: Record<ThemeMode, ResolvedTheme> = {
  dark: {
    color: {
      bgBase: resolvedTokens.semantics.dark.color.bg_base,
      bgSurface: resolvedTokens.semantics.dark.color.bg_surface,
      textPrimary: resolvedTokens.semantics.dark.color.text_primary,
      textSecondary: resolvedTokens.semantics.dark.color.text_secondary,
      componentWrappedBg: resolvedTokens.semantics.dark.color.component_wrapped_bg,
      componentWrappedText: resolvedTokens.semantics.dark.color.component_wrapped_text,
      actionPrimary: resolvedTokens.semantics.dark.color.action_primary,
      actionPrimaryHover: resolvedTokens.semantics.dark.color.action_primary_hover,
      textOnAction: resolvedTokens.semantics.dark.color.text_on_action,
      systemError: resolvedTokens.semantics.dark.color.system_error,
    },
    effect: {
      panelBlur: resolvedTokens.semantics.dark.effect.panel_blur,
      panelOpacity: resolvedTokens.semantics.dark.effect.panel_opacity,
      glowShadow: resolvedTokens.semantics.dark.effect.glow_shadow,
      surfaceShadow: resolvedTokens.semantics.dark.effect.surface_shadow,
      softShadow: resolvedTokens.semantics.dark.effect.soft_shadow,
      glassTint: resolvedTokens.semantics.dark.effect.glass_tint,
      focusGlow: resolvedTokens.semantics.dark.effect.focus_glow,
      transitionQuick: resolvedTokens.semantics.dark.effect.transition_quick,
      transitionNormal: resolvedTokens.semantics.dark.effect.transition_normal,
      transitionSlow: resolvedTokens.semantics.dark.effect.transition_slow,
    },
    layout: {
      paddingCompact: resolvedTokens.layout.padding.compact,
      paddingNormal: resolvedTokens.layout.padding.normal,
      paddingLoose: resolvedTokens.layout.padding.loose,
      radiusControl: resolvedTokens.layout.radius.control,
      radiusContainer: resolvedTokens.layout.radius.container,
      radiusFull: resolvedTokens.layout.radius.full,
    },
  },
  light: {
    color: {
      bgBase: resolvedTokens.semantics.light.color.bg_base,
      bgSurface: resolvedTokens.semantics.light.color.bg_surface,
      textPrimary: resolvedTokens.semantics.light.color.text_primary,
      textSecondary: resolvedTokens.semantics.light.color.text_secondary,
      componentWrappedBg: resolvedTokens.semantics.light.color.component_wrapped_bg,
      componentWrappedText: resolvedTokens.semantics.light.color.component_wrapped_text,
      actionPrimary: resolvedTokens.semantics.light.color.action_primary,
      actionPrimaryHover: resolvedTokens.semantics.light.color.action_primary_hover,
      textOnAction: resolvedTokens.semantics.light.color.text_on_action,
      systemError: resolvedTokens.semantics.light.color.system_error,
    },
    effect: {
      panelBlur: resolvedTokens.semantics.light.effect.panel_blur,
      panelOpacity: resolvedTokens.semantics.light.effect.panel_opacity,
      glowShadow: resolvedTokens.semantics.light.effect.glow_shadow,
      surfaceShadow: resolvedTokens.semantics.light.effect.surface_shadow,
      softShadow: resolvedTokens.semantics.light.effect.soft_shadow,
      glassTint: resolvedTokens.semantics.light.effect.glass_tint,
      focusGlow: resolvedTokens.semantics.light.effect.focus_glow,
      transitionQuick: resolvedTokens.semantics.light.effect.transition_quick,
      transitionNormal: resolvedTokens.semantics.light.effect.transition_normal,
      transitionSlow: resolvedTokens.semantics.light.effect.transition_slow,
    },
    layout: {
      paddingCompact: resolvedTokens.layout.padding.compact,
      paddingNormal: resolvedTokens.layout.padding.normal,
      paddingLoose: resolvedTokens.layout.padding.loose,
      radiusControl: resolvedTokens.layout.radius.control,
      radiusContainer: resolvedTokens.layout.radius.container,
      radiusFull: resolvedTokens.layout.radius.full,
    },
  },
}

export function getTheme(mode: ThemeMode): ResolvedTheme {
  return themeByMode[mode]
}
