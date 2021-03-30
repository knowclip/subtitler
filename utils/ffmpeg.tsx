import FFmpeg from "@ffmpeg/ffmpeg";
const { createFFmpeg, fetchFile } = FFmpeg;

export const ffmpeg = createFFmpeg({
  log: true,
  logger: ({ type, message }) => {
    const match = message.match(/Duration:\s+(\d+):(\d+):(\d+.\d+|\d+)/);
    if (match) {
      const [, hh = "00", mm = "00", ssss = "00"] = match;
      const [hours, minutes, seconds] = [hh, mm, ssss].map(Number);
      const duration = hours * 60 * 60 + minutes * 60 + seconds;
      latestDuration.current.resolve(duration);
    }
  },
});

export const getDuration = async (recordName: string) => {
  const duration = getLatestDuration().promise;
  await ffmpeg.run("-i", recordName, "2>&1");
  return await duration;
};


class StoredLogValue<T> {
  value?: T;
  promise: Promise<T>;
  resolve: (value: T) => void;

  constructor() {
    this.resolve = () => {}
    this.promise = new Promise((res) => {
      this.resolve = (value: T) => {
        res(value);
        latestDuration.current = new StoredLogValue<number>();
      };
    });
  }
}
const latestDuration = {
  current: new StoredLogValue<number>(),
};

function getLatestDuration() {
  return latestDuration.current;
}
