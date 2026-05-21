import {
  LayoutDashboard,
  CalendarDays,
  FilePlus,
  Users,
  BookOpen,
  ClipboardList,
  Shield,
  Settings,
  Calculator,
  Receipt,
  HeartPulse,
  Stethoscope,
  UserCheck,
  Plane,
  Mic,
  MessageSquare,
  ChevronDown,
  Pill,
  FileBarChart,
  HeartHandshake,
  Plug,
  ListChecks,
  X,
} from 'lucide-react';
import { useConditionPins } from '@/lib/useConditionPins';
import logoImg from '@/assets/chemistcare-logo.png';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const supportItems = [
  { title: 'Conditions Library', url: '/conditions', icon: BookOpen },
  { title: 'Calculators', url: '/calculators', icon: Calculator },
  { title: 'Claims & Reporting', url: '/claims', icon: Receipt },
  { title: '8CPA / PPA Services', url: '/eight-cpa', icon: HeartPulse },
  { title: 'Patient Messaging', url: '/messaging', icon: MessageSquare },
  { title: 'Patient Triage', url: '/triage', icon: UserCheck },
];

const adminItems = [
  { title: 'Settings', url: '/admin/settings', icon: Settings },
];

type NavChild = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /** Optional inline action (e.g. unpin). Rendered to the right of the label. */
  onAction?: (e: React.MouseEvent) => void;
  actionLabel?: string;
  actionIcon?: typeof LayoutDashboard;
};

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  children?: NavChild[];
};

function NavItemRenderer({ item, collapsed, isActive }: { item: NavItem; collapsed: boolean; isActive: (path: string) => boolean }) {
  const active = isActive(item.url) && (!item.children || !item.children.some(c => isActive(c.url)));
  const childActive = item.children?.some(c => isActive(c.url)) ?? false;

  if (item.children) {
    return (
      <Collapsible defaultOpen={active || childActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''}`}>
              <NavLink
                to={item.url}
                end
                className="flex items-center gap-2.5 flex-1"
                activeClassName=""
                onClick={e => e.stopPropagation()}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-[0.8125rem] font-medium">{item.title}</span>}
              </NavLink>
              {!collapsed && <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child) => {
                const ActionIcon = child.actionIcon ?? X;
                return (
                  <SidebarMenuSubItem key={child.title} className="group/subitem relative">
                    <SidebarMenuSubButton asChild className={`sidebar-nav-item ${isActive(child.url) ? 'sidebar-nav-active' : ''} ${child.onAction && !collapsed ? 'pr-7' : ''}`}>
                      <NavLink to={child.url} activeClassName="">
                        <child.icon className="h-3.5 w-3.5 shrink-0" />
                        {!collapsed && <span className="text-[0.8125rem] truncate">{child.title}</span>}
                      </NavLink>
                    </SidebarMenuSubButton>
                    {child.onAction && !collapsed && (
                      <button
                        type="button"
                        aria-label={child.actionLabel ?? 'Action'}
                        title={child.actionLabel ?? 'Action'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          child.onAction?.(e);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent opacity-0 group-hover/subitem:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <ActionIcon className="h-3 w-3" />
                      </button>
                    )}
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''}`}>
        <NavLink to={item.url} end={item.url === '/dashboard'} activeClassName="">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-[0.8125rem] font-medium">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const { pinnedConditions, setPinned } = useConditionPins();

  const handleUnpin = (conditionId: string, name: string) => {
    setPinned(conditionId, false);
    toast.success(`Unpinned ${name}`, {
      action: {
        label: 'Undo',
        onClick: () => setPinned(conditionId, true),
      },
    });
  };

  const pinnedConditionItems: NavChild[] = pinnedConditions.map(c => ({
    title: c.name,
    url: `/consultations/new/${c.slug}`,
    icon: c.category === 'travel' ? Plane : Pill,
    onAction: () => handleUnpin(c.id, c.name),
    actionLabel: `Unpin ${c.name}`,
    actionIcon: X,
  }));

  const mainItems: NavItem[] = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    {
      title: 'New Consultation',
      url: '/consultations/new',
      icon: FilePlus,
      children: [
        ...pinnedConditionItems,
        { title: 'All conditions', url: '/consultations/new', icon: ListChecks },
      ],
    },
    { title: 'Calendar', url: '/calendar', icon: CalendarDays },
    { title: 'Patients', url: '/patients', icon: Users },
    { title: 'Prescribing Log', url: '/prescribing-log', icon: ClipboardList },
    { title: 'Care Episodes', url: '/episodes', icon: HeartPulse },
    { title: 'Clinical Scribe', url: '/scribe', icon: Mic },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-5 py-5">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="ChemistCare Logo" className="h-9 w-9 rounded-lg object-cover" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-accent-foreground tracking-tight leading-tight">ChemistCare</span>
              <span className="text-[0.625rem] font-semibold text-sidebar-foreground/50 tracking-wider uppercase">Prescriber<span className="text-sidebar-primary">OS</span></span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.6875rem] font-semibold tracking-wider text-sidebar-foreground/40 uppercase px-3 mb-1">Prescribing</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} collapsed={collapsed} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider between groups */}
        <div className="mx-3 my-2 border-t border-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.6875rem] font-semibold tracking-wider text-sidebar-foreground/40 uppercase px-3 mb-1">Clinical Support</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {supportItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} collapsed={collapsed} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider between groups */}
        <div className="mx-3 my-2 border-t border-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.6875rem] font-semibold tracking-wider text-sidebar-foreground/40 uppercase px-3 mb-1">Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {adminItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} collapsed={collapsed} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-5 py-4 border-t border-sidebar-border">
        {!collapsed && (
          <div className="space-y-1.5">
            <p className="text-[0.6875rem] text-sidebar-foreground/45 leading-snug font-medium">
              Australian Pharmacist Prescriber
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-semibold bg-sidebar-primary/15 text-sidebar-primary">
              Clinical Decision Support v1.0
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
