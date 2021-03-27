import "plyr-react/dist/plyr.css";
import React, { useCallback, useEffect, useState } from "react";
import Waveform from "../components/Waveform";
import styles from "../styles/Home.module.css";
import { usePrevious } from "../utils/usePrevious";
import { useWaveformImages } from "../utils/useWaveformImages";
import { Media } from "../components/Media";
import { ffmpeg, getDuration } from "../utils/ffmpeg";
import { fetchFile } from "@ffmpeg/ffmpeg";
export type MediaSelection = {
  location: "LOCAL" | "NETWORK";
  type: MediaType;
  url: string;
  durationSeconds: number;
};
type MediaType = "VIDEO" | "AUDIO";

export default function Home() {
  const [fileSelection, setFileSelection] = useState<MediaSelection | null>();
  const [selectionIsLoading, setSelectionIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>();

  const {
    waveformLoading: _,
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
      const [file] = files;
      console.log({ file });

      const fileBytes = file?.size || 0;
      const gigabytes = fileBytes / 1024 / 1024 / 1024;
      const tooBig = gigabytes > 2;

      let fileError = tooBig
        ? "File is too big. Please choose a file under 2 GB."
        : null;
      if (fileError || !file) {
        setFileSelection(null);
        setFileError(fileError);
        setSelectionIsLoading(false);
      }

      (async function () {
        const name = "record.webm";
        if (!ffmpeg.isLoaded()) await ffmpeg.load();
        ffmpeg.FS("writeFile", name, await fetchFile(file));

        const fileSelection: MediaSelection = {
          location: "LOCAL",
          url: URL.createObjectURL(file),
          type: getFileType(file),
          durationSeconds: await getDuration(name),
        };
        setFileSelection(fileSelection);
        setFileError(fileError);
      })().catch((err) => {
        setFileError(String(err));
      });
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

        {fileSelection && <Media fileSelection={fileSelection} />}

        {fileSelection && (
          <div className={styles.grid}>
            <Waveform
              durationSeconds={fileSelection.durationSeconds}
              imageUrls={waveformUrls}
            />
          </div>
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
}
function getFileType(file: File) {
  return file.type.startsWith("audio") ? "AUDIO" : "VIDEO";
}
