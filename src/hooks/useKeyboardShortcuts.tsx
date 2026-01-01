import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: "d",
      ctrl: true,
      action: () => navigate("/dashboard"),
      description: "Go to Dashboard",
    },
    {
      key: "a",
      ctrl: true,
      action: () => navigate("/assignments"),
      description: "Go to Assignments",
    },
    {
      key: "p",
      ctrl: true,
      action: () => navigate("/projects"),
      description: "Go to Projects",
    },
    {
      key: "n",
      ctrl: true,
      action: () => navigate("/notifications"),
      description: "Go to Notifications",
    },
    {
      key: "s",
      ctrl: true,
      action: () => navigate("/settings"),
      description: "Go to Settings",
    },
    {
      key: "/",
      ctrl: true,
      action: () => {
        // Focus search input if available
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: "Focus search",
    },
  ];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape to blur inputs
        if (event.key === "Escape") {
          target.blur();
        }
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts;
}

// Hook to show keyboard shortcuts help
export function useShowShortcutsHelp() {
  const shortcuts = [
    { keys: ["Ctrl", "D"], description: "Go to Dashboard" },
    { keys: ["Ctrl", "A"], description: "Go to Assignments" },
    { keys: ["Ctrl", "P"], description: "Go to Projects" },
    { keys: ["Ctrl", "N"], description: "Go to Notifications" },
    { keys: ["Ctrl", "S"], description: "Go to Settings" },
    { keys: ["Ctrl", "/"], description: "Focus search" },
    { keys: ["Esc"], description: "Close modal / Blur input" },
  ];

  return shortcuts;
}
