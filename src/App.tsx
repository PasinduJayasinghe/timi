import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FooterBar } from "./components/FooterBar";
import { Icon } from "./components/Icon";
import { LoadError } from "./components/LoadError";
import type { LiveTotal } from "./components/LiveDuration";
import { MiniBar, type MiniBarState } from "./components/MiniBar";
import { SyncChip } from "./components/SyncChip";
import { panelId, tabId, Tabs, type TabItem } from "./components/Tabs";
import { TimelineCollapsedBar } from "./components/TimelineCollapsedBar";
import { TitleBar } from "./components/TitleBar";
import { ToastProvider, ToastViewport, useToast } from "./components/Toast";
import {
  BLOBS_CALENDAR,
  BLOBS_CALENDAR_CONNECTED,
  BLOBS_LOG,
  BLOBS_TODAY,
  BLOBS_WIDE,
  BLOBS_WIDE_LOG,
  WindowFrame,
  type BlobLayout,
} from "./components/WindowFrame";
import { CalendarView } from "./features/calendar/CalendarView";
import { LogView } from "./features/log/LogView";
import { SettingsView } from "./features/settings/SettingsView";
import { EndShiftSheet } from "./features/shift/EndShiftSheet";
import { PlanMyDaySheet } from "./features/shift/PlanMyDaySheet";
import { BetweenShifts, EndShiftButton, LeftoversChip, ShiftNotice, ShiftStrip } from "./features/shift/ShiftParts";
import { StartTaskSheet } from "./features/start/StartTaskSheet";
import { TimelinePanel } from "./features/timeline/TimelinePanel";
import { TodayView } from "./features/today/TodayView";
import { useTaskDetails } from "./features/today/useTaskDetails";
import { WideShell, type WideView } from "./features/wide/WideShell";
import { DEFAULT_SETTINGS } from "./data/settings";
import { useCalendar, useCalendarEvents } from "./hooks/useCalendar";
import { useCloudSync } from "./hooks/useCloudSync";
import { useDesktop } from "./hooks/useDesktop";
import { useDaySummary, useLeftoverCount } from "./hooks/useLeftovers";
import { useMeetings } from "./hooks/useMeetings";
import { useSettings } from "./hooks/useSettings";
import { useShift } from "./hooks/useShift";
import { useStoredChoice, useStoredFlag } from "./hooks/useStoredFlag";
import { useWorkday } from "./hooks/useWorkday";
import { fromLocalDayKey, workDayRange } from "./lib/date";
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
  const showToast = useToast();
  const onSaveError = useCallback((): void => {
    showToast({ message: "Couldn’t save that change. Try again.", tone: "error" });
  }, [showToast]);
  const settingsState = useSettings(onSaveError);
  const settings = settingsState.settings ?? DEFAULT_SETTINGS;
  // Reloads after a shift starts with Plan my day off and leftovers carried over
  const afterCarryOverRef = useRef<() => void>(() => undefined);
  const onCarriedOver = useCallback((): void => {
    afterCarryOverRef.current();
  }, []);
  const shift = useShift(settings.planMyDay, onSaveError, onCarriedOver);
  const { todayKey } = shift;
  // The title bar shows the shift's day, so a night shift keeps its date after midnight
  const date = useMemo(() => fromLocalDayKey(todayKey), [todayKey]);
  // Set by session sync; a session saved while offline gets the "Saved offline" toast (2e)
  const syncOfflineRef = useRef(false);
  // Adding a task or starting a timer between shifts starts one (7i), except while planning it (7d)
  const [shiftSheet, setShiftSheet] = useState<"end" | "plan" | "review" | null>(null);
  const planningRef = useRef(false);
  planningRef.current = shiftSheet === "plan";
  const ensureShiftRef = useRef(shift.ensure);
  ensureShiftRef.current = shift.ensure;
  const onActivity = useCallback((): void => {
    if (!planningRef.current) ensureShiftRef.current();
  }, []);
  const work = useWorkday(todayKey, shift.ready, onSaveError, showToast, onActivity, syncOfflineRef);
  const leftovers = useLeftoverCount(todayKey, settings.planMyDay && shift.ready);
  afterCarryOverRef.current = () => {
    work.list.reload();
    leftovers.reload();
  };
  const lastShift = shift.view.status === "between" ? shift.view.last : null;
  const lastSummary = useDaySummary(lastShift?.dayKey ?? null);
  // A forgotten shift can end once the timer stops (7l)
  const timerRunning = work.timer.running !== null;
  const { recheck } = shift;
  useEffect(() => {
    if (!timerRunning) recheck();
  }, [timerRunning, recheck]);
  const cloud = useCloudSync(work.timer, syncOfflineRef);
  const { running, todaySessions, trackedByTask } = work.timer;
  const details = useTaskDetails(work, settings.defaultReminderMinutes);
  const calendar = useCalendar();
  const todayRange = workDayRange(todayKey);
  const todayEvents = useCalendarEvents(calendar, Date.parse(todayRange.start), Date.parse(todayRange.end)).events;
  // Meetings still to come today: dashed on the timeline (1f), not counted in totals
  const upcomingMeetings = todayEvents.filter((event) => event.endMs > Date.now());
  // The next one to start: the empty state (1b) and the idle mini bar (1e)
  const nextMeeting = todayEvents.find((event) => event.startMs > Date.now()) ?? null;
  useMeetings({ work, settings: settingsState.settings, updateSetting: settingsState.update });
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
    setShiftSheet(null);
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
      // Quick add is for adding a task, which starts a shift between shifts
      shift.ensure();
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
        nextMeeting={nextMeeting}
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
          calendar={calendar}
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

  // Shifts (Phase 7): End shift (7j), Plan my day (7d), between shifts (7k) and the 7l note
  const shiftView = shift.view;
  const openShiftSheet = (kind: "end" | "plan" | "review"): void => {
    details.close();
    setSheetOpen(false);
    setTab("today");
    setShiftSheet(kind);
  };
  const closeShiftSheet = (): void => {
    setShiftSheet(null);
  };
  const startShift = (): void => {
    if (settings.planMyDay) openShiftSheet("plan");
    else void shift.start();
  };
  const reloadAfterPlan = (): void => {
    work.list.reload();
    leftovers.reload();
  };

  let shiftSheetNode: ReactNode = null;
  if (shiftSheet === "end" && shiftView.status === "open") {
    shiftSheetNode = (
      <EndShiftSheet
        variant={wide ? "wide" : "expanded"}
        shift={shiftView.shift}
        tasks={work.list.tasks}
        sessions={todaySessions}
        running={running}
        trackedByTask={trackedByTask}
        planMyDay={settings.planMyDay}
        onEnd={() => {
          work.timer.stopQuietly();
          shift.end();
          setShiftSheet(null);
        }}
        onClose={closeShiftSheet}
      />
    );
  } else if (shiftSheet === "plan" || shiftSheet === "review") {
    shiftSheetNode = (
      <PlanMyDaySheet
        variant={wide ? "wide" : "expanded"}
        mode={shiftSheet === "plan" ? "start" : "review"}
        todayKey={todayKey}
        tasks={work.list.tasks}
        events={todayEvents}
        onAdd={(title) => {
          work.list.add({ title, type: "other" });
        }}
        onEstimate={(id, minutes) => {
          work.list.update(id, { estimateMinutes: minutes });
        }}
        onChanged={reloadAfterPlan}
        showToast={showToast}
        onStart={() => {
          setShiftSheet(null);
          void shift.start();
        }}
        onClose={closeShiftSheet}
      />
    );
  }

  const notice = shift.notice && (
    <ShiftNotice shift={shift.notice} onDismiss={shift.dismissNotice} className={wide ? "" : "mx-3 mb-2"} />
  );

  // Between shifts, Today shows only Start shift; earlier days stay in the Log
  let todayOverride: ReactNode = undefined;
  if (shiftView.status === "between") {
    todayOverride = (
      <BetweenShifts
        last={shiftView.last}
        trackedSeconds={lastSummary.trackedSeconds}
        doneCount={lastSummary.doneCount}
        leftovers={leftovers.count}
        onStart={startShift}
        onReopen={shift.reopen}
      />
    );
  } else if (shiftView.status === "error") {
    todayOverride = <LoadError title="Couldn’t load your shift" subject="tasks" onRetry={shift.reload} />;
  }

  const reviewLeftovers = (): void => {
    openShiftSheet("review");
  };
  const endShift = (): void => {
    openShiftSheet("end");
  };

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
      shiftAction={
        wide && shiftView.status === "open" ? (
          <>
            {leftovers.count > 0 && <LeftoversChip count={leftovers.count} onClick={reviewLeftovers} />}
            <EndShiftButton onClick={endShift} />
          </>
        ) : undefined
      }
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
          calendar={calendar}
          todayEvents={todayEvents}
          barActions={{ ...barActions, meetings: upcomingMeetings }}
          onStartTask={openSheet}
          sheet={wideView === "today-calendar" && (sheet || shiftSheetNode)}
          todayOverride={todayOverride}
          todayNotice={notice}
          focusQuickAdd={quickAddFocus}
          nextMeeting={nextMeeting}
          syncChip={<SyncChip sync={cloud} />}
        />
        {/* Above the footer, and above the timeline strip in Today + Calendar (drafted) */}
        <ToastViewport bottomClass={wideView === "log" ? "bottom-12" : "bottom-51"} />
        {details.popover}
      </WindowFrame>
    );
  }

  return (
    <WindowFrame blobs={tab === "calendar" && calendar.status?.connected ? BLOBS_CALENDAR_CONNECTED : TAB_BLOBS[tab]}>
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
            {notice}
            {todayOverride ? (
              <>
                <div className="relative z-1 mx-3 shrink-0">{todayOverride}</div>
                <div className="flex-1" />
              </>
            ) : (
              <>
                {shiftView.status === "open" && (
                  <ShiftStrip
                    shift={shiftView.shift}
                    total={todayTotal}
                    leftovers={leftovers.count}
                    onReview={reviewLeftovers}
                    onEndShift={endShift}
                  />
                )}
                <TodayView
                  work={work}
                  variant="expanded"
                  onStartTask={openSheet}
                  details={details}
                  focusQuickAdd={quickAddFocus}
                  nextMeeting={nextMeeting}
                />
              </>
            )}
            <FooterBar total={todayTotal} sync={<SyncChip sync={cloud} />} />
            {timelineOpen ? (
              <TimelinePanel
                todayKey={todayKey}
                timer={work.timer}
                onCollapse={() => {
                  setTimelineOpen(false);
                }}
                {...barActions}
                meetings={upcomingMeetings}
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
        {tab === "calendar" && <CalendarView calendar={calendar} todayKey={todayKey} timer={work.timer} />}
        {tab === "log" && <LogView variant="expanded" todayKey={todayKey} timer={work.timer} />}
      </div>
      {/* 1a script: 236px from the bottom with the timeline open, 64px with it collapsed */}
      <ToastViewport bottomClass={tab !== "today" ? "bottom-4" : timelineOpen ? "bottom-59" : "bottom-16"} />
      {sheet}
      {shiftSheetNode}
      {details.popover}
    </WindowFrame>
  );
}

export default App;
