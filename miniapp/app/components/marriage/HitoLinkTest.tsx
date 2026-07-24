"use client";

/**
 * Temporary probe for the Hito integration.
 *
 * Two questions, and they have different answers:
 *
 *   A. Can a World mini app hand off to an https URL (hito.dev/sign?...)?
 *      This only reaches the Hito *app* if hito.dev serves a Universal Link
 *      (iOS apple-app-site-association) / App Link (Android assetlinks.json)
 *      for /sign. Otherwise it just opens the website.
 *
 *   B. Can it hand off to a custom scheme (hito://sign?...)?
 *      Unknown schemes inside a WKWebView/Chrome-webview only work if the host
 *      app — World App — forwards them to the OS. Many webviews swallow them.
 *
 * Times three trigger methods, because webviews treat them differently. The
 * readout below says whether we came back intact. Delete this file once we know.
 */

import { useEffect, useRef, useState } from "react";
import { encodeFunctionData } from "viem";
import { ExternalLink, ArrowLeftRight, Radio, Frame, Copy, Check } from "lucide-react";
import { useAuthStore } from "@/state/authStore";
import { isInWorldApp } from "@/lib/worldcoin/initMiniKit";
import { HUMAN_BOND_ABI, WORLD_APP_CONFIG } from "@/lib/contracts";

// Real HumanBond calldata, so the URL length is representative of the actual
// payload — not a toy string that would pass a test a real tx would fail.
const SAMPLE_TX_HEX = encodeFunctionData({
    abi: HUMAN_BOND_ABI,
    functionName: "claimYield",
    args: ["0x2222222222222222222222222222222222222222"],
});

/** Where World App should land us after Hito is done. Give this to Hito as the return URL. */
const RETURN_DEEP_LINK = `https://world.org/mini-app?app_id=${WORLD_APP_CONFIG.APP_ID}&path=${encodeURIComponent("/home")}`;

type Target = { id: string; label: string; url: string; note: string };

const TARGETS: Target[] = [
    {
        id: "plain",
        label: "hito.xyz (plain website)",
        url: "https://www.hito.xyz/",
        note: "baseline — just checks that any external link works",
    },
    {
        id: "https-deeplink",
        label: "https://hito.dev/sign?…",
        url: `https://hito.dev/sign?chain=world&tx=${SAMPLE_TX_HEX}`,
        note: "opens the Hito app only if hito.dev serves a Universal/App Link for /sign",
    },
    {
        id: "scheme",
        label: "hito://sign?…",
        url: `hito://sign?chain=world&tx=${SAMPLE_TX_HEX}`,
        note: "needs World App to forward unknown schemes to the OS",
    },
    // Controls. Without these, a dead hito:// link is ambiguous — is World App
    // blocking schemes, or is the Hito app simply not installed? These use apps
    // that are definitely installed, so they isolate World App's behaviour from
    // Hito's setup.
    {
        id: "control-scheme",
        label: "CONTROL — whatsapp://",
        url: "whatsapp://send?text=hito%20test",
        note: "if this fails too, World App blocks ALL custom schemes",
    },
    {
        id: "control-universal",
        label: "CONTROL — https://t.me/telegram",
        url: "https://t.me/telegram",
        note: "a known-good Universal Link — proves World App lets them fire at all",
    },
];

// Set once per JS bundle load. If this resets, the whole webview reloaded.
const BUNDLE_LOADED_AT = Date.now();

const SESSION_KEY = "hito-test-session";   // survives a reload inside the same tab
const LOCAL_KEY = "hito-test-local";       // survives everything short of clearing storage
// The log is persisted because reporting a result means switching apps to paste it,
// and an in-memory log would be gone by the time you come back to read it.
const LOG_KEY = "hito-test-log";

function loadLog(): string[] {
    try {
        const raw = window.localStorage.getItem(LOG_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

function saveLog(lines: string[]) {
    try {
        window.localStorage.setItem(LOG_KEY, JSON.stringify(lines));
    } catch { /* storage full or blocked — the in-memory log still works */ }
}

function readOrSeed(storage: Storage, key: string): { value: string; isNew: boolean } {
    const existing = storage.getItem(key);
    if (existing) return { value: existing, isNew: false };
    const fresh = new Date().toLocaleTimeString();
    storage.setItem(key, fresh);
    return { value: fresh, isNew: true };
}

export function HitoLinkTest() {
    const { isVerified, walletAddress } = useAuthStore();
    const [target, setTarget] = useState<Target>(TARGETS[1]);
    const [bundleAge, setBundleAge] = useState(0);
    const [copied, setCopied] = useState(false);
    const leftPageRef = useRef(false);

    // Everything below is client-only (storage, MiniKit) so it stays null until
    // mounted — one state object, so the effect only has a single setState.
    type Probe = {
        inWorldApp: boolean;
        session: { value: string; isNew: boolean };
        local: { value: string; isNew: boolean };
        log: string[];
    };
    const [probe, setProbe] = useState<Probe | null>(null);
    const log = probe?.log ?? [];
    const session = probe?.session ?? null;
    const local = probe?.local ?? null;
    const inWorldApp = probe?.inWorldApp ?? false;

    const push = (line: string) => {
        const entry = `${new Date().toLocaleTimeString()} — ${line}`;
        setProbe((prev) => {
            if (!prev) return prev;
            const log = [entry, ...prev.log].slice(0, 20);
            saveLog(log);
            return { ...prev, log };
        });
    };

    useEffect(() => {
        // Storage and MiniKit only exist on the client, so this has to happen after
        // mount — reading them during render would break hydration. One extra render
        // on mount, in a throwaway probe.
        const mountLine = `${new Date().toLocaleTimeString()} — component mounted (FRESH LOAD)`;
        const restoredLog = [mountLine, ...loadLog()].slice(0, 20);
        saveLog(restoredLog);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProbe({
            inWorldApp: isInWorldApp(),
            session: readOrSeed(window.sessionStorage, SESSION_KEY),
            local: readOrSeed(window.localStorage, LOCAL_KEY),
            log: restoredLog,
        });

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                leftPageRef.current = true;
                push("visibilitychange → hidden");
                return;
            }
            // Freeze the answer at the exact moment of return, so it survives however
            // long it takes to read or report it.
            const age = Math.round((Date.now() - BUNDLE_LOADED_AT) / 1000);
            const s = window.sessionStorage.getItem(SESSION_KEY) ? "kept" : "LOST";
            const l = window.localStorage.getItem(LOCAL_KEY) ? "kept" : "LOST";
            push(`RETURNED — bundle ${age}s · tab session ${s} · localStorage ${l}`);
        };
        const onPageShow = (e: PageTransitionEvent) =>
            push(`pageshow (${e.persisted ? "from bfcache" : "fresh load"})`);
        const onFocus = () => push("window focus");
        const onBlur = () => { leftPageRef.current = true; push("window blur"); };

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pageshow", onPageShow);
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);

        const tick = setInterval(() => setBundleAge(Math.floor((Date.now() - BUNDLE_LOADED_AT) / 1000)), 1000);

        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pageshow", onPageShow);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
            clearInterval(tick);
        };
    }, []);

    /**
     * Nothing fires an error when a webview silently drops a custom scheme, so
     * infer it: if we never lost focus/visibility within 2.5s, nobody took it.
     */
    const watchForHandoff = (method: string) => {
        leftPageRef.current = false;
        setTimeout(() => {
            if (leftPageRef.current) push(`${method} → something took over (app or browser opened)`);
            else push(`${method} → NOTHING happened, link was swallowed`);
        }, 2500);
    };

    const openWithWindowOpen = () => {
        push(`window.open → ${target.id}`);
        const w = window.open(target.url, "_blank", "noopener,noreferrer");
        push(w ? "window.open returned a handle" : "window.open returned null (blocked)");
        watchForHandoff("window.open");
    };

    const openSameTab = () => {
        push(`location.href → ${target.id}`);
        watchForHandoff("location.href");
        window.location.href = target.url;
    };

    /** Classic webview workaround for custom schemes: navigate a hidden iframe. */
    const openViaIframe = () => {
        push(`hidden iframe → ${target.id}`);
        watchForHandoff("iframe");
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = target.url;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 3000);
    };

    /** Re-baseline the storage markers so the survival test can be run again. */
    const resetMarkers = () => {
        window.sessionStorage.removeItem(SESSION_KEY);
        window.localStorage.removeItem(LOCAL_KEY);
        window.localStorage.removeItem(LOG_KEY);
        setProbe((prev) =>
            prev
                ? {
                      ...prev,
                      session: readOrSeed(window.sessionStorage, SESSION_KEY),
                      local: readOrSeed(window.localStorage, LOCAL_KEY),
                  }
                : prev,
        );
        push("markers reset — baseline is now");
    };

    const copyReturnLink = async () => {
        try {
            await navigator.clipboard.writeText(RETURN_DEEP_LINK);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            push("clipboard blocked");
        }
    };

    return (
        <div className="bg-white rounded-[2rem] p-6 border-2 border-dashed border-indigo-200 space-y-5">
            <div className="flex items-center gap-2">
                <Radio size={16} className="text-indigo-500" />
                <h4 className="text-sm font-black text-gray-900 tracking-tight">Hito handoff test</h4>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-indigo-400">temporary</span>
            </div>

            {/* Which URL to fire */}
            <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Target</p>
                {TARGETS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTarget(t)}
                        className={`w-full text-left px-4 py-3 rounded-2xl border transition-all ${
                            target.id === t.id
                                ? "bg-indigo-50 border-indigo-200"
                                : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                        }`}
                    >
                        <p className={`text-xs font-bold ${target.id === t.id ? "text-indigo-700" : "text-gray-700"}`}>
                            {t.label}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{t.note}</p>
                    </button>
                ))}
                <p className="font-mono text-[9px] text-gray-400 break-all leading-relaxed pt-1">
                    {target.url.length > 120 ? `${target.url.slice(0, 120)}…` : target.url}
                    <span className="text-gray-300"> ({target.url.length} chars)</span>
                </p>
            </div>

            {/* How to fire it */}
            <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Method</p>

                <a
                    href={target.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { push(`anchor _blank → ${target.id}`); watchForHandoff("anchor"); }}
                    className="w-full py-3.5 px-5 rounded-2xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all flex items-center justify-between"
                >
                    <span className="flex items-center gap-2">
                        <ExternalLink size={15} className="text-indigo-500" />
                        1. Anchor target=&quot;_blank&quot;
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">most likely to work</span>
                </a>

                <button
                    onClick={openWithWindowOpen}
                    className="w-full py-3.5 px-5 rounded-2xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all flex items-center justify-between"
                >
                    <span className="flex items-center gap-2">
                        <ExternalLink size={15} className="text-indigo-500" />
                        2. window.open()
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">often blocked</span>
                </button>

                <button
                    onClick={openSameTab}
                    className="w-full py-3.5 px-5 rounded-2xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all flex items-center justify-between"
                >
                    <span className="flex items-center gap-2">
                        <ArrowLeftRight size={15} className="text-amber-500" />
                        3. Same tab (location.href)
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">leaves the app</span>
                </button>

                <button
                    onClick={openViaIframe}
                    className="w-full py-3.5 px-5 rounded-2xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all flex items-center justify-between"
                >
                    <span className="flex items-center gap-2">
                        <Frame size={15} className="text-gray-400" />
                        4. Hidden iframe
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">scheme fallback</span>
                </button>
            </div>

            {/* Survival readout — this is the actual answer we're after */}
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Session survival</p>
                <button
                    onClick={resetMarkers}
                    className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-600"
                >
                    Reset markers
                </button>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 space-y-1.5 font-mono text-[10px] text-gray-600">
                <Row label="in World App" value={inWorldApp ? "yes" : "no"} />
                <Row label="World ID verified" value={isVerified ? "yes" : "NO — lost it"} bad={!isVerified} />
                <Row label="wallet" value={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "none"} bad={!walletAddress} />
                <Row label="JS bundle age" value={`${bundleAge}s`} />
                <Row
                    label="tab session"
                    value={session ? (session.isNew ? `new (${session.value})` : `kept from ${session.value}`) : "…"}
                    bad={session?.isNew}
                />
                <Row
                    label="localStorage"
                    value={local ? (local.isNew ? `new (${local.value})` : `kept from ${local.value}`) : "…"}
                    bad={local?.isNew}
                />
            </div>

            <div className="rounded-2xl bg-gray-900 p-4 max-h-44 overflow-y-auto">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Event log</p>
                {log.map((line, i) => (
                    <p key={i} className="font-mono text-[9px] text-emerald-400 leading-relaxed">{line}</p>
                ))}
            </div>

            {/* The way back in — Hito needs this to return the user to us */}
            <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">Return deep link (for Hito)</p>
                    <button onClick={copyReturnLink} className="text-indigo-500 shrink-0">
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                </div>
                <p className="font-mono text-[9px] text-indigo-800 break-all leading-relaxed">{RETURN_DEEP_LINK}</p>
                <p className="text-[10px] text-indigo-600/70 leading-relaxed">
                    Tap it from outside World App to confirm it reopens this mini app on /home.
                </p>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed">
                <strong className="text-gray-600">How to read it:</strong> the log says whether the link was taken or
                swallowed. If you come back and the bundle age kept counting, World App only put a browser on top and
                nothing was lost. If it reset to 0s but localStorage says &quot;kept&quot;, the mini app reloaded and
                World ID came back from storage. If localStorage says &quot;new&quot;, we got a clean webview and the
                session is gone.
            </p>
        </div>
    );
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-gray-400">{label}</span>
            <span className={bad ? "text-red-500 font-bold" : "text-gray-800"}>{value}</span>
        </div>
    );
}
