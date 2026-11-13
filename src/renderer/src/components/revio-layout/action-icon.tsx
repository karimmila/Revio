import type React from 'react'
import {
  BookOpen,
  Box,
  Bug,
  Cloud,
  Code,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe,
  Hammer,
  ListChecks,
  Monitor,
  Package,
  Paintbrush,
  Play,
  RefreshCw,
  Rocket,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Terminal,
  TestTube,
  Trash2,
  Upload,
  Wrench,
  Zap,
  type LucideIcon
} from 'lucide-react'
import type { ActionIconId } from '../../../../shared/actions/action-icons'

const ICONS: Record<ActionIconId, LucideIcon> = {
  play: Play,
  terminal: Terminal,
  server: Server,
  globe: Globe,
  monitor: Monitor,
  smartphone: Smartphone,
  'test-tube': TestTube,
  'flask-conical': FlaskConical,
  'list-checks': ListChecks,
  bug: Bug,
  hammer: Hammer,
  wrench: Wrench,
  package: Package,
  box: Box,
  rocket: Rocket,
  cloud: Cloud,
  database: Database,
  'refresh-cw': RefreshCw,
  zap: Zap,
  sparkles: Sparkles,
  paintbrush: Paintbrush,
  code: Code,
  'file-text': FileText,
  'book-open': BookOpen,
  eye: Eye,
  gauge: Gauge,
  cpu: Cpu,
  shield: Shield,
  'git-branch': GitBranch,
  upload: Upload,
  download: Download,
  'trash-2': Trash2
}

/** An action's Run-button icon; play when it has none. */
export function ActionIcon({
  icon,
  className
}: {
  icon: ActionIconId | undefined
  className?: string
}): React.JSX.Element {
  const Icon = ICONS[icon ?? 'play']
  return <Icon className={className} />
}
