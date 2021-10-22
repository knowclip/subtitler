import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import cn from "classnames";
import { usePrevious } from "../utils/usePrevious";
import { Media } from "./Media";
import {
  Waveform,
  useWaveform,
  usePlayButtonSync,
  WaveformItem,
  msToSeconds,
  secondsToMs,
  WaveformRegion,
  WaveformState,
} from "clipwave";
import css from "./HomeEditor.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";
import { getCaptionArticleId } from "../utils/getCaptionArticleId";
import { CaptionTile } from "./CaptionTile";
import { Caption } from "../utils/caption";
import { MediaSelection } from "../pages/index";
import Link from "next/link";
import { useWaveformImages } from "../utils/useWaveformImages";
import { editorReducer } from "./editorReducer";
import { useWaveformEventHandlers } from "./useWaveformEventHandlers";
import { useSrtActions } from "./useSrtActions";

export type CaptionsEditorState = {
  captions: Record<string, Caption>;
  waveformItems: Record<string, WaveformItem>;
};

const getInitialState = (): CaptionsEditorState => ({
  captions: {},
  waveformItems: {},
});

export const DRAG_ACTION_TIME_THRESHOLD = 400;
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

  const [captionsEditorState, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => getInitialState()
  );
  const { waveformItems, captions } = captionsEditorState;

  const captionIds = useMemo(() => Object.keys(captions), [captions]);

  const getItem = useCallback(
    (id: string) => {
      const clip = waveformItems[id];
      return clip || null;
    },
    [waveformItems]
  );

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const waveform = useWaveform(getItem);
  const {
    onTimeUpdate,
    state: { durationSeconds, regions },
    actions: waveformActions,
    getSelection,
  } = waveform;
  const selection = getSelection();
  const highlightedClipId =
    selection?.item?.clipwaveType === "Primary" ? selection.item.id : null;
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef);

  const { resetWaveformState, selectItem } = waveformActions;

  const { handleWaveformDrag, handleClipDrag, handleClipEdgeDrag } =
    useWaveformEventHandlers(
      waveform,
      playerRef,
      dispatch,
      highlightedClipId,
      waveformItems
    );

  const deleteCaption = useCallback((id: string) => {
    dispatch({
      type: "DELETE_CAPTION",
      id,
    });
    // waveform.actions.deleteItem(id)
  }, []);

  const reload = useCallback(() => {
    const yes = confirm("Discard your work and start again?");
    if (yes) window.location.reload();
  }, []);

  const {
    handleImportSrt,
    handleExportSrt,
  }: {
    handleImportSrt: React.ChangeEventHandler<HTMLInputElement>;
    handleExportSrt: React.MouseEventHandler<Element>;
  } = useSrtActions(
    waveform,
    captionsEditorState,
    playerRef,
    dispatch,
    fileSelection
  );

  const highlightClip = useCallback(
    (region: WaveformRegion, clip: WaveformItem) => {
      selectItem(regions.indexOf(region), clip.id);
      if (playerRef.current)
        playerRef.current.currentTime = msToSeconds(clip.start);
    },
    [regions, selectItem]
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

  const [editingCaption, setEditingCaption] = useState(false);
  const [loopReason, setLoopReason] = useState<"EDIT_CLIP" | null>(null);
  const handleChangeCaptionEditing = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (editing: boolean, clipId: string) => {
      setEditingCaption(editing);
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
  const itemIdsAtCurrentTime = selection.region?.itemIds.length
    ? selection.region.itemIds
    : null;
  const updateCaptionText = useCallback(() => {
    const currentWaveformItem = selection.item;

    if (editingCaption) return;

    if (
      itemIdsAtCurrentTime &&
      currentWaveformItem &&
      secondsToMs(playerRef.current?.currentTime || Infinity) <
        currentWaveformItem.end
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
  }, [selection, itemIdsAtCurrentTime, captions, editingCaption]);
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
                const newItems = region.itemIds.flatMap((id) => {
                  const item = waveform.getItem(id); // , 'captiontiles');
                  return item && waveformItems[id].start === region.start
                    ? [item]
                    : [];
                });
                const newIndexesStart = all.length;
                all.push(
                  ...newItems.flatMap((item, i) => {
                    const { id } = item;
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

