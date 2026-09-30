"use client";

export default function OpenAssistantButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="btn" onClick={() => window.dispatchEvent(new Event("open-assistant"))}>
      {children}
    </button>
  );
}