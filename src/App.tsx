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
import { SettingsView } from "./features/settings/SettingsView";
import { StartTaskSheet } from "./features/start/StartTaskSheet";
import { TimelinePanel } from "./features/timeline/TimelinePanel";
import { TodayView } from "./features/today/TodayView";
import { useTaskDetails } from "./features/today/useTaskDetails";
import { WideShell, type WideView } from "./features/wide/WideShell";
import { DEFAULT_SETTINGS } from "./data/settings";
import { useDesktop } from "./hooks/useDesktop";
import { useSettings } from "./hooks/useSettings";
import { useStoredChoice, useStoredFlag } from "./hooks/useStoredFlag";
import { useTodayKey } from "./hooks/useTodayKey";
import { useWorkday } from "./hooks/useWorkday";
import { fromLocalDayKey } from "./lib/date";
import { totalSeconds } from "./lib/sessionMath";
import { hideToTray, resizeForMode, setPinned, type WindowMode } from "./lib/window";

/** Window modes remembered between runs; the mini bar always reopens as the last of these. */
const OPEN_MODES = ["expanded", "wide"] as const;

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
  const todayKey = useTodayKey();
  // The title bar shows the work day, so a night shift keeps its date after midnight
  const date = useMemo(() => fromLocalDayKey(todayKey), [todayKey]);
  const showToast = useToast();
  const onSaveError = useCallback((): void => {
    showToast({ message: "Couldn’t save that change. Try again.", tone: "error" });
  }, [showToast]);
  const settingsState = useSettings(onSaveError);
  const settings = settingsState.settings ?? DEFAULT_SETTINGS;
  // Tasks wait for settings, so carry-over follows the Carry over setting
  const work = useWorkday(todayKey, settingsState.settings?.carryOver, onSaveError, showToast);
  const { running, todaySessions, trackedByTask } = work.timer;
  const details = useTaskDetails(work, settings.defaultReminderMinutes);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Bumped to focus quick add (Ctrl+Shift+Space or the tray)
  const [quickAddFocus, setQuickAddFocus] = useState(0);
  // 1a shows the timeline open; the last choice is remembered
  const [timelineOpen, setTimelineOpen] = useStoredFlag("timi.timelineOpen", true);
  const [tab, setTab] = useState<Tab>("today");
  // Expanded or wide is remembered; the window-state plugin remembers the position
  const [storedMode, setStoredMode] = useStoredChoice("timi.windowMode", OPEN_MODES, "expanded");
  const [mode, setMode] = useState<WindowMode>(storedMode);
  const [lastOpenMode, setLastOpenMode] = useState<Exclude<WindowMode, "mini">>(storedMode);
  // Matches alwaysOnTop: true in tauri.conf.json
  const [pinned, setPinnedState] = useState(true);

  // Size the window to the remembered mode on start, so a reload (e.g. in development) can't
  // leave one layout inside another mode's window size
  useEffect(() => {
    void resizeForMode(storedMode);
    // Only on start: later changes resize in changeMode
  }, []);

  const changeMode = (next: WindowMode): void => {
    // The popover's anchor won't survive the layout change
    details.close();
    setMode(next);
    if (next !== "mini") {
      setLastOpenMode(next);
      setStoredMode(next);
    }
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
    setSettingsOpen(false);
    setTab("today");
    if (mode === "mini") changeMode(lastOpenMode);
    setSheetOpen(true);
  };

  // The open task the tray's Resume and the mini bar's paused state restart: the last one timed today
  const lastSession = todaySessions.length > 0 ? todaySessions[todaySessions.length - 1] : undefined;
  const resumable =
    !running && lastSession
      ? (work.list.tasks.find((task) => task.id === lastSession.taskId && !task.completedAt) ?? null)
      : null;

  useDesktop({
    work,
    resumable,
    onQuickAdd: () => {
      details.close();
      setSettingsOpen(false);
      setSheetOpen(false);
      setTab("today");
      if (mode === "mini") changeMode(lastOpenMode);
      setQuickAddFocus((count) => count + 1);
    },
    onStartSheet: openSheet,
  });

  // Timeline bars open the task details popover when the task is on today's list
  const barActions = {
    canOpen: (taskId: string): boolean => work.list.tasks.some((task) => task.id === taskId),
    onOpen: (taskId: string, bar: HTMLElement): void => {
      details.toggle(taskId, bar, bar);
    },
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
    if (running) miniState = { kind: "running", session: running };
    else if (resumable)
      miniState = { kind: "paused", task: resumable, trackedSeconds: trackedByTask.get(resumable.id) ?? 0 };
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

  if (settingsOpen) {
    return (
      <WindowFrame blobs={wide ? BLOBS_WIDE_LOG : BLOBS_LOG}>
        <SettingsView
          variant={wide ? "wide" : "expanded"}
          settings={settings}
          onChange={settingsState.update}
          onBack={() => {
            setSettingsOpen(false);
          }}
          onClose={() => {
            void hideToTray();
          }}
        />
        <ToastViewport bottomClass="bottom-4" />
      </WindowFrame>
    );
  }

  const openSettings = (): void => {
    details.close();
    setSheetOpen(false);
    setSettingsOpen(true);
  };

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
        void hideToTray();
      }}
      onOpenSettings={openSettings}
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
          details={details}
          barActions={barActions}
          onStartTask={openSheet}
          sheet={wideView === "today-calendar" && sheet}
          focusQuickAdd={quickAddFocus}
        />
        {/* Above the footer, and above the timeline strip in Today + Calendar (drafted) */}
        <ToastViewport bottomClass={wideView === "log" ? "bottom-12" : "bottom-51"} />
        {details.popover}
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
          onClick={openSettings}
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
            <TodayView
              work={work}
              variant="expanded"
              onStartTask={openSheet}
              details={details}
              focusQuickAdd={quickAddFocus}
            />
            <FooterBar total={todayTotal} />
            {timelineOpen ? (
              <TimelinePanel
                todayKey={todayKey}
                timer={work.timer}
                onCollapse={() => {
                  setTimelineOpen(false);
                }}
                {...barActions}
              />
            ) : (
              <TimelineCollapsedBar
                total={todayTotal}
                onExpand={() => {
                  setTimelineOpen(true);
                }}
              />
            )}
          </>
        )}
        {tab === "calendar" && <CalendarEmpty className="flex-1 p-7" />}
        {tab === "log" && <LogView variant="expanded" todayKey={todayKey} timer={work.timer} />}
      </div>
      {/* 1a script: 236px from the bottom with the timeline open, 64px with it collapsed */}
      <ToastViewport bottomClass={tab !== "today" ? "bottom-4" : timelineOpen ? "bottom-59" : "bottom-16"} />
      {sheet}
      {details.popover}
    </WindowFrame>
  );
}

export default App;
