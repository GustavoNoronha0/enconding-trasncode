import React, { useState, useEffect, useRef } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const App = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [webcamStream, setWebcamStream] = useState(null);
  const videoElementRef = useRef(null);
  const audioSelectRef = useRef(null);
  const videoSelectRef = useRef(null);

  const [ffmpeg, setFFmpeg] = useState(null);

  const startStreaming = () => {
    setIsStreaming(true);
  };

  const stopStreaming = () => {
    setIsStreaming(false);
  };

  const startRecording = async () => {
    setIsRecording(true);

    try {
      const displayMediaOptions = {
        video: true,
        audio: true,
      };

      const mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      setSelectedScreen(mediaStream);

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(audioStream);

      const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setWebcamStream(webcamStream);

      const combinedStream = new MediaStream([
        ...mediaStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
        ...webcamStream.getVideoTracks(),
      ]);

      const options = {
        mimeType: 'video/webm; codecs=vp9',
        audioBitsPerSecond: 128000,
        audioChannels: 2,
        audioSampleRate: 44100,
      };

      const recorder = new MediaRecorder(combinedStream, options);
      setMediaRecorder(recorder);

      const chunks = [];

      recorder.ondataavailable = event => {
        chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = videoUrl;
        a.download = 'recording.webm';
        a.click();
        window.URL.revokeObjectURL(videoUrl);
      };

      recorder.start();
    } catch (error) {
      console.error('Erro ao iniciar a gravação:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setSelectedScreen(null);

    if (ffmpeg && selectedScreen) {
      const { name } = selectedScreen.getVideoTracks()[0];
      ffmpeg.FS('writeFile', name, await fetchFile(selectedScreen));

      const videoOutputFilename = 'output.mp4';
      const audioOutputFilename = 'audio.wav';

      await ffmpeg.run('-i', name, '-c:v', 'libx264', '-b:v', '6M', '-profile:v', 'baseline', videoOutputFilename);
      await ffmpeg.run('-i', name, '-vn', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', audioOutputFilename);
      await ffmpeg.run('-i', videoOutputFilename, '-i', audioOutputFilename, '-c', 'copy', 'recording.mp4');

      const data = ffmpeg.FS('readFile', 'recording.mp4');
      const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });

      const videoUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style = 'display: none';
      a.href = videoUrl;
      a.download = 'recording.mp4';
      a.click();
      URL.revokeObjectURL(videoUrl);
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      const mediaStream = selectedScreen;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleScreenSelect = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setSelectedScreen(stream);
    } catch (error) {
      console.error('Erro ao capturar a tela:', error);
    }
  };

  const getMediaDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      setAudioDevices(audioDevices);
      setVideoDevices(videoDevices);
    } catch (error) {
      console.error('Erro ao obter dispositivos de mídia:', error);
    }
  };

  useEffect(() => {
    getMediaDevices();

    const loadFFmpeg = async () => {
      const ffmpegInstance = createFFmpeg({ log: true, corePath: '/path/to/ffmpeg-core.js' });
      await ffmpegInstance.load();
      setFFmpeg(ffmpegInstance);
    };

    loadFFmpeg();
  }, []);

  useEffect(() => {
    if (selectedScreen && videoElementRef.current) {
      videoElementRef.current.srcObject = selectedScreen;
    }
  }, [selectedScreen]);

  return (
    <div>
      <div>
        <button onClick={startStreaming} disabled={isStreaming || isRecording}>
          Iniciar Transmissão
        </button>
        <button onClick={stopStreaming} disabled={!isStreaming || isRecording}>
          Parar Transmissão
        </button>
      </div>
      <div>
        <button onClick={startRecording} disabled={isStreaming || isRecording}>
          Iniciar Gravação
        </button>
        <button onClick={stopRecording} disabled={!isRecording}>
          Parar Gravação
        </button>
      </div>
      <div>
        <label htmlFor="audio-select">Selecione o Microfone:</label>
        <select id="audio-select" ref={audioSelectRef}>
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="video-select">Selecione a Câmera:</label>
        <select id="video-select" ref={videoSelectRef}>
          {videoDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        {selectedScreen ? (
          <div onClick={handleScreenSelect} style={{ cursor: 'pointer' }}>
            <video ref={videoElementRef} autoPlay controls style={{ width: '100%', maxWidth: '500px' }} />
          </div>
        ) : (
          <div onClick={handleScreenSelect} style={{ cursor: 'pointer', border: '1px solid #ccc', padding: '10px' }}>
            <p>Clique aqui para selecionar a tela ou janela a ser transmitida</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
