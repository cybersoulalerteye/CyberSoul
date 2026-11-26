import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/components.css";
import "./styles/dashboard.css";
import "./styles/incidents.css";
import "./styles/incident-detail.css";
import "./styles/evidence.css";
import "./styles/sources.css";
import "./styles/rules.css";
import "./styles/reports.css";
import "./styles/settings.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
