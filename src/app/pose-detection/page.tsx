'use client';

import { useEffect, useRef, useState } from 'react';
import * as tmPose from '@teachablemachine/pose';
import { useRouter } from 'next/navigation';

export default function PoseDetection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<tmPose.Webcam | null>(null);
  const modelRef = useRef<any>(null);
  const animationFrameId = useRef<number | null>(null);
  const isRunningRef = useRef(true);
  const inCooldownRef = useRef(false); // Used to delay between valid reps

  const [isLoading, setIsLoading] = useState(true);
  const [exerciseCount, setExerciseCount] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState('Squat');
  const [targetReps, setTargetReps] = useState(5);
  const [message, setMessage] = useState('Detecting...');

  const router = useRouter();

  const exerciseOptions = [
    'Pushup',
    'Pullup',
    'Squat',
    'Dead Lift',
    'Shoulder Press',
    'Plank',
    'Bench Press',
    'Triceps Dips',
  ];

  useEffect(() => {
    isRunningRef.current = true;

    const init = async () => {
      const modelURL = '/pose-model/model.json';
      const metadataURL = '/pose-model/metadata.json';

      const model = await tmPose.load(modelURL, metadataURL);
      const webcam = new tmPose.Webcam(400, 400, true);
      await webcam.setup();
      await webcam.play();

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(webcam.canvas);
      }

      webcamRef.current = webcam;
      modelRef.current = model;
      setIsLoading(false);

      const loop = async () => {
        if (!isRunningRef.current || !webcamRef.current || !modelRef.current) return;

        webcamRef.current.update();
        const { pose, posenetOutput } = await modelRef.current.estimatePose(webcamRef.current.canvas);
        const prediction = await modelRef.current.predict(posenetOutput, pose);

        if (prediction && prediction.length > 0) {
          const topPrediction = prediction.sort((a, b) => b.probability - a.probability)[0];

          if (
            topPrediction.className === selectedExercise &&
            topPrediction.probability === 1
          ) {
            setMessage('✅ Posture Correct!');

            // Only count if not in cooldown
            if (!inCooldownRef.current) {
              setExerciseCount((count) => count + 1);
              inCooldownRef.current = true;

              // Wait 3 seconds before allowing next rep
              setTimeout(() => {
                inCooldownRef.current = false;
              }, 3000);
            }
          } else {
            setMessage('❗ Keep correcting your posture');
          }

          if (exerciseCount >= targetReps) {
            stopWebcam();
            return;
          }
        }

        animationFrameId.current = requestAnimationFrame(loop);
      };

      loop();
    };

    init();

    return () => {
      isRunningRef.current = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (webcamRef.current && webcamRef.current.stream) {
        webcamRef.current.stop();
      }
    };
  }, [selectedExercise, targetReps, exerciseCount]);

  const stopWebcam = () => {
    isRunningRef.current = false;
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    if (webcamRef.current && webcamRef.current.stream) {
      webcamRef.current.stop();
    }

    setTimeout(() => {
      router.push('/generate-program');
    }, 500);
  };

  const progressPercent = Math.min((exerciseCount / targetReps) * 100, 100);

  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold mb-4">AI Exercise Counter</h2>

      {/* Exercise Selector */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Select Exercise:</label>
        <select
          value={selectedExercise}
          onChange={(e) => {
            setExerciseCount(0);
            setSelectedExercise(e.target.value);
          }}
          className="border px-3 py-1 rounded"
        >
          {exerciseOptions.map((exercise) => (
            <option key={exercise} value={exercise}>
              {exercise}
            </option>
          ))}
        </select>
      </div>

      {/* Target Reps */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Target Reps:</label>
        <input
          type="number"
          min={1}
          value={targetReps}
          onChange={(e) => setTargetReps(Number(e.target.value))}
          className="border px-3 py-1 rounded w-20"
        />
      </div>

      {/* Webcam */}
      <div ref={containerRef} className="mx-auto w-fit rounded shadow mb-4" />

      {/* Feedback Message */}
      <div className="mt-2 text-lg font-semibold text-blue-600">{message}</div>

      {/* Stats and Progress */}
      <div className="mt-4 text-lg">
        <p><strong>{selectedExercise} Count:</strong> {exerciseCount}</p>
        <p><strong>Target:</strong> {targetReps}</p>

        <div className="w-full max-w-md mx-auto mt-4">
          <div className="bg-gray-200 rounded-full h-5 w-full overflow-hidden">
            <div
              className="bg-green-500 h-5 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm mt-1">{progressPercent.toFixed(0)}% completed</p>
        </div>
      </div>

      {/* Stop Button */}
      <button
        onClick={stopWebcam}
        className="mt-6 px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
      >
        Stop
      </button>
    </div>
  );
}
