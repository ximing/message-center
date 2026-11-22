import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Copy,
  Eye,
  FileText,
  Funnel,
  Image,
  Inbox,
  Info,
  KeyRound,
  Layers,
  Link,
  Lock,
  LogOut,
  MessageCircle,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  TriangleExclamationPoint,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";

const icons = {
  inbox: Inbox,
  route: Route,
  layers: Layers,
  key: KeyRound,
  book: BookOpen,
  logout: LogOut,
  chevron: ChevronRight,
  chevrons: ChevronsUpDown,
  plus: Plus,
  search: Search,
  refresh: RefreshCw,
  arrow: ArrowRight,
  "arrow-up": ArrowUpRight,
  check: Check,
  close: X,
  clock: Clock,
  alert: TriangleExclamationPoint,
  info: Info,
  wechat: MessageCircle,
  webhook: Webhook,
  shield: ShieldCheck,
  copy: Copy,
  edit: Pencil,
  filter: Funnel,
  file: FileText,
  link: Link,
  image: Image,
  voice: Mic,
  lock: Lock,
  eye: Eye,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons | "brand";

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  if (name === "brand") {
    return (
      <img
        className={`brand-icon ${className}`}
        src={`${import.meta.env.BASE_URL}favicon.svg?v=4`}
        width={64}
        height={64}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    );
  }
  const Glyph = icons[name];
  return <Glyph className={className} aria-hidden="true" />;
}
