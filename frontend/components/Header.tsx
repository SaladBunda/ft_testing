"use client";

import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search players, games"
          className={styles.searchInput}
        />
        <div className={styles.userAvatar}>
          <img 
            src="https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg?auto=compress&cs=tinysrgb&w=40&h=40&dpr=1"
            alt="User Avatar"
            className={styles.avatar}
          />
        </div>
      </div>
    </header>
  );
}