import { useCallback, useEffect, useState } from "react";
import { FooterBar } from "./components/FooterBar";
import { Icon } from "./components/Icon";
import { MiniBar } from "./components/MiniBar";
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
import { LogEmpty } from "./features/log/LogEmpty";
import { TodayView } from "./features/today/TodayView";
import { WideShell, type WideView } from "./features/wide/WideShell";
import { useLocalDate } from "./hooks/useLocalDate";
import { useTodayTasks } from "./hooks/useTodayTasks";
import { toLocalDayKey } from "./lib/date";
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

/** No sessions until Phase 2. */
const TODAY_TOTAL = "0m";

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
  const list = useTodayTasks(toLocalDayKey(date), onSaveError);
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

  const togglePin = async (): Promise<void> => {
    const next = !pinned;
    setPinnedState(next);
    const ok = await setPinned(next);
    if (!ok) setPinnedState(!next);
  };

  if (mode === "mini") {
    return (
      <MiniBar
        total={TODAY_TOTAL}
        onExpand={() => {
          changeMode(lastOpenMode);
        }}
      />
    );
  }

  const wide = mode === "wide";
  const wideView: WideView = tab === "log" ? "log" : "today-calendar";

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
        <WideShell view={wideView} date={date} total={TODAY_TOTAL} list={list} />
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
            <TodayView list={list} variant="expanded" />
            <FooterBar total={TODAY_TOTAL} />
            <TimelineCollapsedBar total={TODAY_TOTAL} />
          </>
        )}
        {tab === "calendar" && <CalendarEmpty className="flex-1 p-7" />}
        {tab === "log" && <LogEmpty date={date} />}
      </div>
      {/* 1a: 64px from the bottom, above the footer and collapsed timeline */}
      <ToastViewport bottomClass={tab === "today" ? "bottom-16" : "bottom-4"} />
    </WindowFrame>
  );
}

export default App;
