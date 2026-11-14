// 设置页折叠分组组件
import type { ReactNode } from '../head'
import { Bx, Icn, Txt } from '../ui/primitives'

// 设置分组渲染入口
export function SetSec({
  id,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  hint?: string
  open: boolean
  onToggle: (id: string) => void
  children: ReactNode
}) {
  return (
    <Bx surface border radius="container" style={{ overflow: 'hidden' }}>
      <button
        className="ui-accordion-summary"
        style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
        onClick={() => onToggle(id)}
        title={hint}
      >
        <Txt weight={700}>{title}</Txt>
        <Icn
          name="chevronDown"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
      {open && (
        <div className="ui-accordion-content" style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
          {children}
        </div>
      )}
    </Bx>
  )
}