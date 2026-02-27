import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  User,
  Home,
  Settings,
  HelpCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      description: "Overview & bookings",
    },
    {
      title: "Profile",
      href: "/profile",
      icon: User,
      description: "Your account details",
    },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-white dark:bg-slate-900 dark:border-slate-700 transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col px-3 py-6">
          {/* Main Navigation */}
          <nav className="flex-1 space-y-2">
            <div className="px-3 py-2">
              <h2 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Main Menu
              </h2>
            </div>

            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
                )}
              >
                <item.icon size={18} />
                <div className="flex-1">
                  <div>{item.title}</div>
                  {item.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                      {item.description}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </nav>

          <Separator className="my-4" />

          {/* Footer Section */}
          <div className="space-y-2">
            <div className="px-3 py-2">
              <h2 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Support
              </h2>
            </div>

            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              <Settings size={18} />
              <span>Settings</span>
            </button>

            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              <HelpCircle size={18} />
              <span>Help & Support</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
