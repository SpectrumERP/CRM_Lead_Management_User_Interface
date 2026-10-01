import { useCallback, useMemo, type CSSProperties } from 'react'
import { useOpportunityFillValues } from './useOpportunityFillValues'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** `#8B5CF6` + alpha (0–1) → `#8B5CF6xx`; 3-digit hex is expanded first. */
export function withAlpha(hex: string, alpha: number) {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  return `${full}${Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0')}`
}

/** Badge colours for a stage colour: tinted background, coloured text and border. */
export function stageBadgeStyle(hex: string | undefined): CSSProperties | undefined {
  if (!hex) return undefined
  return { backgroundColor: withAlpha(hex, 0.1), color: hex, borderColor: withAlpha(hex, 0.35) }
}

/**
 * Stage name → `colorCoding` from the opportunity fill values (e.g. Needs Analysis → #8B5CF6).
 * Undefined for demo logins, unknown stages, or invalid colours — callers keep their default palette.
 */
export function useOpportunityStageColors() {
  const { values } = useOpportunityFillValues()
  const byName = useMemo(() => {
    const map = new Map<string, string>()
    for (const stage of values?.opportunityStages ?? []) {
      const color = stage.colorCoding?.trim()
      if (color && HEX.test(color)) map.set(stage.opportunityStageName.trim().toLowerCase(), color)
    }
    return map
  }, [values])
  return useCallback((stageName: string | undefined) => (stageName ? byName.get(stageName.trim().toLowerCase()) : undefined), [byName])
}
