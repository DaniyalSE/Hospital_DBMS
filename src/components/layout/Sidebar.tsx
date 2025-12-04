import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  Shield,
  Settings,
  LogOut,
  Activity,
  FileJson,
  Users,
  Layers,
  Bug,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Collections', href: '/collections', icon: FolderOpen },
  { name: 'Aggregations', href: '/aggregations', icon: GitBranch },
  { name: 'Transactions', href: '/transactions', icon: Layers },
  { name: 'Locking System', href: '/locking', icon: Lock },
  { name: 'Vulnerability Lab', href: '/vulnerability-lab', icon: Bug, adminOnly: false },
  { name: 'Admin', href: '/admin', icon: Shield, adminOnly: true },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, role, isAdmin, signOut } = useAuth();
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="bg-gradient-primary p-2 rounded-lg">
              <Database className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Hospital DBMS</h1>
              <p className="text-xs text-muted-foreground">MongoDB Atlas</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="bg-gradient-primary p-2 rounded-lg mx-auto">
            <Database className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className={cn('shrink-0', collapsed && 'mx-auto mt-2')}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Connection Status */}
      {!collapsed && (
        <div className="px-4 py-3">
          <div className="glass rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-success animate-pulse" />
              <span className="text-xs font-medium">Connected</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileJson className="h-3 w-3" />
              <span>20 Collections</span>
            </div>
          </div>
        </div>
      )}

      <Separator className="my-2" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          
          const isActive = location.pathname === item.href;
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary-foreground')} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      <Separator className="my-2" />

      {/* User Section */}
      <div className="p-4 space-y-3">
        {!collapsed && (
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <Users className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <Badge
                  variant={isAdmin ? 'default' : 'secondary'}
                  className={cn(
                    'text-xs',
                    isAdmin && 'bg-gradient-primary text-primary-foreground'
                  )}
                >
                  {role || 'guest'}
                </Badge>
              </div>
            </div>
          </div>
        )}
        
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className={cn(
            'w-full text-muted-foreground hover:text-destructive',
            collapsed && 'mx-auto'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
