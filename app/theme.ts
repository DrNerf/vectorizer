"use client";

import { createTheme } from "@mui/material/styles";

// Dark UI — better for judging image color/detail against a neutral stage.
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7c9cff" },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
});

export default theme;
