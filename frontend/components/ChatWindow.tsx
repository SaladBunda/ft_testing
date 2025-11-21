"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, Message } from "../app/chat/page";
import styles from "./ChatWindow.module.css";

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string, getPending: number) => void;
}

export default function ChatWindow({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ! handle blocked users
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue, 0);
      setInputValue("");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.avatarContainer}>
            <img
              src={conversation.avatar}
              alt={conversation.name}
              className={styles.avatar}
            />
            {conversation.status === "online" && (
              <div className={styles.onlineIndicator}></div>
            )}
          </div>
          <div className={styles.userDetails}>
            <h3 className={styles.userName}>{conversation.name}</h3>
            <span className={styles.userStatus}>
              {conversation.status === "online" ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.messagesContainer}>
      
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${styles.messageWrapper} ${
              (message.sender_id === currentUserId || message.sender_id === currentUserId.toString()) ? styles.sent : styles.received
            }`}
          >
            <div className={styles.message}>
              <div className={styles.messageContent}>
                {message.content}
              </div>
              <div className={styles.messageTime}>
                {message.sender_name} • {formatTime(message.sent_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Message Alex..."
          className={styles.messageInput}
        />
        <button type="submit" className={styles.sendButton}>
          Send
        </button>
      </form>
    </div>
  );
}