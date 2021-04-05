import React, { useCallback, useState } from "react";
import { fetchFile } from "@ffmpeg/ffmpeg";
import { ffmpeg, getDuration } from "../utils/ffmpeg";
import { newId } from "../utils/newId";
import { Intro } from "../components/HomeIntro";
import { HomeEditor } from "../components/HomeEditor";

export type MediaSelection = {
  location: "LOCAL" | "NETWORK";
  name: string;
  recordName: string;
  type: MediaType;
  url: string;
  durationSeconds: number;
};
type MediaType = "VIDEO" | "AUDIO";

export default function Home() {
  const [fileSelection, setFileSelection] = useState<MediaSelection | null>();
  const [selectionIsLoading, setSelectionIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>();

  const handleChangeLocalFile: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setSelectionIsLoading(true);
      const { files } = e.target;
      const file = files?.[0];

      const fileBytes = file?.size || 0;
      const gigabytes = fileBytes / 1024 / 1024 / 1024;
      const tooBig = gigabytes > 2;

      let fileError = tooBig
        ? "File is too big. Please choose a file under 2 GB."
        : null;
      if (fileError || !file) {
        setFileError(fileError);
        setSelectionIsLoading(false);

        return;
      }

      async function loadVideo(file: File) {
        try {
          if (!ffmpeg.isLoaded()) await ffmpeg.load();

          const recordName = newId() + ".webm";
          ffmpeg.FS("writeFile", recordName, await fetchFile(file));
          const fileSelection: MediaSelection = {
            location: "LOCAL",
            url: URL.createObjectURL(file),
            type: getFileType(file),
            name: file.name,
            recordName: recordName,
            durationSeconds: await getDuration(recordName),
          };
          setFileSelection(fileSelection);

          setSelectionIsLoading(false);
          setFileError(null);
        } catch (err) {
          setFileError(String(err));
          setSelectionIsLoading(false);
        }
      }

      setFileSelection(null);
      loadVideo(file);
    },
    []
  );

  if (!fileSelection)
    return (
      <Intro
        selectionIsLoading={selectionIsLoading}
        handleChangeLocalFile={handleChangeLocalFile}
        fileError={fileError}
      />
    );

  return (
    <HomeEditor
      handleChangeLocalFile={handleChangeLocalFile}
      fileError={fileError}
      fileSelection={fileSelection}
    />
  );
}

function getFileType(file: File) {
  return file.type.startsWith("audio") ? "AUDIO" : "VIDEO";
}
