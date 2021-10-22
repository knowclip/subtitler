import React, { Dispatch, useCallback } from "react";
import { parseSync, stringifySync } from "subtitle";
import { WaveformItem, secondsToMs, WaveformInterface } from "clipwave";
import { caption, Caption } from "../utils/caption";
import { download } from "../utils/download";
import { MediaSelection } from "../pages/index";
import { Action } from "./editorReducer";
import { CaptionsEditorState } from "./HomeEditor";

export function useSrtActions(
  waveform: WaveformInterface,
  { captions, waveformItems }: CaptionsEditorState,
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>,
  dispatch: Dispatch<Action>,
  fileSelection: MediaSelection
) {
  const {
    state: { durationSeconds },
    actions: waveformActions
  } = waveform;

  const handleImportSrt: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
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
          const { newCaptions, newWaveformItems, newWaveformItemsMap } =
            nodes.reduce(
              (acc, node) => {
                if (node.type === "cue") {
                  const newCaption = caption(node.data.text);
                  acc.newCaptions[newCaption.uuid] = newCaption;
                  const newWaveformItem = {
                    clipwaveType: "Primary" as const,
                    id: newCaption.uuid,
                    // start: secondsToMs(node.data.start),
                    // end: secondsToMs(node.data.end),
                    start: node.data.start,
                    end: node.data.end,
                  };
                  acc.newWaveformItems.push(newWaveformItem);
                  acc.newWaveformItemsMap[newCaption.uuid] = newWaveformItem;
                }

                return acc;
              },

              {
                newCaptions: {} as Record<string, Caption>,
                newWaveformItems: [] as WaveformItem[],
                newWaveformItemsMap: {} as Record<string, WaveformItem>,
              }
            );


          dispatch({
            type: "SET_ITEMS",
            captions: newCaptions,
            waveformItems: newWaveformItemsMap,
            end: secondsToMs(durationSeconds),
          });

          waveformActions.resetWaveformState(
            playerRef.current,
            newWaveformItems.sort((a, b) => {
              const byStart = a.start - b.start;
              return byStart || b.end - a.end;
            })
          );
        });
      },
      [dispatch, durationSeconds, playerRef, waveformActions]
    );

  const handleExportSrt: React.MouseEventHandler = useCallback(() => {
    try {
      const nodes = Object.values(waveformItems).flatMap((c) =>
        c.clipwaveType === "Primary"
          ? [
              {
                type: "cue" as const,
                data: {
                  start: c.start,
                  end: c.end,
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
  return { handleImportSrt, handleExportSrt };
}
