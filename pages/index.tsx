import Plyr from "plyr-react";
import 'plyr-react/dist/plyr.css'
import React, { useCallback, useEffect, useState } from "react";
import Waveform from "../components/Waveform";
import styles from "../styles/Home.module.css";
import { useWaveformImages } from "../utils/useWaveformImages";
export type MediaSelection =
  | { location: "LOCAL"; type: MediaType; url: string }
  | { location: "NETWORK"; type: MediaType; url: string };
type MediaType = "VIDEO" | "AUDIO";

export default function Home() {
  const [fileSelection, setFileSelection] = useState<MediaSelection | null>();
  const [fileError, setFileError] = useState<string | null>();

  const {
    waveformLoading,
    waveformUrls,
    loadWaveformImages,
  } = useWaveformImages();

  const handleChangeLocalFile: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const { files } = e.target;
      const [file] = files;
      console.log({ file });

      const fileBytes = file?.size || 0;
      const gigabytes = fileBytes / 1024 / 1024 / 1024;
      const tooBig = gigabytes > 2;

      let fileError = tooBig
        ? "File is too big. Please choose a file under 2 GB."
        : null;
      const fileType = file.type.startsWith("audio") ? "AUDIO" : "VIDEO";
      const fileSelection: MediaSelection | null = file
        ? { location: "LOCAL", url: URL.createObjectURL(file), type: fileType }
        : null;
      setFileSelection(fileSelection);
      setFileError(fileError);
    },
    []
  );

  const handleSubmitForm: React.FormEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      console.log("submitting");
      if (fileSelection) {
        loadWaveformImages(fileSelection);
      }
    },
    [fileSelection]
  );

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Subtitler</h1>

        <form onSubmit={handleSubmitForm}>
          <p className={styles.description}>
            <label htmlFor="file">Choose video or audio file</label>
            <input
              name="file"
              type="file"
              onChange={handleChangeLocalFile}
              accept="video/*,audio/*"
            ></input>
          </p>
          <button disabled={!fileSelection || Boolean(fileError)}>
            Submit
          </button>
          {fileError}
        </form>

        {fileSelection && (
          <div>
            {fileSelection.type === "VIDEO" && (
              <Plyr
                id="player"
                source={{
                  type: "video",
                  sources: [{ src: fileSelection.url }],
                }}
                style={{ width: "100%" }}
                data-plyr-config='{ "title": "Example Title" }'
              />
            )}
            {fileSelection.type === "AUDIO" && (
              <audio id="player" src={fileSelection.url} controls />
            )}
          </div>
        )}

        <div className={styles.grid}>
          {waveformLoading && <>Loading...</>}
          {waveformUrls.map((url) => (
            <img key={url} src={url} />
          ))}
          <Waveform />
        </div>
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
