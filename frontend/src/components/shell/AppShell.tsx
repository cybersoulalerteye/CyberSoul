import { Bell, ChevronDown, Command, Search, Shield } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Camera,
  FileSearch,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
} from "lucide-react";
import { Avatar, Breadcrumb } from "../ui";

const operations = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Incidents", to: "/incidents", icon: Siren },
  { label: "Evidence", to: "/evidence", icon: FileSearch },
  { label: "Sources", to: "/sources", icon: Camera },
];

const configuration = [
  { label: "Rules", to: "/rules", icon: SlidersHorizontal },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Security", to: "/security", icon: ShieldCheck },
];

function TopBar() {
  return (
    <header className="topbar">
      <NavLink className="topbar__brand" to="/dashboard" aria-label="AlertEye home">
        <span className="brand-mark"><Shield size={18} strokeWidth={1.5} aria-hidden="true" /></span>
        <span className="brand-name">AlertEye</span>
      </NavLink>
      <div className="topbar__breadcrumb">
        <Breadcrumb items={[{ label: "CyberSoul" }, { label: "Operations" }]} />
      </div>
      <label className="global-search">
        <Search size={16} aria-hidden="true" />
        <input aria-label="Search AlertEye" placeholder="Search" />
        <kbd><Command size={11} aria-hidden="true" /> K</kbd>
      </label>
      <button className="org-switcher" type="button" aria-label="Organization: CyberSoul" title="Organization: CyberSoul">
        <span className="org-switcher__avatar">C</span>
        <span className="org-switcher__name">CyberSoul</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <button className="topbar__icon-button" type="button" aria-label="Notifications" title="Notifications">
        <Bell size={17} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button className="user-menu" type="button" aria-label="User menu for Alex Morgan" title="User menu">
        <Avatar name="Alex Morgan" size="sm" />
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </header>
  );
}

function SideNav() {
  return (
    <aside className="sidenav" aria-label="Main navigation">
      <nav className="sidenav__nav">
        <p className="sidenav__group-label">Operations</p>
        {operations.map(({ label, to, icon: Icon }) => (
          <NavLink
            className={({ isActive }) => `sidenav__link ${isActive ? "is-active" : ""}`}
            end={to === "/dashboard"}
            key={to}
            to={to}
            title={label}
            aria-label={label}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <p className="sidenav__group-label sidenav__group-label--configuration">Configuration</p>
        {configuration.map(({ label, to, icon: Icon }) => (
          <NavLink
            className={({ isActive }) => `sidenav__link ${isActive ? "is-active" : ""}`}
            key={to}
            to={to}
            title={label}
            aria-label={label}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidenav__footer">
        <span className="sidenav__status-dot" aria-hidden="true" />
        <span>All systems operational</span>
      </div>
    </aside>
  );
}

export function AppShell() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-shell__body">
        <SideNav />
        <main className="main-content">
          <div className="main-content__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
