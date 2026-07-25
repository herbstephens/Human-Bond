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
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <>
      <style>{`
        @keyframes hbCtaBreathe {
          0%, 100% { box-shadow: 0 0 6px 1px rgba(245,158,11,.35), 0 12px 30px rgba(0,0,0,.15); transform: scale(1); }
          50% { box-shadow: 0 0 30px 8px rgba(245,158,11,.45), 0 12px 30px rgba(0,0,0,.12); transform: scale(1.015); }
        }
      `}</style>
      {/* Action color = the spark's amber. Never black (user bubbles) or white (agent bubbles). */}
      <button
        onClick={onClick}
        className={`bg-amber-400 text-black font-black uppercase hover:bg-amber-300 transition-colors active:scale-95 ${className}`}
        style={{ animation: 'hbCtaBreathe 2.6s ease-in-out infinite' }}
      >
        {children}
      </button>
    </>
  );
}
