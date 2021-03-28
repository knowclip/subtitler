import { useCallback, useState } from "react";
import { ffmpeg, getDuration } from "../utils/ffmpeg";
import { toTimestamp } from "./toTimestamp";

const WAVE_COLOR = "#b7cee0";
const BG_COLOR = "#00000000";
const CORRECTION_OFFSET = 0;
const WAVEFORM_PNG_PIXELS_PER_SECOND = 50;
export const WAVEFORM_SEGMENT_SECONDS = 5 * 60;

export function useWaveformImages() {
  const [waveformLoading, setWaveformLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waveformUrls, setWaveformUrls] = useState<string[]>([]);
  const waveformLoadSuccess = useCallback(() => {
    setError(null);
    setWaveformLoading(false);
  }, []);

  const loadWaveformImages = useCallback(async (recordName: string) => {
    setError(null);
    setWaveformLoading(true);
    setWaveformUrls([]);

    try {
      console.log("transcoding");
      for await (const url of getWaveformPngs(recordName)) {
        setWaveformUrls((all) => {
          console.log(all.length + 1);
          return [...all, url];
        });
      }

      console.log("done");
      waveformLoadSuccess();
    } catch (err) {
      setError(String(err));
      setWaveformLoading(false);
    }
  }, []);

  return {
    waveformLoading,
    error,
    waveformUrls,
    loadWaveformImages,
  };
}

async function* getWaveformPngs(recordName: string) {
  const durationSeconds = await getDuration(recordName);

  const segmentsCount = Math.ceil(durationSeconds / WAVEFORM_SEGMENT_SECONDS);
  const segments = [...Array(segmentsCount).keys()].map((i) => ({
    startSeconds: i * WAVEFORM_SEGMENT_SECONDS,
    endSeconds: Math.min(durationSeconds, (i + 1) * WAVEFORM_SEGMENT_SECONDS),
  }));
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
      recordName,
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
    yield URL.createObjectURL(new Blob([data.buffer], { type: "image/png" }));
    i++;
  }
}

export function zeroPad(zeroes: number, value: any) {
  return String(value).padStart(zeroes, "0");
}
