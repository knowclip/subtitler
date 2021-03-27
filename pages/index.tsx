import "plyr-react/dist/plyr.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/Home.module.css";
import { usePrevious } from "../utils/usePrevious";
import { Media } from "../components/Media";
import { ffmpeg, getDuration } from "../utils/ffmpeg";
import { fetchFile } from "@ffmpeg/ffmpeg";
import { usePlayButtonSync } from "../utils/usePlayButtonSync";
import Waveform from "../waveform/Waveform";
import { useWaveform } from "../waveform/useWaveform";
import { useWaveformImages } from "../waveform/useWaveformImages";

export type MediaSelection = {
  location: "LOCAL" | "NETWORK";
  type: MediaType;
  url: string;
  durationSeconds: number;
};
type MediaType = "VIDEO" | "AUDIO";

export default function Home() {
  const [fileSelection, setFileSelection] = useState<MediaSelection | null>();
  const [selectionIsLoading, setSelectionIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>();

  const {
    waveformLoading: _,
    error: waveformError,
    waveformUrls,
    loadWaveformImages,
  } = useWaveformImages();

  const prevFileSelection = usePrevious(fileSelection);
  useEffect(() => {
    if (fileSelection !== prevFileSelection) {
      console.log({ prevFileSelection, fileSelection });
      return;
    }
  }, [fileSelection, prevFileSelection]);

  const handleChangeLocalFile: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setSelectionIsLoading(true);
      const { files } = e.target;
      const [file] = files;
      console.log({ file });

      const fileBytes = file?.size || 0;
      const gigabytes = fileBytes / 1024 / 1024 / 1024;
      const tooBig = gigabytes > 2;

      let fileError = tooBig
        ? "File is too big. Please choose a file under 2 GB."
        : null;
      if (fileError || !file) {
        setFileSelection(null);
        setFileError(fileError);
        setSelectionIsLoading(false);

        return;
      }

      (async function () {
        const name = "record.webm";
        if (!ffmpeg.isLoaded()) await ffmpeg.load();
        ffmpeg.FS("writeFile", name, await fetchFile(file));

        const fileSelection: MediaSelection = {
          location: "LOCAL",
          url: URL.createObjectURL(file),
          type: getFileType(file),
          durationSeconds: await getDuration(name),
        };
        setFileSelection(fileSelection);
        setFileError(fileError);
      })().catch((err) => {
        setFileError(String(err));
      });
    },
    []
  );

  const handleSubmitForm: React.FormEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      console.log("submitting");
      if (fileSelection) {
        loadWaveformImages(fileSelection);
      }
    },
    [fileSelection]
  );

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const waveform = useWaveform([]);
  const { onTimeUpdate, resetWaveformState } = waveform;
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Subtitler</h1>

        <form onSubmit={handleSubmitForm}>
          <p className={styles.description}>
            <label htmlFor="file">Choose video or audio file</label>
            <input
              name="file"
              type="file"
              onChange={handleChangeLocalFile}
              accept="video/*,audio/*"
            ></input>
          </p>
          <button disabled={!fileSelection || Boolean(fileError)}>
            Submit
          </button>
          {fileError}
        </form>

        {fileSelection && (
          <Media
            playerRef={playerRef}
            fileSelection={fileSelection}
            loop={false}
            onTimeUpdate={onTimeUpdate}
            onMediaLoaded={resetWaveformState}
          />
        )}
        {fileSelection && (
          <Waveform
            waveform={waveform}
            durationSeconds={fileSelection.durationSeconds}
            imageUrls={waveformUrls}
            playerRef={playerRef}
          />
        )}
      </main>

      <footer className={styles.footer}>
        <a
          href="https://knowclip.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Use your subtitles to learn languages with Knowclip
        </a>
      </footer>
    </div>
  );
}
function getFileType(file: File) {
  return file.type.startsWith("audio") ? "AUDIO" : "VIDEO";
}
