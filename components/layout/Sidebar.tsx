"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, Settings, ChevronLeft, ChevronRight,
  Zap, Inbox, FileText, Users, FlaskConical, Layers, Map, MessageSquare,
} from "lucide-react";

const topNav = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderOpen, label: "Projects" },
];

const projectNav = [
  { href: "discovery", icon: Inbox, label: "Discovery" },
  { href: "prd", icon: FileText, label: "PRD" },
  { href: "personas", icon: Users, label: "Personas" },
  { href: "research", icon: FlaskConical, label: "Research" },
  { href: "backlog", icon: Layers, label: "Backlog" },
  { href: "roadmap", icon: Map, label: "Roadmap" },
  { href: "chat", icon: MessageSquare, label: "Chat" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const match = pathname.match(/\/projects\/([^/]+)/);
  const projectId = match?.[1];

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={14} color="#0d0f17" fill="#0d0f17" />
        </div>
        {!collapsed && <span className="sidebar-logo-text">Atlas</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {topNav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item${active ? " active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={15} className="sidebar-item-icon" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </div>

        {/* Project sub-nav */}
        {projectId && (
          <div style={{ marginTop: "20px" }}>
            {!collapsed && (
              <div className="sidebar-section-label">Project</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
              {projectNav.map((item) => {
                const href = `/projects/${projectId}/${item.href}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={`sidebar-item${active ? " active" : ""}`}
                    title={collapsed ? item.label : undefined}
                    style={!collapsed ? { paddingLeft: "20px" } : undefined}
                  >
                    <item.icon size={14} className="sidebar-item-icon" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <Link
          href="/settings"
          className={`sidebar-item${pathname === "/settings" ? " active" : ""}`}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings size={15} className="sidebar-item-icon" />
          {!collapsed && "Settings"}
        </Link>
      </div>

      {/* Toggle */}
      <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  );
}
