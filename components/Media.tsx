import Plyr from "plyr";
import React, {
  AudioHTMLAttributes,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  VideoHTMLAttributes,
} from "react";
import { MediaSelection } from "../pages/index";

const VIDEO_STYLES = { width: "100%" };

type LoopState = boolean;

export const Media = ({
  fileSelection,
  playerRef,
  loop,
  onTimeUpdate,
  onMediaLoaded
}: {
  fileSelection: MediaSelection;
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  loop: LoopState;
  onMediaLoaded: (mediaEl: HTMLAudioElement | HTMLVideoElement | null) => void,
  onTimeUpdate: (
    mediaEl: HTMLVideoElement | HTMLAudioElement,
    seeking: MutableRefObject<boolean>,
    looping: boolean
  ) => void;
}) => {
  const seeking = useRef(false);
  const seekOn = useCallback((_e) => {
    seeking.current = true;
  }, []);
  const seekOff = useCallback((_e) => {
    seeking.current = false;
  }, []);

  const looping = Boolean(loop);

  const props:
    | AudioHTMLAttributes<HTMLAudioElement>
    | VideoHTMLAttributes<HTMLVideoElement> = {
    onSeeking: seekOn,
    onSeeked: seekOff,
    onLoadedMetadata: useCallback(
      (e) => {
        onMediaLoaded(e.target)
      },
      [onMediaLoaded]
    ),
    onTimeUpdate: useCallback(
      (e) => {
        const media = e.target as HTMLVideoElement | HTMLAudioElement;
        const wasSeeking = seeking.current;
        onTimeUpdate(media, seeking, looping);
        // if (wasSeeking) blur(e)
      },
      [
        onTimeUpdate,
        looping,
        // blur,
        seeking,
      ]
    ),
  };

  if (fileSelection.type === "VIDEO") {
    return (
      <Video
        key={fileSelection.url}
        playerRef={playerRef}
        fileSelection={fileSelection}
        {...props}
      />
    );
  }

  return (
    <div>
      <audio ref={playerRef} src={fileSelection.url} controls {...props} />
    </div>
  );
};
function Video({
  playerRef,
  fileSelection,
  ...rest
}: {
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  fileSelection: MediaSelection;
} & VideoHTMLAttributes<HTMLVideoElement>) {
  const plyr = useRef<Plyr | null>(null);
  useEffect(() => {
    plyr.current = new Plyr("#player");
  }, []);

  return (
    <div>
      <video
        id="player"
        style={VIDEO_STYLES}
        ref={playerRef as MutableRefObject<HTMLVideoElement>}
        src={fileSelection.url}
        {...rest}
      />
    </div>
  );
}
