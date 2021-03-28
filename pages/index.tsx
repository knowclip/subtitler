import React, { useCallback, useEffect, useRef, useState } from "react";
import cn from "classnames";
import styles from "../styles/Home.module.css";
import { usePrevious } from "../utils/usePrevious";
import { Media } from "../components/Media";
import { ffmpeg, getDuration } from "../utils/ffmpeg";
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
import { fetchFile } from "@ffmpeg/ffmpeg";
import { toTimestamp } from "../waveform/toTimestamp";

export type MediaSelection = {
  location: "LOCAL" | "NETWORK";
  recordName: string;
  type: MediaType;
  url: string;
  durationSeconds: number;
};
type MediaType = "VIDEO" | "AUDIO";

type Caption = {
  start: number;
  end: number;
  text: string;
  uuid: string;
};

const caption = (start: number, end: number, text: string) => ({
  start,
  end,
  text,
  uuid: Math.random().toString(),
});
const captions: Caption[] = [
  caption(45, 50, "Hey there!"),
  caption(65, 69, "The rain in spain falls mainly on the plain"),
  caption(78, 80, "L'amour est un oiseau rebelle"),
  // caption(145, 150, "Hey there!"),
  // caption(165, 169, "The rain in spain falls mainly on the plain"),
  // caption(178, 180, "L'amour est un oiseau rebelle"),
  // caption(245, 250, "Hey there!"),
  // caption(265, 269, "The rain in spain falls mainly on the plain"),
  // caption(278, 280, "L'amour est un oiseau rebelle"),
  // caption(345, 350, "Hey there!"),
  // caption(365, 369, "The rain in spain falls mainly on the plain"),
  // caption(378, 380, "L'amour est un oiseau rebelle"),
  // caption(445, 450, "Hey there!"),
  // caption(465, 469, "The rain in spain falls mainly on the plain"),
  // caption(478, 480, "L'amour est un oiseau rebelle"),
];

export default function Home() {
  const [fileSelection, setFileSelection] = useState<MediaSelection | null>();
  const [selectionIsLoading, setSelectionIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>();

  const {
    waveformLoading,
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
      const file = files?.[0];
      console.log({ file });

      const fileBytes = file?.size || 0;
      const gigabytes = fileBytes / 1024 / 1024 / 1024;
      const tooBig = gigabytes > 2;

      let fileError = tooBig
        ? "File is too big. Please choose a file under 2 GB."
        : null;
      if (fileError || !file) {
        setFileError(fileError);
        setSelectionIsLoading(false);

        return;
      }

      async function loadVideo(file: File) {
        try {
          if (!ffmpeg.isLoaded()) await ffmpeg.load();

          const recordName = Math.random().toString() + ".webm";
          ffmpeg.FS("writeFile", recordName, await fetchFile(file));
          const fileSelection: MediaSelection = {
            location: "LOCAL",
            url: URL.createObjectURL(file),
            type: getFileType(file),
            recordName: recordName,
            durationSeconds: await getDuration(recordName),
          };
          setFileSelection(fileSelection);
          console.log({ file });

          setSelectionIsLoading(false);
          setFileError(null);
          loadWaveformImages(recordName);
        } catch (err) {
          setFileError(String(err));
          setSelectionIsLoading(false);
        }
      }

      setFileSelection(null);
      loadVideo(file);
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

  const reload = useCallback(() => {
    const yes = confirm("Discard your work and start again?");
    if (yes) window.location.reload();
  }, []);

  if (!fileSelection)
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Subtitler</h1>

          {(!process.browser || window.SharedArrayBuffer) && (
            <div>
              <p className={styles.description}>
                {selectionIsLoading ? (
                  <label htmlFor="file-input">Preparing media...</label>
                ) : (
                  <label htmlFor="file-input">Choose video or audio file</label>
                )}
                <br />
                <input
                  disabled={selectionIsLoading}
                  id="file-input"
                  name="file-input"
                  type="file"
                  onChange={handleChangeLocalFile}
                  accept="video/*,.mkv,audio/*"
                ></input>
              </p>
              <p className={css.errorText}>{fileError}</p>
            </div>
          )}

          {Boolean(process.browser && !window.SharedArrayBuffer) && (
            <p className={styles.description}>
              Sorry, this browser is currently unsupported. Try the latest
              version of Chrome or Edge.
            </p>
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
            disabled={waveformLoading}
            onChange={handleChangeLocalFile}
            accept="video/*,.mkv,audio/*"
          ></input>
          <label
            htmlFor="file-input"
            className={css.headerChooseDifferentFileLabel}
            onClick={waveformLoading ? reload : undefined}
          >
            {fileError ? (
              <span className={css.errorText}>{fileError}</span>
            ) : (
              <>Choose a different media file</>
            )}
          </label>
        </span>
      </header>
      <main className={css.editorMain}>
        <div
          className={cn(css.editorMainTop, {
            [css.editorMainTopAudio]: fileSelection.type === "AUDIO",
          })}
        >
          <section className={css.captionsSection}>
            <section className={css.captionsList}>
              {!captions.length && (
                <p>
                  Start by <strong>clicking and dragging</strong> on the
                  waveform or <a href="#">importing</a> an .srt file.
                </p>
              )}
              {captions.map((caption, i) => (
                <CaptionTile key={caption.uuid} index={i} caption={caption} />
              ))}
            </section>
            <section className={css.captionsMenu}>
              <button className={css.secondaryActionButton}>
                import subtitles file
              </button>
              <button className={css.primaryActionButton}>
                export subtitles to .srt
              </button>
            </section>
          </section>
          <section
            className={cn(css.mediaSection, {
              [css.audio]: fileSelection.type === "AUDIO",
            })}
          >
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

function CaptionTile({ caption }: { caption: Caption; index: number }) {
  const { start, end, text } = caption;
  const [editing, setEditing] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleDoubleClickText = useCallback(() => {
    setEditing(true);
    setTimeout(() => textAreaRef.current?.focus(), 0);
  }, []);
  const handleBlurTextInput = useCallback(() => {
    setEditing(false);
  }, []);
  const handleClickEditButton = useCallback(() => {
    setEditing(true);
    setTimeout(() => textAreaRef.current?.focus(), 0);
  }, []);
  const handleClickDoneButton = useCallback(() => {
    setEditing(false);
  }, []);
  const handleClickDeleteButton = useCallback(() => {
    // setEditing(false);
  }, []);
  return (
    <article className={css.captionTile}>
      <div className={css.captionTileMain}>
        <div className={css.captionTiming}>
          {toCleanTimestamp(start)} - {toCleanTimestamp(end)}
        </div>
        {!editing && (
          <div
            className={css.captionText}
            onDoubleClick={handleDoubleClickText}
          >
            {caption.text}
          </div>
        )}

        <form className={cn(css.captionForm, { [css.editing]: editing })}>
          <textarea
            className={css.captionTextArea}
            onBlur={handleBlurTextInput}
            ref={textAreaRef}
          >
            {caption.text}
          </textarea>
        </form>
      </div>

      <section className={css.captionTileMenu}>
        <div className={css.captionTileMenuLeft}>
          {editing ? (
            <button
              className={css.captionEditButton}
              onClick={handleClickDoneButton}
              key="done"
            >
              done
            </button>
          ) : (
            <button
              className={css.captionEditButton}
              onClick={handleClickEditButton}
              key="edit"
            >
              edit
            </button>
          )}
        </div>
        <div className={css.captionTileMenuRight}>
          <button
            className={css.captionDeleteButton}
            onClick={handleClickDeleteButton}
          >
            delete
          </button>
        </div>
      </section>
    </article>
  );
}

function toCleanTimestamp(seconds: number) {
  return toTimestamp(seconds * 1000)
    .replace(/^(0+:)+0*/, "")
    .replace(/\.0+$/, "");
}
