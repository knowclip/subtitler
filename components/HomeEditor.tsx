import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import cn from "classnames";
import { parseSync, stringifySync } from "subtitle";
import styles from "../styles/Home.module.css";
import { usePrevious } from "../utils/usePrevious";
import { Media } from "./Media";
import { usePlayButtonSync } from "../utils/usePlayButtonSync";
import Waveform from "../waveform/Waveform";
import { useWaveform } from "../waveform/useWaveform";
import { useWaveformImages } from "../waveform/useWaveformImages";
import { WaveformItem } from "../waveform/WaveformState";
import {
  WaveformDragCreate,
  WaveformDragMove,
  WaveformDragStretch
} from "../waveform/WaveformEvent";
import css from "./HomeEditor.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";
import { CLIP_THRESHOLD_MILLSECONDS, secondsToMs } from "../waveform/utils";
import { getCaptionArticleId } from "../utils/getCaptionArticleId";
import { bound } from "../utils/bound";
import { CaptionTile } from "./CaptionTile";
import { caption, Caption } from "../utils/caption";
import { newId } from "../utils/newId";
import { download } from "../utils/download";
import { MediaSelection } from "../pages/index";

export function HomeEditor({
  handleChangeLocalFile,
  fileError,
  fileSelection,
}: {
  handleChangeLocalFile: React.ChangeEventHandler<HTMLInputElement>;
  fileError: string | null | undefined;
  fileSelection: MediaSelection;
}) {
  const {
    waveformLoading,
    error: waveformError,
    waveformUrls,
    loadWaveformImages,
  } = useWaveformImages();

  const prevFileSelection = usePrevious(fileSelection);
  useEffect(() => {
    if (fileSelection !== prevFileSelection) {
      loadWaveformImages(fileSelection.recordName);
      return;
    }
  }, [fileSelection, prevFileSelection]);

  const [captions, setCaptions] = useState<Record<string, Caption>>({});
  const captionIds = useMemo(() => Object.keys(captions), [captions]);
  const [waveformItems, setWaveformItems] = useState<WaveformItem[]>([]);

  const handleWaveformDrag = useCallback(
    ({ start: startRaw, end: endRaw, waveformState }: WaveformDragCreate) => {
      const start = Math.min(startRaw, endRaw);
      const end = Math.max(startRaw, endRaw);

      if (end - start < CLIP_THRESHOLD_MILLSECONDS)
        return;

      const id = newId();
      setWaveformItems((items) => [
        ...items,
        {
          type: "Clip" as const,
          start,
          end,
          id,
        },
      ]
        .sort((a, b) => a.start - b.start)
        .map((item, i) => ({ ...item, index: i }))
      );

      setCaptions((captions) => ({
        ...captions,
        [id]: {
          uuid: id,
          text: "",
        },
      }));

      setTimeout(() => {
        const button: HTMLTextAreaElement | null = document.querySelector(
          `#${getCaptionArticleId(id)} button`
        );
        button?.click();
      }, 0);
    },
    []
  );
  const handleClipDrag = useCallback(
    (move: WaveformDragMove) => {
      const { start, end, clipToMove, waveformState } = move;
      const bounds: [number, number] = [
        0,
        secondsToMs(waveformState.durationSeconds),
      ];
      const deltaX = start - end;

      const movedClip = {
        ...clipToMove,
        start: bound(clipToMove.start - deltaX, bounds),
        end: bound(clipToMove.end - deltaX, bounds),
      };

      setWaveformItems((items) => {
        const newItems: WaveformItem[] = [];
        let i = 0;
        for (const item of items) {
          const idMatch = item.type === "Clip" && clipToMove.id === item.id;
          if (idMatch) {
            newItems.push({
              ...item,
              start: bound(clipToMove.start - deltaX, bounds),
              end: bound(clipToMove.end - deltaX, bounds),
            });
          } else {
            newItems.push(item);
          }
        }
        updateIndexesByMutation(newItems);
        return newItems;
      });
    },
    [setWaveformItems]
  );
  const handleClipEdgeDrag = useCallback(
    (stretch: WaveformDragStretch) => {
      const {
        start,
        end,
        clipToStretch,
        waveformState: { durationSeconds, pixelsPerSecond },
      } = stretch;

      const originKey = Math.abs(start - clipToStretch.start) <
        Math.abs(start - clipToStretch.end)
        ? "start"
        : "end";

      let stretchedClip: WaveformItem;
      if (originKey === "start") {
        const bounds: [number, number] = [
          0,
          clipToStretch.end - CLIP_THRESHOLD_MILLSECONDS,
        ];
        // const stretchStart = bound(start, bounds);
        const stretchEnd = bound(end, bounds);
        stretchedClip = {
          type: "Clip",
          ...clipToStretch,
          start: stretchEnd,
        };
      } else {
        const bounds: [number, number] = [
          clipToStretch.start + CLIP_THRESHOLD_MILLSECONDS,
          secondsToMs(durationSeconds),
        ];
        // const stretchStart = bound(start, bounds);
        const stretchEnd = bound(end, bounds);
        stretchedClip = {
          type: "Clip",
          ...clipToStretch,
          end: stretchEnd,
        };
      }

      setWaveformItems((items) => {
        const newItems: WaveformItem[] = [];

        const rangeOfStretch: number[] = [];

        let i = 0;
        for (const item of items) {
          const idMatch = item.type === "Clip" && clipToStretch.id === item.id;
          if (idMatch) {
            newItems.push(stretchedClip);
          } else {
            newItems.push(
              item.index === i
                ? item
                : {
                  ...item,
                  index: i,
                }
            );
          }

          if (overlap(stretch, item))
            rangeOfStretch.push(i);
          i++;
        }

        const overlappedByStretch = items.slice(
          rangeOfStretch[0],
          rangeOfStretch[rangeOfStretch.length - 1] + 1
        );

        updateIndexesByMutation(newItems);
        // then remove overlaps
        return newItems;
      });
    },
    [setWaveformItems]
  );

  function updateIndexesByMutation(items: WaveformItem[]) {
    items
      .sort((a, b) => a.start - b.start)
      .forEach((item, i) => {
        if (item.index !== i)
          items[i] = { ...item, index: i };
      });

    return items;
  }

  const deleteCaption = useCallback(
    (id: string) => {
      setCaptions((captions) => {
        const newCaptions = { ...captions };
        delete newCaptions[id];
        return newCaptions;
      });
      setWaveformItems((items) => items.filter((item) => !(item.type === "Clip" && item.id === id))
      );
    },
    [setCaptions]
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
    if (yes)
      window.location.reload();
  }, []);

  const handleImportSrt: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const { files } = e.target;
      const file = files?.[0];
      if (!file)
        return;

      function readFileFromFileInput(file: File) {
        return new Promise<string | undefined>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string | undefined);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
      }

      readFileFromFileInput(file).then((text) => {
        if (!text)
          throw new Error("Invalid subtitles file");
        const nodes = parseSync(text);
        const { newCaptions, newWaveformItems } = nodes.reduce(
          (acc, node, index) => {
            if (node.type === "cue") {
              const newCaption = caption(node.data.text);
              acc.newCaptions[newCaption.uuid] = newCaption;
              acc.newWaveformItems.push({
                type: "Clip",
                id: newCaption.uuid,
                index,
                start: node.data.start,
                end: node.data.end,
              });
            }

            return acc;
          },

          {
            newCaptions: {} as Record<string, Caption>,
            newWaveformItems: [] as WaveformItem[],
          }
        );
        setCaptions(newCaptions);
        setWaveformItems(newWaveformItems);
      });
    },
    [setCaptions, setWaveformItems]
  );

  const handleExportSrt: React.MouseEventHandler = useCallback(() => {
    try {
      const nodes = Object.values(waveformItems).flatMap((c) => c.type === "Clip"
        ? [
          {
            type: "cue" as const,
            data: {
              start: secondsToMs(c.start),
              end: secondsToMs(c.end),
              text: captions[c.id].text,
            },
          },
        ]
        : []
      );

      const text = stringifySync(nodes, { format: "SRT" });
      download(fileSelection!.name.replace(/(\.*)?$/, "") + ".srt", text);
    } catch (err) {
      throw err;
    }
  }, [captions, fileSelection, waveformItems]);

  function overlap(
    a: Pick<WaveformItem, "start" | "end">,
    b: Pick<WaveformItem, "start" | "end">
  ) {
    return a.start <= b.end && a.end >= b.start;
  }

  function removeOverlaps(waveformItems: WaveformItem[]): WaveformItem[] {
    const sorted = [...waveformItems].sort((a, b) => a.start - b.start);

    let index = 0;
    for (const item of sorted) {
      index++;
    }

    return sorted;
  }

  const setMediaCurrentTime = useCallback(
    (seconds: number) => {
      if (playerRef.current)
        playerRef.current.currentTime = seconds;
    },
    [playerRef]
  );
  const previousHighlightedClip = usePrevious(highlightedClipId);
  useEffect(() => {
    if (highlightedClipId && previousHighlightedClip !== highlightedClipId) {
      const tile = document.getElementById(
        getCaptionArticleId(highlightedClipId)
      );
      if (tile)
        scrollIntoView(tile, {
          behavior: "smooth",
          scrollMode: "if-needed",
          block: "start",
        });
    }
  }, [highlightedClipId, previousHighlightedClip]);

  const [loopReason, setLoopReason] = useState<"EDIT_CLIP" | null>(null);
  const handleChangeCaptionEditing = useCallback(
    (editing: boolean, clipId: string) => {
      setLoopReason(editing ? "EDIT_CLIP" : null);
    },
    []
  );
  const handleSubmitCaptionText = useCallback((id: string, text: string) => {
    function changeCaptionText(id: string, text: string) {
      setCaptions((map) => ({
        ...map,
        [id]: {
          ...map[id],
          text,
        },
      }));
    }

    changeCaptionText(id, text);
  }, []);

  const [currentCaptionText, setCurrentCaptionText] = useState<string | null>(
    null
  );
  const currentCaption = highlightedClipId ? captions[highlightedClipId] : null;
  const updateCaptionText = useCallback(() => {
    const currentWaveformItem = selection;
    if (currentCaption &&
      currentWaveformItem &&
      secondsToMs(playerRef.current?.currentTime || Infinity) <
      currentWaveformItem.end)
      setCurrentCaptionText(currentCaption.text);
    else
      setCurrentCaptionText(null);
  }, [
    onTimeUpdate,
    currentCaption,
    setCurrentCaptionText,
    playerRef,
    selection,
    highlightedClipId,
  ]);
  useEffect(() => {
    updateCaptionText();
  }, [
    onTimeUpdate,
    setCurrentCaptionText,
    playerRef,
    selection,
    highlightedClipId,
    captions,
  ]);
  const handleMediaTimeUpdate: typeof onTimeUpdate = useCallback(
    (media, seeking, looping) => {
      updateCaptionText();

      onTimeUpdate(media, seeking, looping);
    },
    [onTimeUpdate, updateCaptionText]
  );

  return (
    <div>
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
              {!captionIds.length && (
                <p className={css.emptyCaptionsListHintText}>
                  Start making captions by{" "}
                  <strong>clicking and dragging</strong> on the waveform or{" "}
                  <strong>import existing captions</strong> via the button
                  below.
                </p>
              )}
              {waveformItems.flatMap((item, i) => {
                if (item.type === "Clip") {
                  if (!captions[item.id]) {
                    return [];
                  }
                  return [
                    <CaptionTile
                      key={item.id}
                      index={item.index}
                      caption={captions[item.id]}
                      waveformItem={item}
                      highlighted={item.id === highlightedClipId}
                      setMediaCurrentTime={setMediaCurrentTime}
                      onEditingStateChange={handleChangeCaptionEditing}
                      onSubmitText={handleSubmitCaptionText}
                      onChangeText={setCurrentCaptionText}
                      deleteCaption={deleteCaption} />,
                  ];
                }

                return [];
              })}
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
                import from file
              </label>
              <button
                className={css.primaryActionButton}
                onClick={handleExportSrt}
              >
                save captions to file
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
              loop={Boolean(loopReason)}
              onTimeUpdate={handleMediaTimeUpdate}
              onMediaLoaded={resetWaveformState} />
            <div className={css.currentCaptionText}>
              <span className={css.currentCaptionTextInner}>
                {currentCaptionText}
              </span>
            </div>
          </section>
        </div>
        <Waveform
          waveform={waveform}
          durationSeconds={fileSelection.durationSeconds}
          imageUrls={waveformUrls}
          playerRef={playerRef}
          onWaveformDrag={handleWaveformDrag}
          onClipDrag={handleClipDrag}
          onClipEdgeDrag={handleClipEdgeDrag} />
      </main>

      <footer className={css.footer}>
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
