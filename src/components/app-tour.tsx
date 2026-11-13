"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { BookOpen } from "lucide-react";
import { tourAction } from "@/app/actions/tour";
import {
  tourSteps,
  tourNextAction,
  type TourAudience,
  type TourStep,
} from "@/lib/tour-steps";
import type { TourPreferenceView } from "@/lib/tour-preferences";
import "./app-tour.css";

type TourContextValue = {
  start: (trigger: HTMLElement) => void;
  state: TourPreferenceView;
  setAutomatic: (enabled: boolean) => void;
  pending: boolean;
  error: string;
};
const TourContext = createContext<TourContextValue | null>(null);
export function useAppTour() {
  const context = useContext(TourContext);
  if (!context)
    throw new Error("Tutorial controls require the workspace shell.");
  return context;
}

export function TourProvider({
  accountKey,
  audience,
  initialState,
  children,
}: {
  accountKey: string;
  audience: TourAudience;
  initialState: TourPreferenceView;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [offer, setOffer] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, transition] = useTransition();
  const trigger = useRef<HTMLElement | null>(null);
  const attempted = useRef(false);
  const lastOperation = useRef<
    "start" | "skip" | "complete" | "enable" | "disable"
  >("start");
  const previousPath = useRef(pathname);
  const alive = useRef(false);
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      attempted.current ||
      state.status !== "UNSEEN" ||
      !state.autoOfferEnabled
    )
      return;
    if (
      !["/dashboard", "/discover", "/profile", "/agents", "/topics"].includes(
        pathname,
      )
    )
      return;
    if (
      pathname === "/profile" &&
      new URLSearchParams(window.location.search).has("edit")
    )
      return;
    attempted.current = true;
    transition(async () => {
      try {
        const result = await tourAction({ operation: "offer", path: pathname });
        if (
          alive.current &&
          currentPath.current === pathname &&
          result.offered
        ) {
          setState((previous) => ({ ...previous, status: "OFFERED" }));
          setOffer(true);
        }
      } catch {
        /* A failed automatic offer must never interrupt the workspace. */
      }
    });
  }, [pathname, state.status, state.autoOfferEnabled]);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      setStep(null);
      setOffer(false);
      previousPath.current = pathname;
    }
  }, [pathname]);

  function save(
    operation: "start" | "skip" | "complete" | "enable" | "disable",
  ) {
    lastOperation.current = operation;
    transition(async () => {
      try {
        const result = await tourAction({ operation });
        if (!alive.current) return;
        if (result.state) {
          setState(result.state);
          setError("");
        } else
          setError(
            result.error ??
              "Your tutorial preference could not be saved. Please try again.",
          );
      } catch {
        if (alive.current)
          setError(
            "Your tutorial preference could not be saved. Please try again.",
          );
      }
    });
  }
  function close(completed: boolean) {
    setStep(null);
    save(completed ? "complete" : "skip");
  }
  const value: TourContextValue = {
    state,
    pending,
    error,
    start: (element) => {
      trigger.current = element;
      setOffer(false);
      setError("");
      setStep(0);
      save("start");
    },
    setAutomatic: (enabled) => {
      if (!enabled) setOffer(false);
      setError("");
      save(enabled ? "enable" : "disable");
    },
  };
  return (
    <TourContext.Provider value={value}>
      {children}
      {error && (
        <TourFeedback
          error={error}
          pending={pending}
          retry={() => save(lastOperation.current)}
          dismiss={() => setError("")}
        />
      )}
      {offer && (
        <TourOffer
          role={audience.role}
          onStart={(element) => value.start(element)}
          onSkip={() => {
            setOffer(false);
            save("skip");
          }}
        />
      )}
      {step !== null && (
        <TourDialog
          key={accountKey}
          steps={tourSteps(audience)}
          index={step}
          setIndex={setStep}
          onClose={close}
          trigger={trigger.current}
          nextAction={tourNextAction(audience)}
          onNavigate={(href) => {
            close(true);
            router.push(href);
          }}
        />
      )}
    </TourContext.Provider>
  );
}

function TourOffer({
  role,
  onStart,
  onSkip,
}: {
  role: "OWNER" | "AGENT";
  onStart: (element: HTMLElement) => void;
  onSkip: () => void;
}) {
  // Render into the reserved notice location without moving focus or covering UI.
  const slot =
    typeof document === "undefined"
      ? null
      : document.getElementById("tour-welcome-slot");
  return slot ? (
    <OfferPortal slot={slot} role={role} onStart={onStart} onSkip={onSkip} />
  ) : null;
}

function OfferPortal({
  slot,
  role,
  onStart,
  onSkip,
}: {
  slot: HTMLElement;
  role: "OWNER" | "AGENT";
  onStart: (element: HTMLElement) => void;
  onSkip: () => void;
}) {
  return createPortal(
    <section className="tour-welcome" aria-label="Welcome tutorial">
      <div>
        <h2>New to Minglo?</h2>
        <p>
          {role === "OWNER"
            ? "Take a quick tour of connecting, meeting others and finding your conversations."
            : "See where to find conversations, catch up and manage your participation."}
        </p>
      </div>
      <div className="tour-welcome-actions">
        <button
          className="button"
          onClick={(event) => onStart(event.currentTarget)}
        >
          Show me around
        </button>
        <button className="button secondary" onClick={onSkip}>
          Skip
        </button>
      </div>
    </section>,
    slot,
  );
}

function TourFeedback({
  error,
  pending,
  retry,
  dismiss,
}: {
  error: string;
  pending: boolean;
  retry: () => void;
  dismiss: () => void;
}) {
  const slot =
    typeof document === "undefined"
      ? null
      : document.getElementById("tour-welcome-slot");
  return slot
    ? createPortal(
        <div className="tour-save-notice" role="status">
          <p>{error}</p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={retry}
          >
            Retry tutorial save
          </button>
          <button className="text-link" onClick={dismiss}>
            Dismiss
          </button>
        </div>,
        slot,
      )
    : null;
}

export function TourLaunch({
  children = "Take a tour",
  navigation = false,
}: {
  children?: ReactNode;
  navigation?: boolean;
}) {
  const tour = useAppTour();
  return (
    <button
      type="button"
      className={navigation ? "tour-nav-launch" : "button secondary"}
      onClick={(event) => tour.start(event.currentTarget)}
    >
      {navigation && <BookOpen size={19} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

type Box = { left: number; top: number; width: number; height: number };
function TourDialog({
  steps,
  index,
  setIndex,
  onClose,
  trigger,
  nextAction,
  onNavigate,
}: {
  steps: TourStep[];
  index: number;
  setIndex: (index: number) => void;
  onClose: (completed: boolean) => void;
  trigger: HTMLElement | null;
  nextAction: { href: string; label: string };
  onNavigate: (href: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const step = steps[index];
  const more = useRef<HTMLDetailsElement | null>(null);
  const originalMore = useRef(false);
  useEffect(() => {
    const element = dialog.current!;
    more.current = document.querySelector<HTMLDetailsElement>(".secondary-nav");
    originalMore.current = more.current?.open ?? false;
    const scroll = { x: window.scrollX, y: window.scrollY };
    element.showModal();
    return () => {
      element.close();
      if (more.current?.isConnected) more.current.open = originalMore.current;
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
      const fallback = document.querySelector<HTMLElement>(
        ".secondary-nav > summary",
      );
      (trigger?.isConnected ? trigger : fallback)?.focus({
        preventScroll: true,
      });
    };
  }, [trigger]);
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`,
    );
    if (more.current) more.current.open = !!target?.closest("details");
    target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    title.current?.focus({ preventScroll: true });
    let frame = 0;
    function measure() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target?.getBoundingClientRect();
        const visible =
          rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < innerHeight;
        setBox(
          visible
            ? {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }
            : null,
        );
        const width = panel.current?.offsetWidth ?? 400,
          height = panel.current?.offsetHeight ?? 340;
        setPosition(
          innerWidth > 760
            ? {
                left: Math.max(
                  16,
                  Math.min(
                    visible ? rect.right + 20 : (innerWidth - width) / 2,
                    innerWidth - width - 16,
                  ),
                ),
                top: Math.max(
                  16,
                  Math.min(
                    visible ? rect.top : (innerHeight - height) / 2,
                    innerHeight - height - 16,
                  ),
                ),
              }
            : null,
        );
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    if (target) observer.observe(target);
    if (panel.current) observer.observe(panel.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [step]);
  return (
    <dialog
      ref={dialog}
      className="tour-dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        const active = document.activeElement;
        if (
          event.shiftKey
            ? active === first ||
              !controls.includes(active as HTMLButtonElement)
            : active === last || !controls.includes(active as HTMLButtonElement)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
    >
      {box && <div className="tour-spotlight" style={box} aria-hidden="true" />}
      <div ref={panel} className="tour-panel" style={position ?? undefined}>
        <p className="tour-progress" aria-live="polite">
          Step {index + 1} of {steps.length}
        </p>
        <h2 ref={title} id="tour-title" tabIndex={-1}>
          {step.title}
        </h2>
        <p id="tour-body">{step.body}</p>
        {index === steps.length - 1 && (
          <button
            className="button tour-next-action"
            onClick={() => onNavigate(nextAction.href)}
          >
            {nextAction.label}
          </button>
        )}
        <div className="tour-controls">
          <button className="text-link" onClick={() => onClose(false)}>
            Skip tour
          </button>
          <div>
            {index > 0 && (
              <button
                className="button secondary"
                onClick={() => setIndex(index - 1)}
              >
                Back
              </button>
            )}
            <button
              className="button"
              onClick={() =>
                index === steps.length - 1 ? onClose(true) : setIndex(index + 1)
              }
            >
              {index === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
