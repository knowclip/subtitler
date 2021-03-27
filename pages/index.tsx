import React, { useCallback, useEffect, useRef, useState } from "react";
import cn from 'classnames'
import styles from "../styles/Home.module.css";
import { usePrevious } from "../utils/usePrevious";
import { Media } from "../components/Media";
import { ffmpeg, getDuration } from "../utils/ffmpeg";
import { fetchFile } from "@ffmpeg/ffmpeg";
import { usePlayButtonSync } from "../utils/usePlayButtonSync";
import Waveform from "../waveform/Waveform";
import { useWaveform } from "../waveform/useWaveform";
import { useWaveformImages } from "../waveform/useWaveformImages";
import { WaveformSelectionExpanded } from "../waveform/WaveformState";
import {
  WaveformDragCreate,
  WaveformDragMove,
  WaveformDragStretch,
} from "../waveform/WaveformEvent";
import css from "./index.module.scss";

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
        // setFileSelection(null);
        setFileError(fileError);
        setSelectionIsLoading(false);

        return;
      }

      (async function () {
        const name = "record.webm";
        if (!ffmpeg.isLoaded()) await ffmpeg.load();
        ffmpeg.FS("writeFile", name, await fetchFile(file));
        console.log({ file });

        const fileSelection: MediaSelection = {
          location: "LOCAL",
          url: URL.createObjectURL(file),
          type: getFileType(file),
          durationSeconds: await getDuration(name),
        };
        setFileSelection(fileSelection);
        loadWaveformImages(fileSelection);
        setFileError(fileError);
      })().catch((err) => {
        setFileError(String(err));
      });
    },
    []
  );

  const [waveformItems, setWaveformItems] = useState<
    WaveformSelectionExpanded[]
  >([]);
  const handleWaveformDrag = useCallback(
    ({ start, end, waveformState }: WaveformDragCreate) => {
      const newClip = {
        start: Math.min(start, end),
        end: Math.max(start, end),
        id: Math.random().toString(),
        type: "Clip",
      };
      setWaveformItems((items) =>
        [
          ...items,
          {
            type: "Clip" as const,
            id: newClip.id,
            item: newClip,
          },
        ]
          .sort((a, b) => a.item.start - b.item.start)
          .map((item, i) => ({ ...item, index: i }))
      );
    },
    []
  );
  const handleClipDrag = useCallback(({ start, end }: WaveformDragMove) => {},
  []);
  const handleClipEdgeDrag = useCallback(
    ({ start, end }: WaveformDragStretch) => {},
    []
  );

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const waveform = useWaveform(waveformItems);
  const { onTimeUpdate, resetWaveformState } = waveform;
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef);

  if (!fileSelection)
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Subtitler</h1>

          <div>
            <p className={styles.description}>
              <label htmlFor="file-input">Choose video or audio file</label>
              <br />
              <input
                id="file-input"
                name="file-input"
                type="file"
                onChange={handleChangeLocalFile}
                accept="video/*,.mkv,audio/*"
              ></input>
            </p>
            {fileError}
          </div>
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

  return (
    <div className={css.container}>
      <header className={css.editorHeader}>
        <h1 className={css.headerTitle}>Subtitler</h1>
        <span className={css.headerChooseDifferentFile}>
          <input
            className={css.headerChooseDifferentFileButton}
            id="file-input"
            name="file-input"
            type="file"
            onChange={handleChangeLocalFile}
            accept="video/*,.mkv,audio/*"
          ></input>
          <label
            htmlFor="file-input"
            className={css.headerChooseDifferentFileLabel}
          >
            Choose a different media file
          </label>
        </span>
      </header>
      <main className={css.editorMain}>
        <div className={cn(css.editorMainTop, { [css.editorMainTopAudio]: fileSelection.type === 'AUDIO' })}>
          <section className={css.captionsListSection}>
            <p>caption 1</p>
            <p>caption 2</p>
            <p>caption 3</p>
          </section>
          <section className={cn(css.mediaSection, { [css.audio]: fileSelection.type === 'AUDIO' })}>
            <Media
              playerRef={playerRef}
              fileSelection={fileSelection}
              loop={false}
              onTimeUpdate={onTimeUpdate}
              onMediaLoaded={resetWaveformState}
            />
          </section>
        </div>
        <Waveform
          waveform={waveform}
          durationSeconds={fileSelection.durationSeconds}
          imageUrls={waveformUrls}
          playerRef={playerRef}
          onWaveformDrag={handleWaveformDrag}
          onClipDrag={handleClipDrag}
          onClipEdgeDrag={handleClipEdgeDrag}
        />
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
