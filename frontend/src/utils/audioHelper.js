/**
 * Browser Audio Helper for client-side decoding, merging and exporting.
 */

// Helper to convert AudioBuffer to WAV format
export function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferWav = new ArrayBuffer(length);
  const view = new DataView(bufferWav);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Write WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // chunk length
  setUint16(1);          // sample format (raw PCM)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);                     // block align
  setUint16(16);                                // bits per sample

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved audio channels
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed PCM
      view.setInt16(pos, sample, true); // write little-endian
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferWav], { type: 'audio/wav' });

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

/**
 * Decodes and merges multiple audio segments with silence intervals.
 * @param {Array} segments - Array of { url, pauseAfterMs }
 * @param {Function} onProgress - Progress callback
 */
export async function mergeAudioSegments(segments, onProgress) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decodedBuffers = [];

  // 1. Fetch & Decode all segments sequentially
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (onProgress) {
      onProgress(Math.round((i / segments.length) * 50)); // First 50% for decoding
    }
    
    try {
      const response = await fetch(seg.url);
      if (!response.ok) throw new Error(`Fetch failed for ${seg.url}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      decodedBuffers.push({
        buffer: audioBuffer,
        pauseAfterMs: seg.pauseAfterMs
      });
    } catch (err) {
      console.error(`Error decoding segment ${i}:`, err);
      // Skip failed segments or inject short silence
    }
  }

  if (decodedBuffers.length === 0) {
    throw new Error("No audio segments were successfully decoded.");
  }

  // 2. Calculate final merged buffer size (length in samples)
  const sampleRate = decodedBuffers[0].buffer.sampleRate;
  const numChannels = Math.max(...decodedBuffers.map(d => d.buffer.numberOfChannels));
  
  let totalLength = 0;
  decodedBuffers.forEach(d => {
    totalLength += d.buffer.length;
    // Add silence samples
    const silenceSamples = Math.round((d.pauseAfterMs / 1000) * sampleRate);
    totalLength += silenceSamples;
  });

  // 3. Create merged buffer
  const mergedBuffer = audioCtx.createBuffer(numChannels, totalLength, sampleRate);

  // 4. Paste samples in order
  let currentOffset = 0;
  for (let i = 0; i < decodedBuffers.length; i++) {
    if (onProgress) {
      onProgress(50 + Math.round((i / decodedBuffers.length) * 50)); // Last 50% for stitching
    }
    
    const { buffer, pauseAfterMs } = decodedBuffers[i];
    
    // Copy channel data
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = mergedBuffer.getChannelData(channel);
      // Handle mono/stereo matching
      const srcChannel = channel < buffer.numberOfChannels ? channel : 0;
      const srcData = buffer.getChannelData(srcChannel);
      channelData.set(srcData, currentOffset);
    }
    
    currentOffset += buffer.length;
    
    // Silence is auto-filled (initial ArrayBuffer values are 0), just advance offset
    const silenceSamples = Math.round((pauseAfterMs / 1000) * sampleRate);
    currentOffset += silenceSamples;
  }

  // Close context to release resources
  audioCtx.close();

  // 5. Convert to WAV Blob
  return audioBufferToWav(mergedBuffer);
}
