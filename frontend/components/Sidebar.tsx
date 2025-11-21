"use client";

import styles from "./Sidebar.module.css";

interface SidebarProps {
  activeItem: string;
}

const menuItems = [
  { id: "home", label: "Home" },
  { id: "dashboard", label: "Dashboard" },
  { id: "chat", label: "Chat" },
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "settings", label: "Settings" },
  { id: "login", label: "Login / Register" }
];

export default function Sidebar({ activeItem }: SidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>PP</div>
        <div className={styles.logoText}>
          <div className={styles.logoTitle}>Ping Pong</div>
          <div className={styles.logoSubtitle}>Hub</div>
        </div>
      </div>
      
      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeItem === item.id ? styles.active : ""}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className={styles.newGameBtn}>+ New Game</button>
    </div>
  );
}