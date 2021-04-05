import React, { useCallback, useEffect, useRef, useState } from "react";
import cn from "classnames";
import { usePrevious } from "../utils/usePrevious";
import { WaveformItem } from "../waveform/WaveformState";
import css from "./CaptionTile.module.scss";
import { getCaptionArticleId } from "../utils/getCaptionArticleId";
import { toTimestamp } from "../waveform/toTimestamp";
import { Caption } from "../utils/caption";
import { WaveformRegion } from "../utils/calculateRegions";

export function CaptionTile({
  caption,
  waveformItem,
  highlighted,
  region,
  highlightClip,
  onEditingStateChange,
  onChangeText,
  onSubmitText,
  deleteCaption,
}: {
  caption: Caption;
  waveformItem: WaveformItem;
  index: number;
  highlighted: boolean;
  region: WaveformRegion,
  highlightClip: (region: WaveformRegion, clip: WaveformItem) => void;
  onEditingStateChange: (editing: boolean, id: string) => void;
  onChangeText: (text: string) => void;
  onSubmitText: (id: string, text: string) => void;
  deleteCaption: (id: string) => void;
}) {
  const { start, end } = waveformItem;
  const { text, uuid } = caption;
  const [editing, setEditing] = useState(false);

  const [inputText, setInputText] = useState(text);

  const handleClick = useCallback(() => {
    highlightClip(region, waveformItem);
  }, [highlightClip, region, waveformItem]);

  const startEditing = useCallback(() => {
    setEditing(true);
    onEditingStateChange(true, uuid);
  }, [onEditingStateChange, uuid]);
  const stopEditing = useCallback(() => {
    if (text !== inputText) onSubmitText(uuid, inputText);
    setEditing(false);
    onEditingStateChange(false, uuid);
  }, [text, inputText, onSubmitText, uuid, onEditingStateChange]);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const prevText = usePrevious(text);
  useEffect(() => {
    if (prevText !== text) {
      setInputText(text);
    }
  }, [prevText, text, setInputText]);

  const handleDoubleClickText = useCallback(() => {
    startEditing();
    setTimeout(() => textAreaRef.current?.focus(), 0);
  }, [startEditing]);
  const handleBlurTextInput = useCallback(() => {
    stopEditing();
  }, [stopEditing]);
  const handleChangeTextInput: React.ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      setInputText(e.target.value);
      onChangeText(e.target.value);
    },
    [setInputText, onChangeText]
  );
  const handleClickEditButton = useCallback(() => {
    startEditing();
    setTimeout(() => textAreaRef.current?.focus(), 0);
  }, [startEditing]);
  const handleClickDoneButton = useCallback(() => {
    stopEditing();
  }, [stopEditing]);
  const handleClickDeleteButton = useCallback(() => {
    stopEditing();
    deleteCaption(uuid);
  }, [stopEditing, deleteCaption, uuid]);

  return (
    <article
      id={getCaptionArticleId(uuid)}
      className={cn(css.captionTile, { [css.highlighted]: highlighted })}
      onClick={highlighted ? undefined : handleClick}
    >
      <div className={css.captionTileMain}>
        <div className={css.captionTiming}>
          {toCleanTimestamp(start)} - {toCleanTimestamp(end)}
        </div>
        {
          <div
            className={cn(css.captionText, { [css.editing]: editing })}
            onDoubleClick={handleDoubleClickText}
          >
            {text}
            <form className={cn(css.captionForm, { [css.editing]: editing })}>
              <textarea
                className={css.captionTextArea}
                onFocus={startEditing}
                onBlur={handleBlurTextInput}
                ref={textAreaRef}
                value={inputText}
                onChange={handleChangeTextInput}
              ></textarea>
            </form>
          </div>
        }
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

function toCleanTimestamp(milliseconds: number) {
  return toTimestamp(milliseconds)
    .replace(/^(0+:)+0*/, "")
    .replace(/\.0+$/, "");
}
