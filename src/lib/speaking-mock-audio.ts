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

function interleaveChannels(buffer: AudioBuffer) {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const length = buffer.length * buffer.numberOfChannels;
  const result = new Float32Array(length);
  let writeIndex = 0;

  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      result[writeIndex] = buffer.getChannelData(channelIndex)[sampleIndex];
      writeIndex += 1;
    }
  }

  return result;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer) {
  const channelData = interleaveChannels(buffer);
  const bytesPerSample = 2;
  const blockAlign = buffer.numberOfChannels * bytesPerSample;
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
  view.setUint16(22, buffer.numberOfChannels, true);
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
    return audioBufferToWavBlob(decodedBuffer);
  } finally {
    await audioContext.close();
  }
}
