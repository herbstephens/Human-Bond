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
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0), 0 12px 30px rgba(0,0,0,.22); transform: scale(1); }
          50% { box-shadow: 0 0 26px 5px rgba(245,158,11,.35), 0 12px 30px rgba(0,0,0,.18); transform: scale(1.012); }
        }
      `}</style>
      <button
        onClick={onClick}
        className={`bg-black text-white font-black uppercase hover:bg-gray-900 transition-colors active:scale-95 ${className}`}
        style={{ animation: 'hbCtaBreathe 2.6s ease-in-out infinite' }}
      >
        {children}
      </button>
    </>
  );
}
