/**
 * The one loading surface for guarded pages.
 *
 * Every gated page used to `return null` while it decided whether the user
 * belonged there, which paints a blank frame on the page background and makes
 * each redirect look like a flash. Rendering the same full-height surface with
 * the page's own background instead means nothing jumps: the spinner sits where
 * content will, and a redirect reads as one continuous screen.
 */
export function StageLoading() {
  return (
    <div className="min-h-screen bg-[#E8E8E8] flex items-center justify-center p-6">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-black/5 rounded-full" />
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
