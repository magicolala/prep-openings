import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";
import "./App.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ExperiencePreferencesProvider } from "./ui/providers/ExperiencePreferences";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExperiencePreferencesProvider>
      <App />
    </ExperiencePreferencesProvider>
  </React.StrictMode>
);
