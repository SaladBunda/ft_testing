"use client";

import styles from "./QuickActions.module.css";

const quickActions = [
  "Start Quick Play",
  "Invite to Match",
  "View Profile",
  "Create Group Chat"
];

export default function QuickActions() {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Quick Actions</h3>
      <div className={styles.actionsGrid}>
        {quickActions.map((action, index) => (
          <button key={index} className={styles.actionButton}>
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}