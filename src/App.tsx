import { useCallback, useEffect, useMemo, useState } from "react";
import { FooterBar } from "./components/FooterBar";
import { Icon } from "./components/Icon";
import type { LiveTotal } from "./components/LiveDuration";
import { MiniBar, type MiniBarState } from "./components/MiniBar";
import { panelId, tabId, Tabs, type TabItem } from "./components/Tabs";
import { TimelineCollapsedBar } from "./components/TimelineCollapsedBar";
import { TitleBar } from "./components/TitleBar";
import { ToastProvider, ToastViewport, useToast } from "./components/Toast";
import {
  BLOBS_CALENDAR,
  BLOBS_LOG,
  BLOBS_TODAY,
  BLOBS_WIDE,
  BLOBS_WIDE_LOG,
  WindowFrame,
  type BlobLayout,
} from "./components/WindowFrame";
import { CalendarEmpty } from "./features/calendar/CalendarEmpty";
import { LogView } from "./features/log/LogView";
import { StartTaskSheet } from "./features/start/StartTaskSheet";
import { TodayView } from "./features/today/TodayView";
import { WideShell, type WideView } from "./features/wide/WideShell";
import { useLocalDate } from "./hooks/useLocalDate";
import { useWorkday } from "./hooks/useWorkday";
import { toLocalDayKey } from "./lib/date";
import { totalSeconds } from "./lib/sessionMath";
import { closeApp, resizeForMode, setPinned, type WindowMode } from "./lib/window";

type Tab = "today" | "calendar" | "log";

const TABS: readonly TabItem<Tab>[] = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "log", label: "Log" },
];

const WIDE_TABS: readonly TabItem<WideView>[] = [
  { id: "today-calendar", label: "Today + Calendar" },
  { id: "log", label: "Log" },
];

const TAB_BLOBS: Record<Tab, BlobLayout> = {
  today: BLOBS_TODAY,
  calendar: BLOBS_CALENDAR,
  log: BLOBS_LOG,
};

function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const date = useLocalDate();
  const showToast = useToast();
  const onSaveError = useCallback((): void => {
    showToast({ message: "Couldn’t save that change. Try again.", tone: "error" });
  }, [showToast]);
  const todayKey = toLocalDayKey(date);
  const work = useWorkday(todayKey, onSaveError, showToast);
  const { running, todaySessions, trackedByTask } = work.timer;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [mode, setMode] = useState<WindowMode>("expanded");
  const [lastOpenMode, setLastOpenMode] = useState<Exclude<WindowMode, "mini">>("expanded");
  // Matches alwaysOnTop: true in tauri.conf.json
  const [pinned, setPinnedState] = useState(true);

  // Size the window to the starting mode, so a reload (e.g. in development) can't leave
  // the expanded layout inside a mini-bar-sized window. Phase 4 remembers size and position.
  useEffect(() => {
    void resizeForMode("expanded");
  }, []);

  const changeMode = (next: WindowMode): void => {
    setMode(next);
    if (next !== "mini") setLastOpenMode(next);
    void resizeForMode(next);
  };

  // Today's total: closed sessions that started today, plus the running one if it started today
  const todayTotal = useMemo<LiveTotal>(
    () => ({
      baseSeconds: totalSeconds(
        todaySessions.filter((session) => session.endedAt !== null),
        Date.now(),
      ),
      runningSince: running && todaySessions.some((s) => s.id === running.id) ? running.startedAt : null,
    }),
    [running, todaySessions],
  );

  const openSheet = (): void => {
    // The sheet lives on the Today view (inside the Today pane in wide mode)
    setTab("today");
    if (mode === "mini") changeMode(lastOpenMode);
    setSheetOpen(true);
  };

  const togglePin = async (): Promise<void> => {
    const next = !pinned;
    setPinnedState(next);
    const ok = await setPinned(next);
    if (!ok) setPinnedState(!next);
  };

  if (mode === "mini") {
    // Paused: the last task timed today, if it is still open (1e)
    let miniState: MiniBarState = { kind: "idle" };
    if (running) {
      miniState = { kind: "running", session: running };
    } else {
      const last = todaySessions.length > 0 ? todaySessions[todaySessions.length - 1] : undefined;
      const task = last ? work.list.tasks.find((t) => t.id === last.taskId) : undefined;
      if (task && !task.completedAt) {
        miniState = { kind: "paused", task, trackedSeconds: trackedByTask.get(task.id) ?? 0 };
      }
    }
    return (
      <MiniBar
        state={miniState}
        total={todayTotal}
        onPause={work.timer.pause}
        onResume={work.startTask}
        onStart={openSheet}
        onExpand={() => {
          changeMode(lastOpenMode);
        }}
      />
    );
  }

  const wide = mode === "wide";
  const wideView: WideView = tab === "log" ? "log" : "today-calendar";

  const sheet = sheetOpen && (
    <StartTaskSheet
      variant={wide ? "wide" : "expanded"}
      todayKey={todayKey}
      runningTaskId={running?.taskId ?? null}
      onStart={work.startNew}
      onReplay={work.replay}
      onClose={() => {
        setSheetOpen(false);
      }}
    />
  );

  const titleBar = (
    <TitleBar
      date={date}
      pinned={pinned}
      wide={wide}
      onTogglePin={() => {
        void togglePin();
      }}
      onToggleWide={() => {
        changeMode(wide ? "expanded" : "wide");
      }}
      onCollapse={() => {
        changeMode("mini");
      }}
      onClose={() => {
        void closeApp();
      }}
      switcher={
        wide ? (
          <Tabs
            items={WIDE_TABS}
            selected={wideView}
            label="Views"
            variant="compact"
            onSelect={(view) => {
              if (view === "log") setTab("log");
              else if (tab === "log") setTab("today");
            }}
          />
        ) : undefined
      }
    />
  );

  if (wide) {
    return (
      <WindowFrame blobs={wideView === "log" ? BLOBS_WIDE_LOG : BLOBS_WIDE}>
        {titleBar}
        <WideShell
          view={wideView}
          todayKey={todayKey}
          total={todayTotal}
          work={work}
          onStartTask={openSheet}
          sheet={wideView === "today-calendar" && sheet}
        />
        <ToastViewport bottomClass="bottom-12" />
      </WindowFrame>
    );
  }

  return (
    <WindowFrame blobs={TAB_BLOBS[tab]}>
      {titleBar}

      <div className="relative z-1 flex shrink-0 items-center gap-1.5 px-3 pb-2.5">
        <Tabs items={TABS} selected={tab} label="Views" onSelect={setTab} />
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          aria-disabled="true"
          className="grid size-9.5 shrink-0 place-items-center rounded-control border border-white/80 bg-white/45 text-ink-muted hover:bg-white/80 hover:text-ink"
        >
          <Icon name="settings" size={18} />
        </button>
      </div>

      <div
        role="tabpanel"
        id={panelId(tab)}
        aria-labelledby={tabId(tab)}
        className="relative z-1 flex min-h-0 flex-1 flex-col"
      >
        {tab === "today" && (
          <>
            <TodayView work={work} variant="expanded" onStartTask={openSheet} />
            <FooterBar total={todayTotal} />
            <TimelineCollapsedBar total={todayTotal} />
          </>
        )}
        {tab === "calendar" && <CalendarEmpty className="flex-1 p-7" />}
        {tab === "log" && <LogView variant="expanded" todayKey={todayKey} timer={work.timer} />}
      </div>
      {/* 1a: 64px from the bottom, above the footer and collapsed timeline */}
      <ToastViewport bottomClass={tab === "today" ? "bottom-16" : "bottom-4"} />
      {sheet}
    </WindowFrame>
  );
}

export default App;
