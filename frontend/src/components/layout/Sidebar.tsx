import { Link, useLocation } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: "/deals", label: "Deals" },
    { path: "/templates", label: "Templates", optional: true },
    { path: "/demo-scenarios", label: "Demo Scenarios" },
    { path: "/about", label: "About" },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">Accordo.ai</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          if (item.optional) {
            // For now, skip optional items - can be enabled later
            return null;
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

