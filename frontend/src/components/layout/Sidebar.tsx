import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Briefcase,
  LayoutGrid,
  Info,
  Archive,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "./Sidebar.css";

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { path: "/deals", label: "Deals", icon: Briefcase },
    { path: "/demo-scenarios", label: "Demo Scenarios", icon: LayoutGrid },
  ];

  const secondaryNavItems = [
    { path: "/archived", label: "Archived", icon: Archive },
    { path: "/deleted", label: "Deleted", icon: Trash2 },
  ];

  const footerNavItems = [
    { path: "/about", label: "About", icon: Info },
  ];

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="logo">{collapsed ? "A" : "Accordo.ai"}</div>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="nav-icon" />
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </Link>
          );
        })}

        <div className="nav-divider" />

        {secondaryNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="nav-icon" />
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </Link>
          );
        })}

        <div className="nav-spacer" />

        {footerNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="nav-icon" />
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
