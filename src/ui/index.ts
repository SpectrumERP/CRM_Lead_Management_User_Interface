/** Isolated UI primitives. Compose these from pages/components — do not add CRM/API logic here. */
export { Button, type ButtonProps, type ButtonVariant } from './Button'
export { Spinner, type SpinnerProps } from './Spinner'
export {
  Skeleton,
  SkeletonStatus,
  SkeletonLines,
  SkeletonList,
  SkeletonOptions,
  SkeletonFields,
  SkeletonGrid,
  SkeletonCards,
  SkeletonPage,
  BootShell,
  BootLogin,
  useSkeletonPhase,
  type SkeletonProps,
  type SkeletonStatusProps,
  type SkeletonLinesProps,
  type SkeletonListProps,
  type SkeletonOptionsProps,
  type SkeletonFieldsProps,
  type SkeletonGridProps,
  type SkeletonCardsProps,
  type SkeletonPageKind,
  type SkeletonPageProps,
  type BootShellProps,
} from './Skeleton'
export { Card, type CardProps } from './Card'
export { PageHeader, type PageHeaderProps } from './PageHeader'
export { StatPill, StatPillRow, type StatPillProps, type StatPillRowProps, type StatTone } from './StatPill'
export {
  CountBadge,
  type CountBadgeProps,
  type CountBadgeSize,
  type CountBadgeTone,
} from './CountBadge'
export { SortChevrons, type SortChevronsProps } from './SortChevrons'
export { IconTooltip, type IconTooltipProps } from './IconTooltip'
export { ImagePreview, type ImagePreviewProps } from './ImagePreview'
export { ContactHoverCard, type ContactHoverCardProps } from './ContactHoverCard'
export { Tag, type TagProps } from './Tag'
export {
  RowIconButton,
  RowIcons,
  type RowIconButtonProps,
  type RowIconTone,
} from './RowIconButton'
export { DetailField, type DetailFieldProps } from './DetailField'
export * from './forms'
export { nextSort, type SortDir, type SortState } from './sortCycle'
