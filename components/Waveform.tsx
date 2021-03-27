export default function Waveform({
  durationSeconds,
  imageUrls,
}: {
  durationSeconds: number;
  imageUrls: string[];
}) {
  return (
    <>
      {imageUrls.map((url) => (
        <img key={url} src={url} />
      ))}
    </>
  );
}
