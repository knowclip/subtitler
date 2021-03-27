import Plyr from "plyr-react";
import React, { useMemo } from "react";
import { MediaSelection } from "../pages/index";

const VIDEO_STYLES = { width: "100%" };

export const Media = React.memo(
  ({ fileSelection }: { fileSelection: MediaSelection }) => {
    if (fileSelection.type === "VIDEO") {
      return <Video fileSelection={fileSelection} />;
    }

    return (
      <div>
        <audio id="player" src={fileSelection.url} controls />
      </div>
    );
  }
);
function Video({ fileSelection }: { fileSelection: MediaSelection }) {
  const source: Plyr.SourceInfo = useMemo(
    () => ({
      type: "video",
      sources: [{ src: fileSelection.url }],
    }),
    [fileSelection]
  );

  return (
    <div>
      <Plyr id="player" source={source} style={VIDEO_STYLES} />
    </div>
  );
}
