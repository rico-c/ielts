export function getSupportedMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

const TARGET_SAMPLE_RATE = 16000;

function mixToMono(buffer: AudioBuffer) {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const mono = new Float32Array(buffer.length);

  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    let total = 0;

    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      total += buffer.getChannelData(channelIndex)[sampleIndex];
    }

    mono[sampleIndex] = total / buffer.numberOfChannels;
  }

  return mono;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer) {
  const channelData = mixToMono(buffer);
  const bytesPerSample = 2;
  const channelCount = 1;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = buffer.sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function resampleAudioBuffer(
  sourceBuffer: AudioBuffer,
  targetSampleRate: number,
) {
  if (
    sourceBuffer.sampleRate === targetSampleRate &&
    sourceBuffer.numberOfChannels === 1
  ) {
    return sourceBuffer;
  }

  const frameCount = Math.max(
    1,
    Math.round((sourceBuffer.duration || 0) * targetSampleRate),
  );
  const offlineContext = new OfflineAudioContext(1, frameCount, targetSampleRate);
  const monoBuffer = offlineContext.createBuffer(
    1,
    sourceBuffer.length,
    sourceBuffer.sampleRate,
  );

  monoBuffer.copyToChannel(mixToMono(sourceBuffer), 0);

  const source = offlineContext.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return offlineContext.startRendering();
}

export async function convertBlobToWav(sourceBlob: Blob) {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("当前浏览器不支持音频转码。");
  }

  const audioContext = new AudioContextConstructor();

  try {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const normalizedBuffer = await resampleAudioBuffer(
      decodedBuffer,
      TARGET_SAMPLE_RATE,
    );
    return audioBufferToWavBlob(normalizedBuffer);
  } finally {
    await audioContext.close();
  }
}
