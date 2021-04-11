import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import cn from "classnames";
import { parseSync, stringifySync } from "subtitle";
import { usePrevious } from "../utils/usePrevious";
import { Media } from "./Media";
import {
  Waveform,
  useWaveform,
  usePlayButtonSync,
  WaveformItem,
  WaveformDragCreate,
  WaveformDragMove,
  WaveformDragOf,
  WaveformDragStretch,
  CLIP_THRESHOLD_MILLSECONDS,
  msToSeconds,
  secondsToMs,
  WaveformRegion,
} from "clipwave";
import css from "./HomeEditor.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";
import { getCaptionArticleId } from "../utils/getCaptionArticleId";
import { bound } from "../utils/bound";
import { CaptionTile } from "./CaptionTile";
import { caption, Caption } from "../utils/caption";
import { newId } from "../utils/newId";
import { download } from "../utils/download";
import { MediaSelection } from "../pages/index";
import Link from "next/link";
import { useWaveformImages } from "../utils/useWaveformImages";

type CaptionsEditorState = {
  captions: Record<string, Caption>;
  waveformItems: Record<string, WaveformItem>;
};

const getInitialState = (): CaptionsEditorState => ({
  captions: {},
  waveformItems: {},
});

function reducer(
  state: CaptionsEditorState,
  action: Action
): CaptionsEditorState {
  switch (action.type) {
    case "ADD_ITEM": {
      const { item } = action;

      return {
        ...state,
        waveformItems: {
          ...state.waveformItems,
          [action.item.id]: action.item,
        },
        captions: {
          ...state.captions,
          [action.item.id]: {
            uuid: item.id,
            text: "",
          },
        },
      };
    }
    case "MOVE_ITEM": {
      const { deltaX, id } = action;
      const target = state.waveformItems[id];

      const moved = {
        ...target,
        start: target.start + deltaX,
        end: target.end + deltaX,
      };
      return {
        ...state,
        waveformItems: {
          ...state.waveformItems,
          [id]: moved,
        },
      };
    }

    case "STRETCH_ITEM": {
      const { id, end, originKey } = action;
      const target = state.waveformItems[id];
      const stretched = {
        ...target,
        [originKey]: end,
      };
      return {
        ...state,
        waveformItems: {
          ...state.waveformItems,
          [id]: stretched,
        },
      };
    }

    case "DELETE_CAPTION": {
      const { id } = action;
      const newCaptions = { ...state.captions };
      delete newCaptions[id];
      return {
        ...state,
        captions: newCaptions,
      };
    }

    case "RESET":
      return {
        ...state,
        waveformItems: {},
        captions: {},
      };

    case "SET_ITEMS": {
      return {
        ...state,
        captions: action.captions,
        waveformItems: action.waveformItems,
      };
    }
    case "SET_CAPTION_TEXT": {
      const { id, text } = action;

      return {
        ...state,
        captions: {
          ...state.captions,
          [id]: {
            ...state.captions[id],
            text,
          },
        },
      };
    }

    default:
      return state;
  }
}

type Action =
  | { type: "ADD_ITEM"; item: WaveformItem }
  | {
      type: "MOVE_ITEM";
      id: string;
      deltaX: number;
    }
  | {
      type: "STRETCH_ITEM";
      id: string;
      start: number;
      end: number;
      originKey: "start" | "end";
    }
  | { type: "DELETE_CAPTION"; id: string }
  | {
      type: "SET_ITEMS";
      captions: CaptionsEditorState["captions"];
      waveformItems: Record<string, WaveformItem>;
      // rename
      end: number;
    }
  | {
      type: "SET_CAPTION_TEXT";
      id: string;
      text: string;
    }
  | { type: "RESET"; end: number };

const DRAG_ACTION_TIME_THRESHOLD = 400;
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
    waveformImages,
    loadWaveformImages,
  } = useWaveformImages();

  const prevFileSelection = usePrevious(fileSelection);
  useEffect(() => {
    if (fileSelection !== prevFileSelection) {
      loadWaveformImages(
        fileSelection.recordName,
        fileSelection.durationSeconds
      );
      dispatch({
        type: "RESET",
        end: secondsToMs(fileSelection.durationSeconds),
      });
      return;
    }
  }, [fileSelection, loadWaveformImages, prevFileSelection]);

  const [{ waveformItems, captions }, dispatch] = useReducer(
    reducer,
    undefined,
    () => getInitialState()
  );

  const captionIds = useMemo(() => Object.keys(captions), [captions]);

  const getItem = useCallback(
    (id: string) => {
      const clip = waveformItems[id];
      return clip;
    },
    [waveformItems]
  );

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const waveform = useWaveform(getItem);
  const {
    onTimeUpdate,
    state: { selection, durationSeconds, regions },
    actions: waveformActions,
  } = waveform;
  const highlightedClipId =
    selection?.item?.clipwaveType === "Primary" ? selection.item.id : null;
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef);

  const { resetWaveformState, selectItem } = waveformActions;

  const handleWaveformDrag = useCallback(
    ({
      action: { start: startRaw, end: endRaw },
    }: WaveformDragOf<WaveformDragCreate>) => {
      const start = Math.min(startRaw, endRaw);
      const end = Math.max(startRaw, endRaw);

      if (end - start < CLIP_THRESHOLD_MILLSECONDS) {
        if (playerRef.current) {
          playerRef.current.currentTime = msToSeconds(endRaw);
        }
        return;
      }

      const id = newId();
      const newClip = {
        clipwaveType: "Primary" as const,
        start,
        end,
        id,
      };
      dispatch({
        type: "ADD_ITEM",
        item: newClip,
      });
      waveformActions.addItem(newClip);

      if (playerRef.current) {
        playerRef.current.currentTime = msToSeconds(start);
      }

      setTimeout(() => {
        const button: HTMLTextAreaElement | null = document.querySelector(
          `#${getCaptionArticleId(id)} button`
        );
        button?.click();
      }, 0);
    },
    [waveformActions]
  );
  const handleClipDrag = useCallback(
    ({
      action: move,
      mouseDown,
      timeStamp,
    }: WaveformDragOf<WaveformDragMove>) => {
      const { start, end, clip, regionIndex } = move;
      const { id } = clip;
      const isPrimaryClip = getItem(id).clipwaveType === "Primary";
      if (!isPrimaryClip) {
        // select
        return;
      }

      const deltaX = end - start;
      const moveImminent =
        timeStamp - mouseDown.timeStamp > DRAG_ACTION_TIME_THRESHOLD;

      if (moveImminent) {
        waveformActions.moveItem(move);

        dispatch({
          type: "MOVE_ITEM",
          id: id,
          deltaX,
        });
      }

      const draggedClip = getItem(id);
      const isHighlighted = draggedClip.id === highlightedClipId;
      const region = regions[regionIndex];
      if (!isHighlighted) selectItem(region, draggedClip);

      if (playerRef.current) {
        const clipStart = moveImminent
          ? draggedClip.start + deltaX
          : draggedClip.start;
        const newTimeSeconds =
          !isHighlighted || moveImminent
            ? bound(msToSeconds(clipStart), [0, waveform.state.durationSeconds])
            : msToSeconds(end);
        if (playerRef.current.currentTime != newTimeSeconds) {
          waveform.selectionDoesntNeedSetAtNextTimeUpdate.current = true;
          playerRef.current.currentTime = newTimeSeconds;
        }
      }
    },
    [
      getItem,
      highlightedClipId,
      regions,
      selectItem,
      waveformActions,
      waveform.state.durationSeconds,
      waveform.selectionDoesntNeedSetAtNextTimeUpdate,
    ]
  );
  const handleClipEdgeDrag = useCallback(
    ({
      action: stretch,
      timeStamp,
      mouseDown,
    }: WaveformDragOf<WaveformDragStretch>) => {
      const { start, end, clipId, regionIndex, originKey } = stretch;

      const draggedClip = waveformItems[clipId];

      const stretchImminent =
        timeStamp - mouseDown.timeStamp > DRAG_ACTION_TIME_THRESHOLD;

      const isHighlighted = draggedClip.id === highlightedClipId;
      if (!isHighlighted) selectItem(regions[regionIndex], draggedClip);

      if (stretchImminent) {
        waveformActions.stretchItem(stretch);

        dispatch({
          type: "STRETCH_ITEM",
          id: clipId,
          originKey,
          start,
          end,
        });
      }

      if (playerRef.current) {
        // if this clip isnt currently selected, just use drag start?
        // if this clip isnt currently selected, use item start.
        const clipStart = draggedClip.start;
        const newTimeSeconds =
          !isHighlighted || stretchImminent
            ? bound(msToSeconds(clipStart), [0, waveform.state.durationSeconds])
            : msToSeconds(end);
        if (playerRef.current.currentTime != newTimeSeconds) {
          waveform.selectionDoesntNeedSetAtNextTimeUpdate.current = true;
          playerRef.current.currentTime = newTimeSeconds;
        }
      }
    },
    [
      waveformItems,
      highlightedClipId,
      selectItem,
      regions,
      waveformActions,
      waveform.state.durationSeconds,
      waveform.selectionDoesntNeedSetAtNextTimeUpdate,
    ]
  );

  const deleteCaption = useCallback(
    (id: string) => {
      dispatch({
        type: "DELETE_CAPTION",
        id,
      });
    },
    [dispatch]
  );

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
        if (!text) throw new Error("Invalid subtitles file");
        const nodes = parseSync(text);
        const {
          newCaptions,
          newWaveformItems,
          newWaveformItemsMap,
        } = nodes.reduce(
          (acc, node) => {
            if (node.type === "cue") {
              const newCaption = caption(node.data.text);
              acc.newCaptions[newCaption.uuid] = newCaption;
              acc.newWaveformItems.push({
                clipwaveType: "Primary" as const,
                id: newCaption.uuid,
                start: node.data.start,
                end: node.data.end,
              });
            }

            return acc;
          },

          {
            newCaptions: {} as Record<string, Caption>,
            newWaveformItems: [] as WaveformItem[],
            newWaveformItemsMap: {} as Record<string, WaveformItem>,
          }
        );
        waveformActions.resetWaveformState(
          playerRef.current,
          newWaveformItems.sort((a, b) => {
            const byStart = a.start - b.start;
            return byStart || b.end - a.end;
          })
        );
        dispatch({
          type: "SET_ITEMS",
          captions: newCaptions,
          waveformItems: newWaveformItemsMap,
          end: secondsToMs(durationSeconds),
        });
      });
    },
    [durationSeconds, waveformActions]
  );

  const handleExportSrt: React.MouseEventHandler = useCallback(() => {
    try {
      const nodes = Object.values(waveformItems).flatMap((c) =>
        c.clipwaveType === "Primary"
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
      download(fileSelection.name.replace(/(\.*)?$/, "") + ".srt", text);
    } catch (err) {
      console.error("Problem exporting");
      throw err;
    }
  }, [captions, fileSelection, waveformItems]);

  const highlightClip = useCallback(
    (region: WaveformRegion, clip: WaveformItem) => {
      selectItem(region, clip);
      if (playerRef.current)
        playerRef.current.currentTime = msToSeconds(clip.start);
    },
    [selectItem]
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (editing: boolean, clipId: string) => {
      setLoopReason(editing ? "EDIT_CLIP" : null);
    },
    []
  );
  const handleSubmitCaptionText = useCallback(
    (id: string, text: string) => {
      dispatch({
        type: "SET_CAPTION_TEXT",
        id,
        text,
      });
    },
    [dispatch]
  );

  const [currentCaptionText, setCurrentCaptionText] = useState<string | null>(
    null
  );
  const itemIdsAtCurrentTime = selection?.region?.itemIds.length
    ? selection.region.itemIds
    : null;
  const updateCaptionText = useCallback(() => {
    const currentWaveformItem = selection;
    if (
      itemIdsAtCurrentTime &&
      currentWaveformItem &&
      secondsToMs(playerRef.current?.currentTime || Infinity) <
        currentWaveformItem.item.end
    )
      setCurrentCaptionText(
        itemIdsAtCurrentTime
          .flatMap((id) => {
            const caption = captions[id];
            return caption ? caption.text : [];
          })
          .reverse()
          .join("\n")
      );
    else setCurrentCaptionText(null);
  }, [selection, itemIdsAtCurrentTime, captions]);
  useEffect(() => {
    updateCaptionText();
  }, [
    onTimeUpdate,
    setCurrentCaptionText,
    playerRef,
    selection,
    highlightedClipId,
    captions,
    updateCaptionText,
  ]);

  const handleMediaLoaded = useCallback(
    (media: HTMLAudioElement | HTMLVideoElement | null) => {
      resetWaveformState(media, []);
    },
    [resetWaveformState]
  );
  const handleMediaTimeUpdate: typeof onTimeUpdate = useCallback(
    (media, seeking, looping) => {
      updateCaptionText();

      onTimeUpdate(media, seeking, looping);
    },
    [onTimeUpdate, updateCaptionText]
  );

  /* eslint-disable jsx-a11y/click-events-have-key-events,jsx-a11y/no-noninteractive-element-interactions */
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
              {!captionIds.length && (
                <p className={css.emptyCaptionsListHintText}>
                  Start making captions by{" "}
                  <strong>clicking and dragging</strong> on the waveform or{" "}
                  <strong>import existing captions</strong> via the button
                  below.
                </p>
              )}
              {regions.reduce((all, region) => {
                const newItems = region.itemIds.filter(
                  (id) => waveformItems[id].start === region.start
                );
                const newIndexesStart = all.length;
                all.push(
                  ...newItems.flatMap((id, i) => {
                    const item = waveformItems[id];
                    if (item.clipwaveType === "Primary") {
                      if (!captions[id]) {
                        return [];
                      }
                      const captionIndex = newIndexesStart + i;
                      return [
                        <CaptionTile
                          key={id}
                          index={captionIndex}
                          caption={captions[id]}
                          waveformItem={item}
                          highlighted={id === highlightedClipId}
                          region={region}
                          highlightClip={highlightClip}
                          onEditingStateChange={handleChangeCaptionEditing}
                          onSubmitText={handleSubmitCaptionText}
                          onChangeText={setCurrentCaptionText}
                          deleteCaption={deleteCaption}
                        />,
                      ];
                    }
                  })
                );

                return all;
              }, [] as React.ReactNode[])}
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
              onMediaLoaded={handleMediaLoaded}
            />
            <div
              className={cn(css.currentCaptionText, {
                [css.audio]: fileSelection.type === "AUDIO",
              })}
            >
              <span className={css.currentCaptionTextInner}>
                {currentCaptionText}
              </span>
            </div>
          </section>
        </div>
        <Waveform
          waveform={waveform}
          images={waveformImages}
          playerRef={playerRef}
          onWaveformDrag={handleWaveformDrag}
          onClipDrag={handleClipDrag}
          onClipEdgeDrag={handleClipEdgeDrag}
        />
        {waveformError}
      </main>

      <footer className={css.footer}>
        <p>
          <a
            href="https://knowclip.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Use your subtitles to learn languages with Knowclip
          </a>
        </p>

        <p className={css.impressumLink}>
          <Link href="/imprint">Impressum</Link>
        </p>
      </footer>
    </div>
  );
}
