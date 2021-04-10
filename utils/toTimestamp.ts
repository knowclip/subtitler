import { zeroPad } from "./useWaveformImages";

export function toTimestamp(
  milliseconds: number,
  unitsSeparator = ":",
  millisecondsSeparator = ".") {
  const millisecondsStamp = zeroPad(3, Math.round(milliseconds % 1000));
  const secondsStamp = zeroPad(2, Math.floor(milliseconds / 1000) % 60);
  const minutesStamp = zeroPad(2, Math.floor(milliseconds / 1000 / 60) % 60);
  const hoursStamp = zeroPad(2, Math.floor(milliseconds / 1000 / 60 / 60));
  return `${hoursStamp}${unitsSeparator}${minutesStamp}${unitsSeparator}${secondsStamp}${millisecondsSeparator}${millisecondsStamp}`;
}
