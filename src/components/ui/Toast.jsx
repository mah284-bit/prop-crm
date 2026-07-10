import React, { useEffect } from "react";

export default function Toast({ msg, type = "success", onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const bgColor = type === "success" ? "#E6F4EE" : type === "error" ? "#FAEAEA" : "#FFF3CD";
  const textColor = type === "success" ? "#1A7F5A" : type === "error" ? "#B83232" : "#856404";
  const borderColor = type === "success" ? "#A8D5BE" : type === "error" ? "#F0BCBC" : "#FFEEBA";

  return (
    <div style={{
      position: "fixed",
      bottom: "2rem",
      right: "2rem",
      background: bgColor,
      color: textColor,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 8,
      padding: "12px 18px",
      fontSize: 13,
      fontWeight: 600,
      zIndex: 10000,
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      animation: "slideIn 0.3s ease"
    }}>
      {msg}
      <style>{`@keyframes slideIn { 0% { transform: translateX(400px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}
