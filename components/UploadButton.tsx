"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { styled } from "@mui/material/styles";
import type { SourceImage } from "@/lib/types";

// MUI's documented pattern for a file input behind a Button: a visually
// hidden native <input> rendered as the button's child label.
const HiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

interface UploadButtonProps {
  onLoaded: (image: SourceImage) => void;
  onError?: (message: string) => void;
}

export default function UploadButton({ onLoaded, onError }: UploadButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      onLoaded({
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        name: file.name,
      });
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Could not decode that image.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      component="label"
      variant="contained"
      disabled={busy}
      startIcon={
        busy ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />
      }
    >
      {busy ? "Loading…" : "Upload image"}
      <HiddenInput
        type="file"
        accept="image/png, image/jpeg"
        onChange={handleChange}
      />
    </Button>
  );
}
