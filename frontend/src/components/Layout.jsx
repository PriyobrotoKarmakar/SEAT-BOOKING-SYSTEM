import React, { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const Layout = ({ children, user }) => {
  // Default open on desktop (≥768px), closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 768,
  );

  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} onMenuClick={toggleSidebar} />
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <main
        className={`pt-16 transition-all duration-200 ${
          sidebarOpen ? "md:pl-64" : "pl-0"
        }`}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
