// Kbd: atajo de teclado en mono 10.5 (header, palette, dropdowns).

export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={className}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--color-text-muted)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 4,
        padding: "1px 5px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </kbd>
  );
}
