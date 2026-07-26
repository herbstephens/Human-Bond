/**
 * The primary CTA on agent surfaces — the "alive" button.
 *
 * Rule (CLAUDE.md · Chat rules #4): one per view; black pill, uppercase
 * micro-tracking, and a breathing amber glow so it visibly *lives* —
 * unmistakably an action, never a chat bubble.
 */
'use client';

export function AliveCta({
  children,
  onClick,
  className = '',
  disabled = false,
  glow = true,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  /** Held down while a transaction is in flight — the glow stops, so the button
   *  stops inviting a second tap that would open a second MiniKit popup. */
  disabled?: boolean;
  /** The breathing amber glow. Off on calm surfaces like the landing hero. */
  glow?: boolean;
}) {
  return (
    <>
      <style>{`
        @keyframes hbCtaBreathe {
          0%, 100% { box-shadow: 0 0 6px 1px rgba(245,158,11,.35), 0 12px 30px rgba(0,0,0,.15); transform: scale(1); }
          50% { box-shadow: 0 0 30px 8px rgba(245,158,11,.45), 0 12px 30px rgba(0,0,0,.12); transform: scale(1.015); }
        }
      `}</style>
      {/* Black pill + white text; the amber BREATHING GLOW is what makes it the
          action — user bubbles are gray, agent bubbles white, so black is unique. */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`bg-black text-white font-black uppercase transition-colors active:scale-95 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-900'
        } ${className}`}
        style={disabled || !glow ? undefined : { animation: 'hbCtaBreathe 2.6s ease-in-out infinite' }}
      >
        {children}
      </button>
    </>
  );
}
