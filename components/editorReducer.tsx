import { WaveformItem } from "clipwave";
import { CaptionsEditorState } from "./HomeEditor";

export type Action =
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

export function editorReducer(
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
      const newWaveformItems = { ...state.waveformItems };
      delete newWaveformItems[id];
      return {
        ...state,
        captions: newCaptions,
        waveformItems: newWaveformItems,
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
