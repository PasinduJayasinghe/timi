import type { ReactNode } from "react";

/**
 * Blob placements differ per screen in the design, so each layout passes its own.
 * Values are full class names: size, position, opacity and blur.
 */
export type BlobLayout = {
  violet: string;
  sky: string;
  /** Calendar "not connected" (3c) adds a rose blob. */
  rose?: string;
};

/** 3c rose blob, placed behind the content area (top-right). */
export const ROSE_BLOB = "pointer-events-none absolute rounded-full bg-type-calendar opacity-25 blur-blob-xs size-55";

/** 1b Today (expanded). */
export const BLOBS_TODAY: BlobLayout = {
  violet: "size-70 -left-22.5 -top-17.5 opacity-42 blur-blob-sm",
  sky: "size-75 -right-30 top-80 opacity-42 blur-blob-md",
};

/** 3a Calendar (expanded); rose blob from 3c, 60px above and right of the content area (top 96px). */
export const BLOBS_CALENDAR: BlobLayout = {
  violet: BLOBS_TODAY.violet,
  sky: "size-75 -right-30 top-90 opacity-42 blur-blob-md",
  rose: "-right-15 top-9",
};

/** 3a Calendar, connected: no rose blob. */
export const BLOBS_CALENDAR_CONNECTED: BlobLayout = {
  violet: BLOBS_CALENDAR.violet,
  sky: BLOBS_CALENDAR.sky,
};

/** 3f Log (expanded). */
export const BLOBS_LOG: BlobLayout = {
  violet: BLOBS_TODAY.violet,
  sky: "size-75 -right-30 top-105 opacity-42 blur-blob-md",
};

/** 1d Wide. */
export const BLOBS_WIDE: BlobLayout = {
  violet: "size-85 -left-25 -top-30 opacity-42 blur-blob-md",
  sky: "size-90 -right-25 top-30 opacity-42 blur-blob-lg",
};

/** 3g Log in wide mode. */
export const BLOBS_WIDE_LOG: BlobLayout = {
  violet: "size-85 -left-25 -top-30 opacity-40 blur-blob-md",
  sky: "size-85 -right-20 -bottom-30 opacity-40 blur-blob-lg",
};

type WindowFrameProps = {
  blobs: BlobLayout;
  className?: string;
  children: ReactNode;
};

/** The glass window: app gradient, inner white edge, two colour blobs. */
export function WindowFrame({ blobs, className = "", children }: WindowFrameProps) {
  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-app text-ink shadow-window-edge ${className}`}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute rounded-full bg-blob-violet ${blobs.violet}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute rounded-full bg-blob-sky ${blobs.sky}`} />
      {blobs.rose && <div aria-hidden="true" className={`${ROSE_BLOB} ${blobs.rose}`} />}
      {children}
    </div>
  );
}
