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
import { usePlayButtonSync } from "../utils/usePlayButtonSync";
import Waveform from "../waveform/Waveform";
import { useWaveform } from "../waveform/useWaveform";
import { useWaveformImages } from "../waveform/useWaveformImages";
import { WaveformItem } from "../waveform/WaveformState";
import {
  WaveformDragCreate,
  WaveformDragMove,
  WaveformDragStretch,
} from "../waveform/WaveformEvent";
import css from "./HomeEditor.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";
import {
  CLIP_THRESHOLD_MILLSECONDS,
  msToSeconds,
  secondsToMs,
} from "../waveform/utils";
import { getCaptionArticleId } from "../utils/getCaptionArticleId";
import { bound } from "../utils/bound";
import { CaptionTile } from "./CaptionTile";
import { caption, Caption } from "../utils/caption";
import { newId } from "../utils/newId";
import { download } from "../utils/download";
import { MediaSelection } from "../pages/index";
import {
  calculateRegions,
  getRegionEnd,
  newRegionsWithItem,
  recalculateRegions,
  WaveformRegion,
} from "../utils/calculateRegions";

type CaptionsEditorState = {
  captions: Record<string, Caption>;
  waveformItems: Record<string, WaveformItem>;
  waveformRegions: WaveformRegion[];
};

const getInitialState = (end: number): CaptionsEditorState => ({
  captions: {},
  waveformItems: {},
  waveformRegions: [
    {
      start: 0,
      itemIds: [],
      end,
    },
  ],
});

function reducer(
  state: CaptionsEditorState,
  action: Action
): CaptionsEditorState {
  switch (action.type) {
    case "ADD_ITEM": {
      const { item } = action;

      const map = { ...state.waveformItems };
      const regions = newRegionsWithItem(state.waveformRegions, map, item);
      return {
        ...state,
        waveformItems: map,
        waveformRegions: regions,
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

      const end = getRegionEnd(
        state.waveformRegions,
        state.waveformRegions.length - 1
      );
      const target = state.waveformItems[id];
      const boundedDeltaX = bound(deltaX, [0 - target.start, end - target.end]);

      const moved = {
        ...target,
        start: target.start + boundedDeltaX,
        end: target.end + boundedDeltaX,
      };

      return {
        ...state,
        waveformRegions: recalculateRegions(
          state.waveformRegions,
          state.waveformItems,
          action.id,
          moved
        ),
        waveformItems: {
          ...state.waveformItems,
          [id]: moved,
        },
      };
    }

    case "STRETCH_ITEM": {
      const { id, start, end, durationSeconds } = action;
      const clipToStretch = state.waveformItems[id];
      const originKey =
        Math.abs(start - clipToStretch.start) <
        Math.abs(start - clipToStretch.end)
          ? "start"
          : "end";

      const bounds: [number, number] =
        originKey === "start"
          ? [0, clipToStretch.end - CLIP_THRESHOLD_MILLSECONDS]
          : [
              clipToStretch.start + CLIP_THRESHOLD_MILLSECONDS,
              secondsToMs(durationSeconds),
            ];
      const stretchEnd = bound(end, bounds);
      const target = state.waveformItems[id];
      const stretched = {
        ...target,
        [originKey]: stretchEnd,
      };
      return {
        ...state,
        waveformItems: {
          ...state.waveformItems,
          [id]: stretched,
        },
        waveformRegions: recalculateRegions(
          state.waveformRegions,
          state.waveformItems,
          action.id,
          stretched
        ),
      };
    }

    case "DELETE_CAPTION": {
      const { id } = action;
      const newCaptions = { ...state.captions };
      const newWaveformItems = { ...state.waveformItems };
      delete newCaptions[id];
      delete newWaveformItems[id];
      return {
        ...state,
        captions: newCaptions,
        waveformItems: newWaveformItems,
        waveformRegions: recalculateRegions(
          state.waveformRegions,
          state.waveformItems,
          action.id,
          null
        ),
      };
    }

    case "RESET":
      return getInitialState(action.end);

    case "SET_ITEMS": {
      const { regions, waveformItemsMap } = calculateRegions(
        action.sortedItems,
        action.end
      );
      return {
        ...state,
        waveformItems: waveformItemsMap,
        waveformRegions: regions,
        captions: action.captions,
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
      durationSeconds: number;
    }
  | { type: "DELETE_CAPTION"; id: string }
  | {
      type: "SET_ITEMS";
      sortedItems: WaveformItem[];
      captions: CaptionsEditorState["captions"];
      // rename
      end: number;
    }
  | {
      type: "SET_CAPTION_TEXT";
      id: string;
      text: string;
    }
  | { type: "RESET"; end: number };

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
      dispatch({
        type: "RESET",
        end: secondsToMs(fileSelection.durationSeconds),
      });
      return;
    }
  }, [fileSelection, loadWaveformImages, prevFileSelection]);

  const [{ waveformRegions, waveformItems, captions }, dispatch] = useReducer(
    reducer,
    getInitialState(secondsToMs(fileSelection.durationSeconds))
  );

  const captionIds = useMemo(() => Object.keys(captions), [captions]);

  const handleWaveformDrag = useCallback(
    ({ start: startRaw, end: endRaw }: WaveformDragCreate) => {
      const start = Math.min(startRaw, endRaw);
      const end = Math.max(startRaw, endRaw);

      if (end - start < CLIP_THRESHOLD_MILLSECONDS) return;

      const id = newId();
      const newClip = {
        type: "Clip" as const,
        start,
        end,
        id,
      };
      dispatch({
        type: "ADD_ITEM",
        item: newClip,
      });

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
      const { start, end, clipToMove } = move;
      const deltaX = end - start;

      dispatch({
        type: "MOVE_ITEM",
        id: clipToMove.id,
        deltaX,
      });
    },
    [dispatch]
  );
  const handleClipEdgeDrag = useCallback(
    (stretch: WaveformDragStretch) => {
      const {
        start,
        end,
        clipToStretch,
        waveformState: { durationSeconds },
      } = stretch;

      dispatch({
        type: "STRETCH_ITEM",
        id: clipToStretch.id,
        durationSeconds,
        start,
        end,
      });
    },
    [dispatch]
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

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const waveform = useWaveform(waveformRegions, waveformItems);
  const {
    onTimeUpdate,
    resetWaveformState,
    state: { selection, durationSeconds },
    selectItem,
  } = waveform;
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef);

  const highlightedClipId =
    selection?.item?.type === "Clip" ? selection.item.id : null;

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
        const { newCaptions, newWaveformItems } = nodes.reduce(
          (acc, node) => {
            if (node.type === "cue") {
              const newCaption = caption(node.data.text);
              acc.newCaptions[newCaption.uuid] = newCaption;
              acc.newWaveformItems.push({
                type: "Clip",
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
          }
        );
        dispatch({
          type: "SET_ITEMS",
          captions: newCaptions,
          sortedItems: newWaveformItems.sort((a, b) => {
            const byStart = a.start - b.start;
            return byStart || b.end - a.end;
          }),
          end: secondsToMs(durationSeconds),
        });
      });
    },
    [dispatch, durationSeconds]
  );

  const handleExportSrt: React.MouseEventHandler = useCallback(() => {
    try {
      const nodes = Object.values(waveformItems).flatMap((c) =>
        c.type === "Clip"
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
  const currentCaption = highlightedClipId ? captions[highlightedClipId] : null;
  const updateCaptionText = useCallback(() => {
    const currentWaveformItem = selection;
    if (
      currentCaption &&
      currentWaveformItem &&
      secondsToMs(playerRef.current?.currentTime || Infinity) <
        currentWaveformItem.item.end
    )
      setCurrentCaptionText(currentCaption.text);
    else setCurrentCaptionText(null);
  }, [currentCaption, setCurrentCaptionText, playerRef, selection]);
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
              {waveformRegions.reduce((all, region) => {
                const newItems = region.itemIds.filter(
                  (id) => waveform.items[id].start === region.start
                );
                const newIndexesStart = all.length;
                all.push(
                  ...newItems.flatMap((id, i) => {
                    const item = waveformItems[id];
                    if (item.type === "Clip") {
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
              onMediaLoaded={resetWaveformState}
            />
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
          onClipEdgeDrag={handleClipEdgeDrag}
          selectItem={highlightClip}
        />
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

function overlap(
  a: Pick<WaveformItem, "start" | "end">,
  b: Pick<WaveformItem, "start" | "end">
) {
  return a.start <= b.end && a.end >= b.start;
}
