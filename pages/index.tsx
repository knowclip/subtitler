import FFmpeg from "@ffmpeg/ffmpeg";
import Plyr from "plyr-react";
import React, { useCallback, useEffect, useState } from "react";
import Waveform from "../components/Waveform";
import styles from "../styles/Home.module.css";

const { createFFmpeg, fetchFile } = FFmpeg;

class StoredLogValue<T> {
  value?: T;
  promise: Promise<T>;
  resolve: (value: T) => void;

  constructor() {
    this.promise = new Promise((res) => {
      this.resolve = (value: T) => {
        res(value);
        latestDuration = new StoredLogValue<number>();
      };
    });
  }
}
let latestDuration = new StoredLogValue<number>();

const ffmpeg = createFFmpeg({
  log: true,
  logger: ({ type, message }) => {
    const match = message.match(/Duration:\s+(\d+):(\d+):(\d+.\d+|\d+)/);
    if (match) {
      const [, hh = "00", mm = "00", ssss = "00"] = match;
      const [hours, minutes, seconds] = [hh, mm, ssss].map(Number);
      console.log(match, [hours, minutes, seconds]);
      const duration = hours * 60 * 60 + minutes * 60 + seconds;
      latestDuration.resolve(duration);
    }
  },
});

const WAVE_COLOR = "#b7cee0";
const BG_COLOR = "#00000000";
const CORRECTION_OFFSET = 0;
const WAVEFORM_PNG_PIXELS_PER_SECOND = 50;
const WAVEFORM_SEGMENT_LENGTH = 5 * 60;
const getDuration = async (recordName: string) => {
  const duration = latestDuration.promise;
  await ffmpeg.run("-i", recordName, "2>&1", "output.txt");
  return await duration;
};

const zeroPad = (zeroes: number, value: any) =>
  String(value).padStart(zeroes, "0");

const toTimestamp = (
  milliseconds: number,
  unitsSeparator = ":",
  millisecondsSeparator = "."
) => {
  const millisecondsStamp = zeroPad(3, Math.round(milliseconds % 1000));
  const secondsStamp = zeroPad(2, Math.floor(milliseconds / 1000) % 60);
  const minutesStamp = zeroPad(2, Math.floor(milliseconds / 1000 / 60) % 60);
  const hoursStamp = zeroPad(2, Math.floor(milliseconds / 1000 / 60 / 60));
  return `${hoursStamp}${unitsSeparator}${minutesStamp}${unitsSeparator}${secondsStamp}${millisecondsSeparator}${millisecondsStamp}`;
};

const getWaveformPngs = async (media: Blob) => {
  console.log("transcoding");
  const name = "record.webm";
  if (!ffmpeg.isLoaded()) await ffmpeg.load();
  ffmpeg.FS("writeFile", name, await fetchFile(media));

  const durationSeconds = await getDuration(name);
  const segmentsCount = Math.ceil(durationSeconds / WAVEFORM_SEGMENT_LENGTH);
  const segments = [...Array(segmentsCount).keys()].map((i) => ({
    startSeconds: i * WAVEFORM_SEGMENT_LENGTH,
    endSeconds: Math.min(durationSeconds, (i + 1) * WAVEFORM_SEGMENT_LENGTH),
  }));
  const waveformUrls: string[] = [];
  let i = 0;
  for (const { startSeconds, endSeconds } of segments) {
    const pngFileName = `output_${i}.png`;
    const startX = WAVEFORM_PNG_PIXELS_PER_SECOND * startSeconds;
    const endX = WAVEFORM_PNG_PIXELS_PER_SECOND * endSeconds;
    const width = ~~(endX - startX);
    await ffmpeg.run(
      "-ss",
      toTimestamp(startSeconds * 1000),
      "-to",
      toTimestamp(endSeconds * 1000),
      "-i",
      name,
      "-filter_complex",
      [
        `[0:a]aformat=channel_layouts=mono,`,
        `compand=gain=-6,`,
        `showwavespic=s=${
          width + CORRECTION_OFFSET
        }x70:colors=${WAVE_COLOR},setpts=0[fg];`,
        `color=s=${width + CORRECTION_OFFSET}x70:color=${BG_COLOR}[bg];`,
        `[bg][fg]overlay=format=rgb,drawbox=x=(iw-w)/2:y=(ih-h)/2:w=iw:h=2:color=${WAVE_COLOR}`,
      ].join(""),
      "-frames:v",
      "1",
      pngFileName
    );
    const data = ffmpeg.FS("readFile", pngFileName);
    waveformUrls.push(
      URL.createObjectURL(new Blob([data.buffer], { type: "image/png" }))
    );
    i++;
  }

  return waveformUrls;
};

type MediaSelection =
  | { location: "LOCAL"; type: MediaType; url: string }
  | { location: "NETWORK"; type: MediaType; url: string };
type MediaType = "VIDEO" | "AUDIO";

export default function Home() {
  const [fileSelection, setFileSelection] = useState<MediaSelection | null>();
  const [fileError, setFileError] = useState<string | null>();

  const [waveformLoading, setWaveformLoading] = useState(false);
  const [waveformUrls, setWaveformUrls] = useState<string[]>([]);
  const waveformLoadSuccess = useCallback((urls: string[]) => {
    setWaveformUrls(urls);
    setWaveformLoading(false);
  }, []);

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
        console.log({ fileSelection: fileSelection });
        setWaveformLoading(true);
        fetch(fileSelection.url)
          .then((response) => response.blob())
          .then((blob) => getWaveformPngs(blob))
          .then((urls) => {
            console.log("done");
            waveformLoadSuccess(urls);
          });
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
