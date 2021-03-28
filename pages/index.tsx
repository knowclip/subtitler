import React, { useCallback, useEffect, useRef, useState } from "react";
import cn from "classnames";
import { fetchFile } from "@ffmpeg/ffmpeg";
import { parseSync, stringifySync } from "subtitle";
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
import { toTimestamp } from "../waveform/toTimestamp";
import scrollIntoView from "scroll-into-view-if-needed";

export type MediaSelection = {
  location: "LOCAL" | "NETWORK";
  name: string;
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
            name: file.name,
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

  const [captions, setCaptions] = useState<Caption[]>([]);
  const prevCaptions = usePrevious(captions);
  const [waveformItems, setWaveformItems] = useState<
    WaveformSelectionExpanded[]
  >([]);
  useEffect(() => {
    if (prevCaptions !== captions) {
      // totally overwrite waveform items
      setWaveformItems(
        captions.map(
          (c, i): WaveformSelectionExpanded => ({
            type: "Clip",
            index: i,
            id: c.uuid,
            item: {
              id: c.uuid,
              start: c.start * 1000,
              end: c.end * 1000,
            },
          })
        )
      );
    }
  }, [captions, prevCaptions]);

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
  const {
    onTimeUpdate,
    resetWaveformState,
    state: { selection },
  } = waveform;
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef);

  const highlightedClipId = selection?.type === "Clip" ? selection.id : null;

  const reload = useCallback(() => {
    const yes = confirm("Discard your work and start again?");
    if (yes) window.location.reload();
  }, []);

  const handleImportSrt: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const { files } = e.target;
      const file = files?.[0];
      if (!file) return;

      function readFileFromFileInput(file: File) {
        return new Promise<string | undefined>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) =>
            resolve(e.target?.result as string | undefined);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
      }

      readFileFromFileInput(file).then((text) => {
        console.log({ text });
        if (!text) throw new Error("Invalid subtitles file");
        const nodes = parseSync(text);
        console.log({ nodes });
        const newCaptions: Caption[] = nodes.flatMap((node) =>
          node.type === "cue"
            ? [
                caption(
                  node.data.start / 1000,
                  node.data.end / 1000,
                  node.data.text
                ),
              ]
            : []
        );
        setCaptions(newCaptions);
      });
    },
    []
  );

  const handleExportSrt: React.MouseEventHandler = useCallback(() => {
    try {
      const text = stringifySync(
        captions.map((c) => ({
          type: "cue",
          data: {
            start: c.start * 1000,
            end: c.end * 1000,
            text: c.text,
          },
        })),
        { format: "SRT" }
      );
      download(fileSelection!.name.replace(/(\.*)?$/, "") + ".srt", text);
    } catch (err) {
      throw err;
    }
  }, [captions, fileSelection]);

  function download(filename: string, text: string) {
    var element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  function removeOverlaps(captions: Caption[]): Caption[] {
    // sort
    const sorted = [...captions].sort((a, b) => a.start - b.start);

    return [];
    // remove overlaps
  }

  const setMediaCurrentTime = useCallback(
    (seconds: number) => {
      console.log("go to", seconds);
      if (playerRef.current) playerRef.current.currentTime = seconds;
    },
    [playerRef]
  );
  const previousHighlightedClip = usePrevious(highlightedClipId);
  useEffect(() => {
    if (highlightedClipId && previousHighlightedClip !== highlightedClipId) {
      const tile = document.getElementById(highlightedClipId);
      if (tile) scrollIntoView(tile, { behavior: "smooth", scrollMode: "if-needed", block: 'start' });
    }
  }, [highlightedClipId, previousHighlightedClip]);
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
                <CaptionTile
                  key={caption.uuid}
                  index={i}
                  caption={caption}
                  highlighted={caption.uuid === highlightedClipId}
                  setMediaCurrentTime={setMediaCurrentTime}
                />
              ))}
            </section>
            <section className={css.captionsMenu}>
              <input
                className={css.importSubtitlesInput}
                type="file"
                id="import-subtitles-file"
                accept=".srt"
                onChange={handleImportSrt}
              ></input>
              <label
                className={cn(
                  css.importSubtitlesInputLabel,
                  css.secondaryActionButton
                )}
                htmlFor="import-subtitles-file"
              >
                import subtitles file
              </label>
              <button
                className={css.primaryActionButton}
                onClick={handleExportSrt}
              >
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

function CaptionTile({
  caption,
  highlighted,
  setMediaCurrentTime,
}: {
  caption: Caption;
  index: number;
  highlighted: boolean;
  setMediaCurrentTime: (seconds: number) => void;
}) {
  const { start, end, text, uuid } = caption;
  const [editing, setEditing] = useState(false);

  const highlightClip = useCallback(() => {
    setMediaCurrentTime(start);
  }, [setMediaCurrentTime, start]);

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
    <article
      id={uuid}
      className={cn(css.captionTile, { [css.highlighted]: highlighted })}
      onClick={highlighted ? undefined : highlightClip}
    >
      <div className={css.captionTileMain}>
        <div className={css.captionTiming}>
          {toCleanTimestamp(start)} - {toCleanTimestamp(end)}
        </div>
        {!editing && (
          <div
            className={css.captionText}
            onDoubleClick={handleDoubleClickText}
          >
            {text}
          </div>
        )}

        <form className={cn(css.captionForm, { [css.editing]: editing })}>
          <textarea
            className={css.captionTextArea}
            onBlur={handleBlurTextInput}
            ref={textAreaRef}
          >
            {text}
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
