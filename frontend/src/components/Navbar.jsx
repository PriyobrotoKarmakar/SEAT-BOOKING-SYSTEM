import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Menu, Sun, Moon } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useTheme } from "next-themes";

const Navbar = ({ user, onMenuClick }) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Wissen Seat Allocation
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Manage your office seat bookings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {user?.name || "Guest"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Batch {user?.batch} | Squad {user?.squad}
              </p>
            </div>
            <Avatar>
              <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                {user?.name?.charAt(0) || "G"}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Dark / Light Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun
              size={18}
              className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            />
            <Moon
              size={18}
              className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
