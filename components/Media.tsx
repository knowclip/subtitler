import Plyr from "plyr";
import React, {
  MutableRefObject,
  useEffect,
  useRef,
} from "react";
import { MediaSelection } from "../pages/index";

const VIDEO_STYLES = { width: "100%" };

export const Media = ({
  fileSelection,
  playerRef,
}: {
  fileSelection: MediaSelection;
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
}) => {
  if (fileSelection.type === "VIDEO") {
    return (
      <Video
        key={fileSelection.url}
        playerRef={playerRef}
        fileSelection={fileSelection}
      />
    );
  }

  return (
    <div>
      <audio ref={playerRef} src={fileSelection.url} controls />
    </div>
  );
};
function Video({
  playerRef,
  fileSelection,
}: {
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  fileSelection: MediaSelection;
}) {
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
      />
    </div>
  );
}
