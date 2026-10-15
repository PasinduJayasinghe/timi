import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
// Icons are inline SVG (components/icons.ts), so no icon font loads
import "./styles/index.css";
import App from "./App";
import { AlarmApp } from "./features/alarm/AlarmApp";

// The meeting alarm (4a) is its own window, opened by Rust at index.html#alarm
const isAlarm = window.location.hash.startsWith("#alarm");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isAlarm ? <AlarmApp /> : <App />}</React.StrictMode>,
);
