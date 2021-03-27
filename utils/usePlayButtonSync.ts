import { MutableRefObject, useCallback, useEffect, useState } from "react";
import {
  startMovingCursor,
  stopMovingCursor,
  setCursorX,
} from "../waveform/utils";
import { usePrevious } from "../utils/usePrevious";

export type PlayButtonSync = ReturnType<typeof usePlayButtonSync>;

export function usePlayButtonSync(
  pixelsPerSecond: number,
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>
) {
  const [playing, setPlaying] = useState(false);
  const playMedia = useCallback(() => {
    startMovingCursor(pixelsPerSecond, playerRef);
    setPlaying(true);
  }, [pixelsPerSecond]);
  const pauseMedia = useCallback(() => {
    stopMovingCursor();
    setPlaying(false);
  }, []);

  const previousPixelsPerSecond = usePrevious(pixelsPerSecond);
  useEffect(() => {
    if (!playing) return;
    if (pixelsPerSecond !== previousPixelsPerSecond) {
      stopMovingCursor();
      startMovingCursor(pixelsPerSecond, playerRef);
    }
  }, [playing, previousPixelsPerSecond, pixelsPerSecond]);

  useEffect(() => {
    const startPlaying = () => {
      playMedia();
    };

    document.addEventListener("play", startPlaying, true);

    return () => document.removeEventListener("play", startPlaying, true);
  }, [playMedia]);
  useEffect(() => {
    const stopPlaying = () => pauseMedia();

    document.addEventListener("pause", stopPlaying, true);

    return () => document.removeEventListener("pause", stopPlaying, true);
  }, [pauseMedia]);

  const playOrPauseAudio = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.paused ? player.play() : player.pause();
  }, []);

  useEffect(() => {
    const resetPlayButton = () => {
      pauseMedia();
      setCursorX(0);
    };
    document.addEventListener("loadeddata", resetPlayButton, true);
    return () => document.removeEventListener("loadeddata", resetPlayButton);
  }, [pauseMedia]);

  return { playOrPauseAudio, playing };
}
