import React from "react";
import Link from "next/link";
import css from "./HomeIntro.module.scss";

const onMobile =
  process.browser &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

export function Intro({
  selectionIsLoading,
  handleChangeLocalFile,
  fileError,
}: {
  selectionIsLoading: boolean;
  handleChangeLocalFile: React.ChangeEventHandler<HTMLInputElement>;
  fileError: string | null | undefined;
}) {
  return (
    <div className={css.container}>
      <main className={css.main}>
        <h1 className={css.title}>Subtitler</h1>

        {(!process.browser || window.SharedArrayBuffer) && (
          <div>
            <p className={css.description}>
              {onMobile && (
                <div style={{ color: "darkred" }}>
                  Mobile devices are currently unsupported. Try on desktop if it
                  doesn't work!
                  <br />
                </div>
              )}
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
          <p className={css.description}>
            Sorry, this browser is currently unsupported. Try the latest version
            of Chrome or Edge.
          </p>
        )}
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
